import ky from 'ky'
import lqip from 'lqip-modern'
import {
  type ExtendedRecordMap,
  type PreviewImage,
  type PreviewImageMap
} from 'notion-types'
import { getPageImageUrls, normalizeUrl } from 'notion-utils'
import pMap from 'p-map'
import pMemoize from 'p-memoize'

import { defaultPageCover, defaultPageIcon } from './config'
import { db } from './db'
import { mapImageUrl } from './map-image-url'

export async function getPreviewImageMap(
  recordMap: ExtendedRecordMap
): Promise<PreviewImageMap> {
  const rawUrls = getPageImageUrls(recordMap, {
    mapImageUrl
  })
    .concat([defaultPageIcon, defaultPageCover].filter(Boolean))
    .filter(Boolean)

  const previewUrlMap = rawUrls.reduce((acc, url) => {
    if (!isSupportedPreviewUrl(url)) return acc

    const cacheKey = normalizeUrl(url)
    if (!cacheKey || acc.has(cacheKey)) return acc

    acc.set(cacheKey, url)
    return acc
  }, new Map<string, string>())

  const previewEntries = await pMap(
    [...previewUrlMap.entries()],
    async ([cacheKey, url]) => {
      const previewImage = await getPreviewImage(url, { cacheKey })
      return previewImage ? [cacheKey, previewImage] : null
    },
    {
      concurrency: 8
    }
  )

  return Object.fromEntries(
    previewEntries.filter(
      (entry): entry is [string, PreviewImage] => entry !== null
    )
  )
}

async function createPreviewImage(
  url: string,
  { cacheKey }: { cacheKey: string }
): Promise<PreviewImage | null> {
  try {
    try {
      const cachedPreviewImage = await db.get(cacheKey)
      if (cachedPreviewImage) {
        return cachedPreviewImage
      }
    } catch (err: any) {
      // ignore redis errors
      console.warn(`redis error get "${cacheKey}"`, err.message)
    }

    const body = await ky(url).arrayBuffer()
    const result = await lqip(body)

    const previewImage = {
      originalWidth: result.metadata.originalWidth,
      originalHeight: result.metadata.originalHeight,
      dataURIBase64: result.metadata.dataURIBase64
    }

    try {
      await db.set(cacheKey, previewImage)
    } catch (err: any) {
      // ignore redis errors
      console.warn(`redis error set "${cacheKey}"`, err.message)
    }

    return previewImage
  } catch (err: any) {
    console.warn('failed to create preview image', url, err.message)
    return null
  }
}

export const getPreviewImage = pMemoize(createPreviewImage)

function isSupportedPreviewUrl(url: string): boolean {
  if (!url) return false
  if (!/^https?:\/\//i.test(url)) return false

  // Notion custom emoji "image" URLs frequently 404 and don't benefit from LQIP.
  if (
    url.includes('notion%3A%2F%2Fcustom_emoji%2F') ||
    url.includes('notion://custom_emoji/')
  ) {
    return false
  }

  return true
}
