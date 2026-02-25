import {
  type ExtendedRecordMap,
  type SearchParams,
  type SearchResults
} from 'notion-types'
import { mergeRecordMaps, parsePageId } from 'notion-utils'
import pMap from 'p-map'
import pMemoize from 'p-memoize'

import {
  collectionRowHydrationLimit,
  collectionRowHydrationLimits,
  isPreviewImageSupportEnabled,
  navigationLinks,
  navigationStyle
} from './config'
import { getTweetsMap } from './get-tweets'
import { normalizeRecordMap } from './normalize-record-map'
import { notion } from './notion-api'
import { getPreviewImageMap } from './preview-images'

const getNavigationLinkPages = pMemoize(
  async (): Promise<ExtendedRecordMap[]> => {
    const navigationLinkPageIds = (navigationLinks || [])
      .map((link) => link?.pageId)
      .filter(Boolean)

    if (navigationStyle !== 'default' && navigationLinkPageIds.length) {
      return pMap(
        navigationLinkPageIds,
        async (navigationLinkPageId) =>
          notion.getPage(navigationLinkPageId, {
            chunkLimit: 1,
            fetchMissingBlocks: false,
            fetchCollections: false,
            signFileUrls: false
          }),
        {
          concurrency: 4
        }
      )
    }

    return []
  }
)

const hydrateCollectionRowBlocks = async (
  recordMap: ExtendedRecordMap,
  pageId: string
): Promise<ExtendedRecordMap> => {
  const blockMap = recordMap.block || {}
  const queryMap = recordMap.collection_query || {}
  const missingPageIds = new Set<string>()

  for (const views of Object.values(queryMap)) {
    for (const viewResult of Object.values(views || {})) {
      const blockIds: string[] = (viewResult as any)?.collection_group_results
        ?.blockIds || []

      for (const blockId of blockIds) {
        const normalizedPageId = parsePageId(blockId, { uuid: true })
        if (!normalizedPageId) continue
        if (blockMap[normalizedPageId]) continue
        missingPageIds.add(normalizedPageId)
      }
    }
  }

  if (!missingPageIds.size) {
    return recordMap
  }

  const orderedMissingPageIds = [...missingPageIds].sort()
  const normalizedPageId = parsePageId(pageId, { uuid: false })
  const pageSpecificHydrationLimit = normalizedPageId
    ? collectionRowHydrationLimits[normalizedPageId]
    : undefined
  const effectiveHydrationLimit =
    pageSpecificHydrationLimit ?? collectionRowHydrationLimit

  const shouldCapHydration =
    typeof effectiveHydrationLimit === 'number' && effectiveHydrationLimit > 0

  const hydrationCap = shouldCapHydration ? effectiveHydrationLimit! : undefined

  const rowPageIds = shouldCapHydration
    ? orderedMissingPageIds.slice(0, hydrationCap)
    : orderedMissingPageIds

  if (shouldCapHydration && rowPageIds.length < orderedMissingPageIds.length) {
    console.warn('collection row hydration capped', {
      pageId: normalizedPageId || pageId,
      cap: hydrationCap,
      hydratedRows: rowPageIds.length,
      skippedRows: orderedMissingPageIds.length - rowPageIds.length,
      source:
        typeof pageSpecificHydrationLimit === 'number' ? 'page-specific' : 'global'
    })
  }

  const rowRecordMaps = await pMap(
    rowPageIds,
    async (rowPageId) => {
      try {
        return await notion.getPage(rowPageId, {
          fetchCollections: false,
          signFileUrls: false
        })
      } catch (err: any) {
        console.warn('warning failed to hydrate collection row', {
          rowPageId,
          message: err?.message
        })
        return null
      }
    },
    { concurrency: 6 }
  )

  return rowRecordMaps.filter(Boolean).reduce(
    (map, rowRecordMap) => mergeRecordMaps(map, rowRecordMap as ExtendedRecordMap),
    recordMap
  )
}

export async function getPage(pageId: string): Promise<ExtendedRecordMap> {
  let recordMap = normalizeRecordMap(await notion.getPage(pageId))
  recordMap = await hydrateCollectionRowBlocks(recordMap, pageId)

  if (navigationStyle !== 'default') {
    // ensure that any pages linked to in the custom navigation header have
    // their block info fully resolved in the page record map so we know
    // the page title, slug, etc.
    const navigationLinkRecordMaps = await getNavigationLinkPages()

    if (navigationLinkRecordMaps?.length) {
      recordMap = navigationLinkRecordMaps.reduce(
        (map, navigationLinkRecordMap) =>
          mergeRecordMaps(map, normalizeRecordMap(navigationLinkRecordMap)),
        recordMap
      )
    }
  }

  if (isPreviewImageSupportEnabled) {
    const previewImageMap = await getPreviewImageMap(recordMap)
    ;(recordMap as any).preview_images = previewImageMap
  }

  await getTweetsMap(recordMap)

  return recordMap
}

export async function search(params: SearchParams): Promise<SearchResults> {
  return notion.search(params)
}
