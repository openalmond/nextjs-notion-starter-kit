import {
  type ExtendedRecordMap,
  type SearchParams,
  type SearchResults
} from 'notion-types'
import { mergeRecordMaps, parsePageId } from 'notion-utils'
import pMap from 'p-map'
import pMemoize from 'p-memoize'

import {
  isPreviewImageSupportEnabled,
  navigationLinks,
  navigationStyle
} from './config'
import { getTweetsMap } from './get-tweets'
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
  recordMap: ExtendedRecordMap
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

  const rowRecordMaps = await pMap(
    [...missingPageIds],
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
  let recordMap = await notion.getPage(pageId)
  recordMap = await hydrateCollectionRowBlocks(recordMap)

  if (navigationStyle !== 'default') {
    // ensure that any pages linked to in the custom navigation header have
    // their block info fully resolved in the page record map so we know
    // the page title, slug, etc.
    const navigationLinkRecordMaps = await getNavigationLinkPages()

    if (navigationLinkRecordMaps?.length) {
      recordMap = navigationLinkRecordMaps.reduce(
        (map, navigationLinkRecordMap) =>
          mergeRecordMaps(map, navigationLinkRecordMap),
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
