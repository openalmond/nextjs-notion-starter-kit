import type { GetServerSideProps } from 'next'

import type { SiteMap } from '@/lib/types'
import { host } from '@/lib/config'
import { getSiteMap } from '@/lib/get-site-map'

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.write(JSON.stringify({ error: 'method not allowed' }))
    res.end()
    return {
      props: {}
    }
  }

  const siteMap = await getSiteMap()

  // cache for up to 8 hours
  res.setHeader(
    'Cache-Control',
    'public, max-age=28800, stale-while-revalidate=28800'
  )
  res.setHeader('Content-Type', 'text/xml')
  res.write(createSitemap(siteMap))
  res.end()

  return {
    props: {}
  }
}

const createSitemap = (siteMap: SiteMap) =>
  `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${createSitemapUrls(siteMap).join('\n')}
  </urlset>
`

function createSitemapUrls(siteMap: SiteMap): string[] {
  const entries: Array<{
    url: string
    lastmod?: string
    priority?: string
  }> = [
    {
      url: `${host}/`,
      priority: '1.0'
    }
  ]

  for (const canonicalPagePath of Object.keys(siteMap.canonicalPageMap)) {
    const pageId = siteMap.canonicalPageMap[canonicalPagePath]
    if (!pageId) continue

    const recordMap: any = siteMap.pageMap?.[pageId]
    const block =
      recordMap?.block?.[pageId]?.value ??
      recordMap?.block?.[Object.keys(recordMap?.block || {})[0]!]?.value
    const lastEditedTime = block?.last_edited_time
    const lastmod =
      typeof lastEditedTime === 'number'
        ? new Date(lastEditedTime).toISOString()
        : undefined

    entries.push({
      url: `${host}/${canonicalPagePath}`,
      lastmod,
      priority: '0.7'
    })
  }

  const deduped = new Map<string, { lastmod?: string; priority?: string }>()
  for (const entry of entries) {
    if (!deduped.has(entry.url)) {
      deduped.set(entry.url, {
        lastmod: entry.lastmod,
        priority: entry.priority
      })
    }
  }

  return Array.from(deduped.entries()).map(([url, meta]) => {
    const escapedUrl = escapeXml(url)
    const lastmodTag = meta.lastmod ? `\n      <lastmod>${meta.lastmod}</lastmod>` : ''
    const priorityTag = meta.priority
      ? `\n      <priority>${meta.priority}</priority>`
      : ''
    return `<url>
      <loc>${escapedUrl}</loc>${lastmodTag}${priorityTag}
    </url>`
  })
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export default function noop() {
  return null
}
