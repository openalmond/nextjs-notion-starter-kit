/* eslint-disable simple-import-sort/imports */
import cs from 'classnames'
import dynamic from 'next/dynamic'
import NextImage from 'next/image'
import NextLegacyImage from 'next/legacy/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { type PageBlock } from 'notion-types'
import {
  formatDate,
  getBlockTitle,
  getPageTableOfContents,
  getPageProperty,
  parsePageId
} from 'notion-utils'
import * as React from 'react'
import BodyClassName from 'react-body-classname'
import {
  type NotionComponents,
  NotionRenderer,
  useNotionContext
} from 'react-notion-x'
import { EmbeddedTweet, TweetNotFound, TweetSkeleton } from 'react-tweet'
import { useSearchParam } from 'react-use'

import * as config from '@/lib/config'
import { mapImageUrl } from '@/lib/map-image-url'
import { getCanonicalPageUrl, mapPageUrl } from '@/lib/map-page-url'
import { searchNotion } from '@/lib/search-notion'
import { useDarkMode } from '@/lib/use-dark-mode'
import { isHiddenTag, tagToSlug } from '@/lib/tags'
import type * as types from '@/lib/types'

import { ClickableCollection } from './ClickableCollection'
import { Footer } from './Footer'
import { Loading } from './Loading'
import { NextLink } from './NextLink'
import { NotionPageHeader } from './NotionPageHeader'
import { Page404 } from './Page404'
import { PageAside } from './PageAside'
import { PageHead } from './PageHead'
import styles from './styles.module.css'

// -----------------------------------------------------------------------------
// dynamic imports for optional components
// -----------------------------------------------------------------------------

const Code = dynamic(() =>
  import('react-notion-x/build/third-party/code').then(async (m) => {
    // add / remove any prism syntaxes here
    await Promise.allSettled([
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-markup-templating.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-markup.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-bash.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-c.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-cpp.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-csharp.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-docker.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-java.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-js-templates.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-coffeescript.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-diff.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-git.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-go.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-graphql.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-handlebars.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-less.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-makefile.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-markdown.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-objectivec.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-ocaml.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-python.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-reason.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-rust.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-sass.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-scss.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-solidity.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-sql.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-stylus.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-swift.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-wasm.js'),
      // @ts-expect-error Ignore prisma types
      import('prismjs/components/prism-yaml.js')
    ])
    return m.Code
  })
)

const DefaultCollection = dynamic(() =>
  import('react-notion-x/build/third-party/collection').then(
    (m) => m.Collection
  ),
  { ssr: false }
)
const Equation = dynamic(() =>
  import('react-notion-x/build/third-party/equation').then((m) => m.Equation)
)
const Pdf = dynamic(
  () => import('react-notion-x/build/third-party/pdf').then((m) => m.Pdf),
  {
    ssr: false
  }
)
const Modal = dynamic(
  () =>
    import('react-notion-x/build/third-party/modal').then((m) => {
      m.Modal.setAppElement('.notion-viewport')
      return m.Modal
    }),
  {
    ssr: false
  }
)

function Tweet({ id }: { id: string }) {
  const { recordMap } = useNotionContext()
  const tweet = (recordMap as types.ExtendedTweetRecordMap)?.tweets?.[id]

  return (
    <React.Suspense fallback={<TweetSkeleton />}>
      {tweet ? <EmbeddedTweet tweet={tweet} /> : <TweetNotFound />}
    </React.Suspense>
  )
}

const propertyLastEditedTimeValue = (
  { block, pageHeader }: any,
  defaultFn: () => React.ReactNode
) => {
  if (pageHeader && block?.last_edited_time) {
    return `Last updated ${formatDate(block?.last_edited_time, {
      month: 'long'
    })}`
  }

  return defaultFn()
}

