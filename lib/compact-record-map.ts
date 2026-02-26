import { type ExtendedRecordMap } from 'notion-types'
import { parsePageId } from 'notion-utils'

const toUuid = (id: string | undefined | null): string | undefined =>
  id ? parsePageId(id, { uuid: true }) ?? undefined : undefined
const toUuidFromUnknown = (value: unknown): string | undefined =>
  typeof value === 'string' ? toUuid(value) : undefined

const normalizeRecord = (rawId: string, record: any) => {
  let normalizedRecord = record

  while (
    normalizedRecord?.value &&
    normalizedRecord?.value?.value &&
    !normalizedRecord?.value?.type
  ) {
    normalizedRecord = normalizedRecord.value
  }

  if (!normalizedRecord?.value && normalizedRecord?.type) {
    normalizedRecord = {
      id: rawId,
      role: 'reader',
      value: normalizedRecord
    }
  }

  if (!normalizedRecord?.value) {
    return {
      canonicalId: toUuid(rawId) ?? rawId,
      record: normalizedRecord
    }
  }

  const canonicalId = toUuid(normalizedRecord?.value?.id) ?? toUuid(rawId) ?? rawId

  return {
    canonicalId,
    record: {
      ...normalizedRecord,
      value: {
        ...normalizedRecord.value,
        id: canonicalId
      }
    }
  }
}

const dedupeByCanonicalId = <T extends Record<string, any>>(
  map: T | undefined,
  idFromValue?: (value: any, rawId: string) => string | undefined
): Record<string, any> => {
  if (!map) return {}

  const deduped = new Map<string, any>()

  for (const [rawId, record] of Object.entries(map)) {
    const resolvedIdFromValue = idFromValue?.(record, rawId)
    const canonicalId = resolvedIdFromValue ?? toUuid(rawId) ?? rawId

    if (!deduped.has(canonicalId)) {
      deduped.set(canonicalId, record)
    }
  }

  return Object.fromEntries(deduped.entries())
}

const collectCollectionRowPageIds = (collectionQuery: any): Set<string> => {
  const ids = new Set<string>()

  for (const views of Object.values(collectionQuery || {})) {
    for (const viewResult of Object.values(views || {})) {
      const queryResult: any = viewResult || {}
      const candidates = [
        queryResult?.collection_group_results?.blockIds,
        queryResult?.reducerResults?.collection_group_results?.blockIds,
        queryResult?.result?.blockIds
      ]

      for (const blockIds of candidates) {
        if (!Array.isArray(blockIds)) continue
        for (const blockId of blockIds) {
          const pageUuid = toUuidFromUnknown(blockId)
          if (pageUuid) ids.add(pageUuid)
        }
      }
    }
  }

  return ids
}

const collectReachableBlockIds = (
  canonicalBlockMap: Map<string, any>,
  rootBlockId: string | undefined,
  collectionRowPageIds: Set<string>
) => {
  const keep = new Set<string>()
  if (!rootBlockId) return keep

  const queue = [rootBlockId]

  while (queue.length) {
    const blockId = queue.shift()!
    if (keep.has(blockId)) continue

    keep.add(blockId)
    const block = canonicalBlockMap.get(blockId)?.value
    if (!block) continue

    const referencedPageIds = extractPageReferenceIds(block?.properties)
    for (const referencedPageId of referencedPageIds) {
      keep.add(referencedPageId)
    }

    let parentId = toUuid(block?.parent_id)
    while (parentId && !keep.has(parentId)) {
      keep.add(parentId)
      parentId = toUuid(canonicalBlockMap.get(parentId)?.value?.parent_id)
    }

    if (collectionRowPageIds.has(blockId)) {
      continue
    }

    const contentIds = Array.isArray(block?.content) ? block.content : []
    for (const contentId of contentIds) {
      const childId = toUuidFromUnknown(contentId)
      if (childId && !keep.has(childId)) {
        queue.push(childId)
      }
    }
  }

  for (const rowPageId of collectionRowPageIds) {
    if (canonicalBlockMap.has(rowPageId)) {
      keep.add(rowPageId)
    }
  }

  return keep
}

const extractPageReferenceIds = (value: unknown): string[] => {
  const refs = new Set<string>()

  const walk = (node: unknown) => {
    if (!node) return

    if (Array.isArray(node)) {
      if (node.length === 2 && node[0] === 'p' && typeof node[1] === 'string') {
        const pageId = toUuid(node[1])
        if (pageId) refs.add(pageId)
      }

      for (const item of node) {
        walk(item)
      }

      return
    }

    if (typeof node === 'object') {
      for (const value of Object.values(node as Record<string, unknown>)) {
        walk(value)
      }
    }
  }

  walk(value)
  return [...refs]
}

const filterBlockIdsByKeepSet = (
  blockIds: string[] | undefined,
  keepBlockIds: Set<string>
) =>
  (blockIds || []).filter((blockId) => {
    const canonicalBlockId = toUuidFromUnknown(blockId)
    return !!canonicalBlockId && keepBlockIds.has(canonicalBlockId)
  })

const pruneBlockValueForClient = (value: any): any => {
  if (!value || typeof value !== 'object') return value

  const isPageBlock =
    value.type === 'page' || value.type === 'collection_view_page'
  const droppedKeys = new Set([
    'version',
    'created_by_table',
    'created_by_id',
    'last_edited_by_table',
    'last_edited_by_id',
    'copied_from_pointer',
    'permissions',
    'shard_id',
    'created_time',
    'alive'
  ])

  const nextValue: Record<string, any> = {}
  for (const [key, itemValue] of Object.entries(value)) {
    if (droppedKeys.has(key)) continue

    if (!isPageBlock && key === 'space_id') continue
    if (!isPageBlock && key === 'last_edited_time') continue
    if (!isPageBlock && key === 'parent_table') continue

    nextValue[key] = itemValue
  }

  return nextValue
}

