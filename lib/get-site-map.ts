import {
  getAllPagesInSpace,
  getPageProperty,
  parsePageId,
  uuidToId
} from 'notion-utils'
import pMemoize from 'p-memoize'

import type * as types from './types'
import * as config from './config'
import { includeNotionIdInUrls } from './config'
import { getCanonicalPageId } from './get-canonical-page-id'
import { normalizeRecordMap } from './normalize-record-map'
import { notion } from './notion-api'

const uuid = !!includeNotionIdInUrls

export async function getSiteMap(): Promise<types.SiteMap> {
  const partialSiteMap = await getAllPages(
    config.rootNotionPageId,
    config.rootNotionSpaceId ?? undefined
  )

  return {
    site: config.site,
    ...partialSiteMap
  } as types.SiteMap
}

const getAllPages = pMemoize(getAllPagesImpl, {
  cacheKey: (...args) => JSON.stringify(args)
})

const getPage = async (pageId: string, opts?: any) => {
  console.log('\nnotion getPage', uuidToId(pageId))
  const recordMap = await notion.getPage(pageId, {
    kyOptions: {
      timeout: 30_000
    },
    ...opts
  })
  return normalizeRecordMap(recordMap)
}

async function getAllPagesImpl(
  rootNotionPageId: string,
  rootNotionSpaceId?: string,
  {
    // Depth 2 ensures collection-attached pages are crawled reliably.
    maxDepth = 2
  }: {
    maxDepth?: number
  } = {}
): Promise<Partial<types.SiteMap>> {
  const pageMap = await getAllPagesInSpace(
    rootNotionPageId,
    rootNotionSpaceId,
    getPage,
    {
      maxDepth
    }
  )

  // Explicitly crawl collection rows so attached database pages are included.
  const extraPageIds = new Set<string>()
  for (const recordMap of Object.values(pageMap)) {
    const collectionIds = Array.from(
      new Set(
        Object.keys(recordMap?.collection ?? {})
          .map((id) => parsePageId(id, { uuid: true }))
          .filter(Boolean)
      )
    ) as string[]
    const collectionViewIds = Array.from(
      new Set(
        Object.keys(recordMap?.collection_view ?? {})
          .map((id) => parsePageId(id, { uuid: true }))
          .filter(Boolean)
      )
    ) as string[]

    for (const collectionId of collectionIds) {
      for (const collectionViewId of collectionViewIds) {
        try {
          const collectionData = await notion.getCollectionData(
            collectionId,
            collectionViewId,
            undefined,
            { limit: 1000 }
          )

          const blockIds: string[] =
            collectionData?.result?.blockIds ??
            collectionData?.result?.reducerResults?.collection_group_results
              ?.blockIds ??
            []

          for (const blockId of blockIds) {
            const pageId = parsePageId(blockId, { uuid: true })
            if (pageId && !pageMap[pageId]) {
              extraPageIds.add(pageId)
            }
          }
        } catch (err: any) {
          console.warn('warning failed to crawl collection rows', {
            collectionId,
            collectionViewId,
            message: err?.message
          })
        }
      }
    }
  }

  for (const pageId of extraPageIds) {
    try {
      pageMap[pageId] = await getPage(pageId, {
        fetchCollections: false,
        signFileUrls: false
      })
    } catch (err: any) {
      console.warn('warning failed to load attached page', {
        pageId,
        message: err?.message
      })
    }
  }

  const canonicalPageMap = Object.keys(pageMap).reduce(
    (map: Record<string, string>, pageId: string) => {
      const recordMap = pageMap[pageId]
      if (!recordMap) {
        throw new Error(`Error loading page "${pageId}"`)
      }

      const block = recordMap.block[pageId]?.value
      if (
        !(getPageProperty<boolean | null>('Public', block!, recordMap) ?? true)
      ) {
        return map
      }

      const canonicalPageId = getCanonicalPageId(pageId, recordMap, {
        uuid
      })
      if (!canonicalPageId) {
        console.warn('warning skipping page with invalid canonical id', {
          pageId
        })
        return map
      }

      if (map[canonicalPageId]) {
        // you can have multiple pages in different collections that have the same id
        // TODO: we may want to error if neither entry is a collection page
        console.warn('error duplicate canonical page id', {
          canonicalPageId,
          pageId,
          existingPageId: map[canonicalPageId]
        })

        return map
      } else {
        return {
          ...map,
          [canonicalPageId]: pageId
        }
      }
    },
    {}
  )

  return {
    pageMap,
    canonicalPageMap
  }
}
