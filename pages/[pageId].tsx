import { type GetStaticProps } from 'next'

import { NotionPage } from '@/components/NotionPage'
import { domain, isDev, pageUrlAdditions } from '@/lib/config'
import { getSiteMap } from '@/lib/get-site-map'
import { resolveNotionPage } from '@/lib/resolve-notion-page'
import { type PageProps, type Params } from '@/lib/types'

export const getStaticProps: GetStaticProps<PageProps, Params> = async (
  context
) => {
  const rawPageId = context.params?.pageId as string

  try {
    const props = await resolveNotionPage(domain, rawPageId)

    return { props, revalidate: 10 }
  } catch (err) {
    console.error('page error', domain, rawPageId, err)

    // we don't want to publish the error version of this page, so
    // let next.js know explicitly that incremental SSG failed
    throw err
  }
}

export async function getStaticPaths() {
  if (isDev) {
    return {
      paths: [],
      fallback: true
    }
  }

  const siteMap = await getSiteMap()
  const hexPageIdRe = /^[a-f0-9]{32}$/

  const staticPaths = {
    paths: [
      ...Object.keys(siteMap.canonicalPageMap)
      .filter((canonicalPageId) => {
        const notionPageId = siteMap.canonicalPageMap[canonicalPageId]
        const recordMap = notionPageId ? siteMap.pageMap?.[notionPageId] : null
        const isRawPageId = hexPageIdRe.test(canonicalPageId)
        const isCollectionIndexPage =
          !!recordMap && Object.keys(recordMap.collection || {}).length > 0

        // Skip raw database-index routes; these can crash prerender while
        // slug routes for attached pages still build correctly.
        return !(isRawPageId && isCollectionIndexPage)
      })
      .map((pageId) => ({
        params: {
          pageId
        }
      })),
      ...Object.keys(pageUrlAdditions).map((pageId) => ({
        params: {
          pageId
        }
      }))
    ],
    // paths: [],
    fallback: true
  }

  console.log(staticPaths.paths)
  return staticPaths
}

export default function NotionDomainDynamicPage(props: PageProps) {
  return <NotionPage {...props} />
}