export function compactRecordMapForClient(
  recordMap: ExtendedRecordMap,
  pageId?: string
): ExtendedRecordMap {
  if (!recordMap?.block) return recordMap

  const canonicalBlocks = new Map<string, any>()

  for (const [rawBlockId, rawBlockRecord] of Object.entries(recordMap.block)) {
    const { canonicalId, record } = normalizeRecord(rawBlockId, rawBlockRecord)
    if (!canonicalId) continue
    if (!canonicalBlocks.has(canonicalId)) {
      canonicalBlocks.set(canonicalId, record)
    }
  }

  if (!canonicalBlocks.size) {
    return recordMap
  }

  const collectionRowPageIds = collectCollectionRowPageIds(recordMap.collection_query)
  const rootBlockId =
    toUuid(pageId) ??
    toUuid(Object.keys(recordMap.block)[0]) ??
    canonicalBlocks.keys().next().value
  const keepBlockIds = collectReachableBlockIds(
    canonicalBlocks,
    rootBlockId,
    collectionRowPageIds
  )

  const compactedBlockMap = [...keepBlockIds].reduce(
    (acc, blockId) => {
      const blockRecord = canonicalBlocks.get(blockId)
      if (!blockRecord) return acc

      if (collectionRowPageIds.has(blockId) && blockRecord?.value?.content?.length) {
        acc[blockId] = {
          ...blockRecord,
          value: {
            ...pruneBlockValueForClient(blockRecord.value),
            content: []
          }
        }
        return acc
      }

      acc[blockId] = {
        ...blockRecord,
        value: pruneBlockValueForClient(blockRecord.value)
      }
      return acc
    },
    {} as NonNullable<ExtendedRecordMap['block']>
  )

  const usedCollectionIds = new Set<string>()
  const usedViewIds = new Set<string>()
  for (const blockRecord of Object.values(compactedBlockMap)) {
    const blockValue: any = (blockRecord as any)?.value
    const collectionId = toUuid(blockValue?.collection_id)
    if (collectionId) usedCollectionIds.add(collectionId)

    const viewIds = Array.isArray(blockValue?.view_ids) ? blockValue.view_ids : []
    for (const viewId of viewIds) {
      const canonicalViewId = toUuidFromUnknown(viewId)
      if (canonicalViewId) usedViewIds.add(canonicalViewId)
    }
  }

  const compactedCollectionMap = dedupeByCanonicalId(
    recordMap.collection,
    (collectionRecord, rawId) =>
      toUuid(collectionRecord?.value?.id) ?? toUuid(rawId) ?? rawId
  )
  const compactedCollectionViewMap = dedupeByCanonicalId(
    recordMap.collection_view,
    (viewRecord, rawId) => toUuid(viewRecord?.value?.id) ?? toUuid(rawId) ?? rawId
  )

  const filteredCollectionMap = Object.fromEntries(
    Object.entries(compactedCollectionMap).filter(([collectionId]) =>
      usedCollectionIds.size ? usedCollectionIds.has(collectionId) : true
    )
  )
  const filteredCollectionViewMap = Object.fromEntries(
    Object.entries(compactedCollectionViewMap).filter(([viewId]) =>
      usedViewIds.size ? usedViewIds.has(viewId) : true
    )
  )

  const filteredCollectionQuery = Object.entries(recordMap.collection_query || {}).reduce(
    (collectionAcc, [rawCollectionId, rawViews]) => {
      const collectionId = toUuid(rawCollectionId) ?? rawCollectionId
      if (usedCollectionIds.size && !usedCollectionIds.has(collectionId)) {
        return collectionAcc
      }

      const nextViews = Object.entries(rawViews || {}).reduce(
        (viewAcc, [rawViewId, rawViewResult]) => {
          const viewId = toUuid(rawViewId) ?? rawViewId
          if (usedViewIds.size && !usedViewIds.has(viewId)) {
            return viewAcc
          }

          const viewResult: any = rawViewResult || {}

          const nextViewResult: any = {
            ...viewResult
          }

          if (viewResult?.collection_group_results?.blockIds) {
            nextViewResult.collection_group_results = {
              ...viewResult.collection_group_results,
              blockIds: filterBlockIdsByKeepSet(
                viewResult.collection_group_results.blockIds,
                keepBlockIds
              )
            }
          }

          if (viewResult?.reducerResults?.collection_group_results?.blockIds) {
            nextViewResult.reducerResults = {
              ...viewResult.reducerResults,
              collection_group_results: {
                ...viewResult.reducerResults.collection_group_results,
                blockIds: filterBlockIdsByKeepSet(
                  viewResult.reducerResults.collection_group_results.blockIds,
                  keepBlockIds
                )
              }
            }
          }

          if (viewResult?.result?.blockIds) {
            nextViewResult.result = {
              ...viewResult.result,
              blockIds: filterBlockIdsByKeepSet(viewResult.result.blockIds, keepBlockIds)
            }
          }

          viewAcc[viewId] = nextViewResult
          return viewAcc
        },
        {} as Record<string, any>
      )

      collectionAcc[collectionId] = nextViews
      return collectionAcc
    },
    {} as Record<string, Record<string, any>>
  )

  return {
    ...recordMap,
    block: compactedBlockMap,
    collection: filteredCollectionMap,
    collection_view: filteredCollectionViewMap,
    collection_query: filteredCollectionQuery
  }
}
