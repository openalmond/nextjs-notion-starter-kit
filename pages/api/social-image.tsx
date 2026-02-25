import ky from 'ky'
import { type NextApiRequest, type NextApiResponse } from 'next'
import { ImageResponse } from 'next/og'
import { type PageBlock } from 'notion-types'
import {
  getBlockIcon,
  getBlockTitle,
  getPageProperty,
  isUrl,
  parsePageId
} from 'notion-utils'

import * as libConfig from '@/lib/config'
import interSemiBoldFont from '@/lib/fonts/inter-semibold'
import { mapImageUrl } from '@/lib/map-image-url'
import { notion } from '@/lib/notion-api'
import { type NotionPageInfo, type PageError } from '@/lib/types'

export const runtime = 'edge'

const truncate = (value: string | undefined, maxLength: number): string => {
  if (!value) return ''
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`
}

export default async function OGImage(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { searchParams } = new URL(req.url!)
  const pageId = parsePageId(
    searchParams.get('id') || libConfig.rootNotionPageId
  )
  if (!pageId) {
    return new Response('Invalid notion page id', { status: 400 })
  }

  const pageInfoOrError = await getNotionPageInfo({ pageId })
  if (pageInfoOrError.type === 'error') {
    return res.status(pageInfoOrError.error.statusCode).send({
      error: pageInfoOrError.error.message
    })
  }
  const pageInfo = pageInfoOrError.data
  const cardTitle = truncate(pageInfo.title, 96)
  const cardDescription = truncate(pageInfo.description, 190)
  const cardDetail = truncate(pageInfo.detail, 72)

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: '#0f172a',
          backgroundImage:
            'linear-gradient(140deg, #0b1220 0%, #12233b 55%, #0d1a2e 100%)',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e5e7eb'
        }}
      >
        {pageInfo.image && (
          <img
            src={pageInfo.image}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.18
            }}
          />
        )}

        <div
          style={{
            position: 'relative',
            width: 1080,
            height: 540,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: 28,
            zIndex: '1'
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              background:
                'linear-gradient(180deg, rgba(2,6,23,0.78) 0%, rgba(2,6,23,0.92) 100%)',
              borderRadius: 28
            }}
          />

          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '42px 52px',
              fontFamily: 'Inter'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 22,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: '#c7d2fe'
                }}
              >
                Open Almond Studios
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 18,
                  color: '#cbd5e1'
                }}
              >
                {libConfig.domain}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 20
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 64,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  color: '#f8fafc',
                  maxHeight: 220,
                  overflow: 'hidden'
                }}
              >
                {cardTitle}
              </div>

              {cardDescription && (
                <div
                  style={{
                    display: 'flex',
                    fontSize: 30,
                    lineHeight: 1.3,
                    color: '#cbd5e1',
                    maxHeight: 128,
                    overflow: 'hidden'
                  }}
                >
                  {cardDescription}
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14
                }}
              >
                {pageInfo.authorImage && (
                  <div
                    style={{
                      display: 'flex',
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '2px solid rgba(255,255,255,0.5)'
                    }}
                  >
                    <img
                      src={pageInfo.authorImage}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    fontSize: 24,
                    color: '#e2e8f0'
                  }}
                >
                  {cardDetail || pageInfo.author || libConfig.author}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  fontSize: 20,
                  color: '#93c5fd',
                  letterSpacing: '0.02em'
                }}
              >
                openalmond.com
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Inter',
          data: interSemiBoldFont,
          style: 'normal',
          weight: 700
        }
      ]
    }
  )
}

export async function getNotionPageInfo({
  pageId
}: {
  pageId: string
}): Promise<
  | { type: 'success'; data: NotionPageInfo }
  | { type: 'error'; error: PageError }
> {
  const recordMap = await notion.getPage(pageId)

  const keys = Object.keys(recordMap?.block || {})
  const block = (recordMap?.block?.[keys[0]!] as any)?.value as any

  if (!block) {
    throw new Error('Invalid recordMap for page')
  }

  const blockSpaceId = block.space_id

  if (
    blockSpaceId &&
    libConfig.rootNotionSpaceId &&
    blockSpaceId !== libConfig.rootNotionSpaceId
  ) {
    return {
      type: 'error',
      error: {
        statusCode: 400,
        message: `Notion page "${pageId}" belongs to a different workspace.`
      }
    }
  }

  const isBlogPost =
    block.type === 'page' && block.parent_table === 'collection'
  const title = getBlockTitle(block, recordMap) || libConfig.name

  const imageCoverPosition =
    (block as PageBlock).format?.page_cover_position ??
    libConfig.defaultPageCoverPosition
  const imageObjectPosition = imageCoverPosition
    ? `center ${(1 - imageCoverPosition) * 100}%`
    : undefined

  const imageBlockUrl = mapImageUrl(
    getPageProperty<string>('Social Image', block, recordMap) ||
      (block as PageBlock).format?.page_cover,
    block
  )
  const imageFallbackUrl = mapImageUrl(libConfig.defaultPageCover, block)

  const blockIcon = getBlockIcon(block, recordMap)
  const authorImageBlockUrl = mapImageUrl(
    blockIcon && isUrl(blockIcon) ? blockIcon : undefined,
    block
  )
  const authorImageFallbackUrl = mapImageUrl(libConfig.defaultPageIcon, block)
  const [authorImage, image] = await Promise.all([
    getCompatibleImageUrl(authorImageBlockUrl, authorImageFallbackUrl),
    getCompatibleImageUrl(imageBlockUrl, imageFallbackUrl)
  ])

  const author =
    getPageProperty<string>('Author', block, recordMap) || libConfig.author

  const description =
    getPageProperty<string>('Summary', block, recordMap) ||
    getPageProperty<string>('Description', block, recordMap) ||
    libConfig.description

  // const lastUpdatedTime = getPageProperty<number>(
  //   'Last Updated',
  //   block,
  //   recordMap
  // )
  const publishedTime = getPageProperty<number>('Published', block, recordMap)
  const datePublished = publishedTime ? new Date(publishedTime) : undefined
  // const dateUpdated = lastUpdatedTime
  //   ? new Date(lastUpdatedTime)
  //   : publishedTime
  //   ? new Date(publishedTime)
  //   : undefined
  const date =
    isBlogPost && datePublished
      ? `${datePublished.toLocaleString('en-US', {
          month: 'long'
        })} ${datePublished.getFullYear()}`
      : undefined
  const detail = date || author || libConfig.domain

  const pageInfo: NotionPageInfo = {
    pageId,
    title,
    description,
    image,
    imageObjectPosition,
    author,
    authorImage,
    detail
  }

  return {
    type: 'success',
    data: pageInfo
  }
}

async function isUrlReachable(
  url: string | undefined | null
): Promise<boolean> {
  if (!url) {
    return false
  }

  try {
    await ky.head(url)
    return true
  } catch {
    return false
  }
}

async function getCompatibleImageUrl(
  url: string | undefined | null,
  fallbackUrl: string | undefined | null
): Promise<string | undefined> {
  const image = (await isUrlReachable(url)) ? url : fallbackUrl

  if (image) {
    const imageUrl = new URL(image)

    if (imageUrl.host === 'images.unsplash.com') {
      if (!imageUrl.searchParams.has('w')) {
        imageUrl.searchParams.set('w', '1200')
        imageUrl.searchParams.set('fit', 'max')
        return imageUrl.toString()
      }
    }
  }

  return image ?? undefined
}
