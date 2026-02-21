import { type ExtendedRecordMap } from 'notion-types'
import { parsePageId } from 'notion-utils'

function normalizeBlockMap(blockMap: ExtendedRecordMap['block']) {
  const safeBlockMap = Object.entries(blockMap || {}).reduce(
    (acc, [rawBlockId, blockRecord]) => {
      let normalizedRecord: any = blockRecord

      while (
        normalizedRecord?.value &&
        normalizedRecord?.value?.value &&
        !normalizedRecord?.value?.type
      ) {
        normalizedRecord = normalizedRecord.value
      }

      if (!normalizedRecord?.value && normalizedRecord?.type) {
        normalizedRecord = {
          id: rawBlockId,
          role: 'reader',
          value: normalizedRecord
        }
      }

      if (!normalizedRecord?.value) {
        acc[rawBlockId] = normalizedRecord
        return acc
      }

      const parsedValueId = parsePageId(normalizedRecord.value.id, {
        uuid: true
      })
      const parsedRawId = parsePageId(rawBlockId, { uuid: true })
      const canonicalId = parsedValueId || parsedRawId || rawBlockId
      const dashedId = parsePageId(canonicalId, { uuid: true }) || canonicalId
      const compactId =
        parsePageId(canonicalId, { uuid: false }) ||
        canonicalId.replaceAll('-', '')

      const safeBlockRecord = {
        ...normalizedRecord,
        value: {
          ...normalizedRecord.value,
          id: canonicalId
        }
      }

      acc[rawBlockId] = safeBlockRecord
      acc[dashedId] = safeBlockRecord
      acc[compactId] = safeBlockRecord

      return acc
    },
    {} as NonNullable<ExtendedRecordMap['block']>
  )

  return safeBlockMap
}

function normalizeCollectionMap(collectionMap: ExtendedRecordMap['collection']) {
  return Object.entries(collectionMap || {}).reduce(
    (acc, [collectionId, collectionRecord]) => {
      let normalizedRecord: any = collectionRecord

      while (
        normalizedRecord?.value &&
        normalizedRecord?.value?.value &&
        !normalizedRecord?.value?.schema
      ) {
        normalizedRecord = {
          ...normalizedRecord,
          value: normalizedRecord.value.value
        }
      }

      if (!normalizedRecord?.value) {
        acc[collectionId] = normalizedRecord
        return acc
      }

      const canonicalId =
        parsePageId(normalizedRecord?.value?.id, { uuid: true }) ||
        parsePageId(collectionId, { uuid: true }) ||
        collectionId
      const dashedId = parsePageId(canonicalId, { uuid: true }) || canonicalId
      const compactId =
        parsePageId(canonicalId, { uuid: false }) ||
        canonicalId.replaceAll('-', '')

      const safeCollectionRecord = {
        ...normalizedRecord,
        value: {
          ...normalizedRecord.value,
          id: canonicalId,
          schema: normalizedRecord.value.schema || {}
        }
      }

      acc[collectionId] = safeCollectionRecord
      acc[dashedId] = safeCollectionRecord
      acc[compactId] = safeCollectionRecord

      return acc
    },
    {} as NonNullable<ExtendedRecordMap['collection']>
  )
}

function normalizeCollectionViewMap(
  collectionViewMap: ExtendedRecordMap['collection_view']
) {
  return Object.entries(collectionViewMap || {}).reduce(
    (acc, [viewId, viewRecord]) => {
      let normalizedRecord: any = viewRecord

      while (
        normalizedRecord?.value &&
        normalizedRecord?.value?.value &&
        !normalizedRecord?.value?.type
      ) {
        normalizedRecord = {
          ...normalizedRecord,
          value: normalizedRecord.value.value
        }
      }

      acc[viewId] = normalizedRecord
      return acc
    },
    {} as NonNullable<ExtendedRecordMap['collection_view']>
  )
}

export function normalizeRecordMap(
  recordMap: ExtendedRecordMap
): ExtendedRecordMap {
  if (!recordMap) return recordMap

  return {
    ...recordMap,
    block: normalizeBlockMap(recordMap.block),
    collection: normalizeCollectionMap(recordMap.collection),
    collection_view: normalizeCollectionViewMap(recordMap.collection_view)
  }
}