const propertyDateValue = (
  { data }: any,
  defaultFn: () => React.ReactNode
) => {
  const publishDate = data?.[0]?.[1]?.[0]?.[1]?.start_date
  if (!publishDate) return defaultFn()

  const pretty = new Date(publishDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return pretty
}

const propertyTextValue = (
  { schema, pageHeader }: any,
  defaultFn: () => React.ReactNode
) => {
  if (pageHeader && schema?.name?.toLowerCase() === 'author') {
    return <b>{defaultFn()}</b>
  }

  return defaultFn()
}

const propertySelectValue = (
  { schema, pageHeader, key: propertyKey }: any,
  defaultFn: () => React.ReactNode
) => {
  const name = schema?.name?.toLowerCase()
  const node = defaultFn()

  let textContent = ''
  if (typeof node === 'string') {
    textContent = node.trim()
  } else if (React.isValidElement(node)) {
    const child = (node as any).props?.children
    if (typeof child === 'string') {
      textContent = child.trim()
    } else if (Array.isArray(child)) {
      textContent = child.join('').trim()
    }
  }

  if (name === 'author') {
    return textContent ? (
      <span key={propertyKey} className='notion-author-inline'>
        By {textContent}
      </span>
    ) : (
      node
    )
  }

  if (name !== 'tags') return node

  if (!textContent || isHiddenTag(textContent)) return node

  // Avoid nested anchors in collection cards (card is already a link).
  if (!pageHeader) return node

  const slug = tagToSlug(textContent)
  if (!slug) return node

  return (
    <Link
      key={propertyKey}
      href={`/tag/${slug}#tag-content`}
      className='notion-tag-link'
    >
      {node}
    </Link>
  )
}

const BLOG_INDEX_PAGE_ID = '26449883313980758e9df71e17fd52bc'

export function NotionPage({
  site,
  recordMap,
  error,
  pageId,
  children
}: types.PageProps & { children?: React.ReactNode }) {
  const router = useRouter()
  const lite = useSearchParam('lite')

  const safeRecordMap = React.useMemo(() => {
    if (!recordMap?.block) return recordMap

    const safeBlockMap = Object.entries(recordMap.block).reduce(
      (acc, [rawBlockId, blockRecord]) => {
        let normalizedRecord: any = blockRecord

        // Some record maps can be double-wrapped as { value: { value: block } }.
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

        const safeBlockValue: any = {
          ...normalizedRecord.value,
          id: canonicalId
        }

        if (
          (safeBlockValue.type === 'collection_view' ||
            safeBlockValue.type === 'collection_view_page') &&
          !safeBlockValue.collection_id
        ) {
          const viewIds = safeBlockValue.view_ids as string[] | undefined

          if (viewIds?.length) {
            for (const viewId of viewIds) {
              const rawViewRecord: any = recordMap.collection_view?.[viewId]
              let normalizedViewRecord = rawViewRecord

              while (
                normalizedViewRecord?.value &&
                normalizedViewRecord?.value?.value &&
                !normalizedViewRecord?.value?.format
              ) {
                normalizedViewRecord = {
                  ...normalizedViewRecord,
                  value: normalizedViewRecord.value.value
                }
              }

              const pointerCollectionId =
                normalizedViewRecord?.value?.format?.collection_pointer?.id

              if (pointerCollectionId) {
                safeBlockValue.collection_id = pointerCollectionId
                break
              }
            }
          }
        }

        const safeBlockRecord = {
          ...normalizedRecord,
          value: safeBlockValue
        }

        acc[rawBlockId] = safeBlockRecord

        if (dashedId !== rawBlockId) {
          acc[dashedId] = safeBlockRecord
        }

        if (
          compactId !== rawBlockId &&
          compactId !== dashedId
        ) {
          acc[compactId] = safeBlockRecord
        }
        return acc
      },
      {} as typeof recordMap.block
    )

    const safeCollectionMap = Object.entries(recordMap.collection || {}).reduce(
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

        acc[collectionId] = {
          ...normalizedRecord,
          value: {
            ...normalizedRecord.value,
            schema: normalizedRecord.value.schema || {}
          }
        }
        return acc
      },
      {} as NonNullable<typeof recordMap.collection>
    )

    return {
      ...recordMap,
      block: safeBlockMap,
      collection: safeCollectionMap
    }
  }, [recordMap])

  const isBlogIndexPage = React.useMemo(
    () =>
      parsePageId(pageId) === parsePageId(BLOG_INDEX_PAGE_ID) &&
      !!BLOG_INDEX_PAGE_ID,
    [pageId]
  )

  const collectionComponent = React.useMemo(() => {
    if (!isBlogIndexPage) {
      return DefaultCollection
    }

    function BlogCollection(props: any) {
      return (
        <ClickableCollection>
          <DefaultCollection {...props} />
        </ClickableCollection>
      )
    }

    return BlogCollection
  }, [isBlogIndexPage])

  const components = React.useMemo<Partial<NotionComponents>>(
    () => {
      const notionImageComponent = config.isNextImageEnabled
        ? { nextImage: NextImage }
        : { nextLegacyImage: NextLegacyImage }

      return {
        ...notionImageComponent,
        nextLink: NextLink,
        Code,
        Collection: collectionComponent,
        Equation,
        Pdf,
        Modal,
        Tweet,
        Header: NotionPageHeader,
        propertyLastEditedTimeValue,
        propertyTextValue,
        propertyDateValue,
        propertySelectValue
      }
    },
    [collectionComponent]
  )

  // lite mode is for oembed
  const isLiteMode = lite === 'true'

  const { isDarkMode } = useDarkMode()
  const [hasMounted, setHasMounted] = React.useState(false)

  React.useEffect(() => {
    setHasMounted(true)
  }, [])

  React.useEffect(() => {
    if (!hasMounted || isLiteMode) return
    if (typeof window === 'undefined') return

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    if (prefersReducedMotion) {
      document.body.classList.remove('oa-motion')
      return
    }

    const container = document.querySelector('.notion-page-content-inner')
    if (!container) return

    const blocks = Array.from(container.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement
    )
    if (!blocks.length) return

    document.body.classList.add('oa-motion')

    for (const [index, block] of blocks.entries()) {
      block.classList.add('oa-reveal')
      block.style.setProperty('--oa-reveal-delay', `${Math.min(index * 26, 260)}ms`)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue

          const element = entry.target as HTMLElement
          element.classList.add('oa-reveal-visible')
          observer.unobserve(element)
        }
      },
      {
        root: null,
        threshold: 0.14,
        rootMargin: '0px 0px -9% 0px'
      }
    )

    for (const block of blocks) {
      observer.observe(block)
    }

    return () => {
      observer.disconnect()
      for (const block of blocks) {
        block.classList.remove('oa-reveal', 'oa-reveal-visible')
        block.style.removeProperty('--oa-reveal-delay')
      }
    }
  }, [hasMounted, isLiteMode, pageId])

  React.useEffect(() => {
    if (!hasMounted || isLiteMode) return
    if (typeof window === 'undefined') return

    const title = document.querySelector('.notion-page > .notion-title')
    if (!(title instanceof HTMLElement)) return

    title.classList.add('oa-content-title')
    const page = title.closest('.notion-page')
    let metaObserver: MutationObserver | null = null

    const getTopMetaSource = () => {
      if (!(page instanceof HTMLElement)) return null

      let sibling = title.nextElementSibling as HTMLElement | null
      while (sibling) {
        if (
          sibling.matches(
            '.notion-collection-page-properties, .notion-collection-row'
          )
        ) {
          return sibling
        }

        if (sibling.matches('.notion-page-content, .notion-page-content-inner')) {
          break
        }

        sibling = sibling.nextElementSibling as HTMLElement | null
      }

      return page.querySelector(
        '.notion-collection-page-properties, .notion-collection-row'
      ) as HTMLElement | null
    }

    const collectMetaValues = (metaSource: HTMLElement) => {
      const propertyRows = Array.from(
        metaSource.querySelectorAll('.notion-collection-row-property')
      )

      const values = propertyRows.flatMap((propertyRow) => {
        const chips = Array.from(
          propertyRow.querySelectorAll(
            '.notion-tag-link, .notion-property-select-item, .notion-property-multi_select-item, .notion-property-status-item'
          )
        )
          .map((node) => node.textContent?.trim() || '')
          .filter(Boolean)
        if (chips.length) return chips

        const prioritized =
          propertyRow.querySelector(
            '.notion-property-date, .notion-property-created_time, .notion-property-last_edited_time, .notion-author-inline'
          ) ||
          propertyRow.querySelector('.notion-collection-row-value')

        const text = prioritized?.textContent?.replaceAll(/\s+/g, ' ').trim()
        return text ? [text] : []
      })

      return [...new Set(values)]
        .map((value) => value.replaceAll(/\s+/g, ' ').trim())
        .filter(
          (value) =>
            !!value &&
            value.length <= 52 &&
            !/^tags?$/i.test(value) &&
            !/^author$/i.test(value)
        )
        .slice(0, 8)
    }

    const renderMetaRail = () => {
      const existingMetaRail = title.querySelector(
        ':scope > .oa-content-title-meta'
      )
      if (existingMetaRail instanceof HTMLElement) existingMetaRail.remove()

      const metaSource = getTopMetaSource()
      if (!metaSource) return false

      const metaValues = collectMetaValues(metaSource)
      if (!metaValues.length) return false

      let textWrapper = title.querySelector(
        ':scope > .oa-content-title-text'
      ) as HTMLElement | null

      if (!textWrapper) {
        textWrapper = document.createElement('span')
        textWrapper.className = 'oa-content-title-text'
        while (title.firstChild) {
          textWrapper.append(title.firstChild)
        }
        title.append(textWrapper)
      }

      const metaRail = document.createElement('span')
      metaRail.className = 'oa-content-title-meta'
      for (const value of metaValues) {
        const chip = document.createElement('span')
        chip.className = 'oa-content-title-meta-item'
        chip.textContent = value
        metaRail.append(chip)
      }
      title.append(metaRail)
      return true
    }

    if (!renderMetaRail() && page instanceof HTMLElement) {
      metaObserver = new MutationObserver(() => {
        if (!renderMetaRail()) return
        metaObserver?.disconnect()
        metaObserver = null
      })

      metaObserver.observe(page, {
        childList: true,
        subtree: true
      })
    }

    const sentinel = document.createElement('div')
    sentinel.className = 'oa-title-sentinel'
    title.parentElement?.insertBefore(sentinel, title)

    const getHeaderOffset = () => {
      const header = document.querySelector('.notion-header')
      if (!(header instanceof HTMLElement)) return 66
      return Math.max(48, header.offsetHeight + 6)
    }

    let observer: IntersectionObserver | null = null
    const observe = () => {
      if (observer) observer.disconnect()

      observer = new IntersectionObserver(
        (entries) => {
          const isIntersecting = entries[0]?.isIntersecting
          document.body.classList.toggle('oa-title-stuck', !isIntersecting)
        },
        {
          root: null,
          threshold: 0,
          rootMargin: `-${getHeaderOffset()}px 0px 0px 0px`
        }
      )

      observer.observe(sentinel)
    }

    observe()

    const onResize = () => observe()
    window.addEventListener('resize', onResize)

    return () => {
      observer?.disconnect()
      metaObserver?.disconnect()
      window.removeEventListener('resize', onResize)
      document.body.classList.remove('oa-title-stuck')

      const textWrapper = title.querySelector(
        ':scope > .oa-content-title-text'
      ) as HTMLElement | null
      if (textWrapper) {
        while (textWrapper.firstChild) {
          title.insertBefore(textWrapper.firstChild, textWrapper)
        }
        textWrapper.remove()
      }

      const metaRail = title.querySelector(
        ':scope > .oa-content-title-meta'
      ) as HTMLElement | null
      metaRail?.remove()

      title.classList.remove('oa-content-title')
      sentinel.remove()
    }
  }, [hasMounted, isLiteMode, pageId])

  const resolvedDarkMode = hasMounted ? isDarkMode : false

  const siteMapPageUrl = React.useMemo(() => {
    const params: any = {}
    if (lite) params.lite = lite

    const searchParams = new URLSearchParams(params)
    return site ? mapPageUrl(site, safeRecordMap!, searchParams) : undefined
  }, [site, safeRecordMap, lite])

  const resolvedPageId = parsePageId(pageId, { uuid: true })
  const fallbackBlockId = Object.keys(safeRecordMap?.block || {})[0]
  const blockId = resolvedPageId || fallbackBlockId
  const block = blockId
    ? ((safeRecordMap?.block?.[blockId] as any)?.value as any)
    : undefined

  // const isRootPage =
  //   parsePageId(block?.id) === parsePageId(site?.rootNotionPageId)
  const isBlogPost =
    block?.type === 'page' && block?.parent_table === 'collection'

  const hasValidTocIds = React.useMemo(() => {
    if (!safeRecordMap || !block || block.type !== 'page') return false

    try {
      const toc = getPageTableOfContents(block as PageBlock, safeRecordMap) || []
      return toc.every((item) => typeof item?.id === 'string' && !!item.id)
    } catch {
      return false
    }
  }, [block, safeRecordMap])

  const showTableOfContents =
    !!isBlogPost && !isBlogIndexPage && hasValidTocIds
  const minTableOfContentsItems = 3

  const pageAside = React.useMemo(
    () => (
      <PageAside
        block={block!}
        recordMap={safeRecordMap!}
        isBlogPost={isBlogPost}
      />
    ),
    [block, safeRecordMap, isBlogPost]
  )

  if (router.isFallback) {
    return <Loading />
  }

  if (error || !site || !safeRecordMap || !block) {
    return <Page404 site={site} pageId={pageId} error={error} />
  }

  const title = getBlockTitle(block, safeRecordMap) || site.name

  const canonicalPageUrl = config.isDev
    ? undefined
    : getCanonicalPageUrl(site, safeRecordMap)(pageId)

  const socialImage = mapImageUrl(
    getPageProperty<string>('Social Image', block, safeRecordMap) ||
      (block as PageBlock).format?.page_cover ||
      config.defaultPageCover,
    block
  )

  const socialDescription =
    getPageProperty<string>('Description', block, safeRecordMap) ||
    config.description
  const rawTags = getPageProperty<string | string[]>('Tags', block, safeRecordMap)
  const tagList = Array.isArray(rawTags)
    ? rawTags
    : typeof rawTags === 'string'
    ? rawTags.split(',')
    : []
  const seoKeywords = [
    ...new Set(
      tagList
        .map((tag) => tag?.trim())
        .filter((tag): tag is string => !!tag && !isHiddenTag(tag))
    )
  ]

  const publishedProp =
    getPageProperty<number | string>('Published', block, safeRecordMap) ||
    getPageProperty<number | string>('Date', block, safeRecordMap)
  const publishedDate = publishedProp ? new Date(publishedProp) : null
  const publishedTime =
    publishedDate && !Number.isNaN(publishedDate.getTime())
      ? publishedDate.toISOString()
      : undefined

  const editedDate = block?.last_edited_time
    ? new Date(block.last_edited_time)
    : null
  const modifiedTime =
    editedDate && !Number.isNaN(editedDate.getTime())
      ? editedDate.toISOString()
      : undefined

  return (
    <>
      <PageHead
        pageId={pageId}
        site={site}
        title={title}
        description={socialDescription}
        image={socialImage}
        url={canonicalPageUrl}
        isBlogPost={isBlogPost}
        keywords={seoKeywords}
        publishedTime={publishedTime}
        modifiedTime={modifiedTime}
      />

      {isLiteMode && <BodyClassName className='notion-lite' />}
      {resolvedDarkMode && <BodyClassName className='dark-mode' />}

      <div className={styles.notionFrame}>
        <NotionRenderer
          blockId={resolvedPageId || pageId}
          bodyClassName={cs(
            styles.notion,
            pageId === site.rootNotionPageId && 'index-page'
          )}
          darkMode={resolvedDarkMode}
          components={components}
          recordMap={safeRecordMap}
          rootPageId={site.rootNotionPageId}
          rootDomain={site.domain}
          fullPage={!isLiteMode}
          previewImages={!!safeRecordMap.preview_images}
          showCollectionViewDropdown={false}
          showTableOfContents={showTableOfContents}
          minTableOfContentsItems={minTableOfContentsItems}
          defaultPageIcon={config.defaultPageIcon}
          defaultPageCover={config.defaultPageCover}
          defaultPageCoverPosition={config.defaultPageCoverPosition}
          mapPageUrl={siteMapPageUrl}
          mapImageUrl={mapImageUrl}
          searchNotion={config.isSearchEnabled ? searchNotion : undefined}
          pageAside={pageAside}
          footer={
            <>
              {children ? <div className='tag-injected'>{children}</div> : null}
              <Footer />
            </>
          }
        />
      </div>
    </>
  )
}
