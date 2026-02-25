import Head from 'next/head'
import { useRouter } from 'next/router'
import Script from 'next/script'

import type * as types from '@/lib/types'
import * as config from '@/lib/config'
import { getSocialImageUrl } from '@/lib/get-social-image-url'

export function PageHead({
  site,
  title,
  description,
  pageId,
  image,
  url,
  isBlogPost,
  keywords,
  publishedTime,
  modifiedTime
}: types.PageProps & {
  title?: string
  description?: string
  image?: string
  url?: string
  isBlogPost?: boolean
  keywords?: string[]
  publishedTime?: string
  modifiedTime?: string
}) {
  const router = useRouter()
  const path = router?.asPath?.split('#')[0]?.split('?')[0] ?? ''
  const canonicalUrl = url ?? `${config.host}${path}`
  const siteOrigin = config.isDev ? config.host : `https://${config.domain}`

  const rssFeedUrl = `${config.host}/feed`

  title = title ?? site?.name
  description = description ?? site?.description

  const socialImageUrl = getSocialImageUrl(pageId) || image
  const normalizedKeywords = keywords?.filter(Boolean) || []
  const socialProfiles = [
    config.twitter ? `https://x.com/${config.twitter}` : null,
    config.linkedin ? `https://www.linkedin.com/company/${config.linkedin}` : null,
    config.youtube ? `https://www.youtube.com/${config.youtube}` : null,
    config.facebook || null,
    config.instagram || null,
    config.discord || null,
    config.github ? `https://github.com/${config.github}` : null
  ].filter(Boolean) as string[]

  const organizationJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: config.name,
    url: siteOrigin,
    logo: `${siteOrigin}/apple-touch-icon.png`,
    sameAs: socialProfiles.length ? socialProfiles : undefined
  })

  const websiteJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.name,
    url: siteOrigin,
    inLanguage: config.language,
    publisher: {
      '@type': 'Organization',
      name: config.name
    }
  })

  const blogPostingJsonLd =
    isBlogPost && canonicalUrl
      ? JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          '@id': `${canonicalUrl}#BlogPosting`,
          mainEntityOfPage: canonicalUrl,
          url: canonicalUrl,
          headline: title,
          name: title,
          description,
          inLanguage: config.language,
          author: {
            '@type': 'Person',
            name: config.author
          },
          publisher: {
            '@type': 'Organization',
            name: config.name
          },
          image: socialImageUrl,
          datePublished: publishedTime,
          dateModified: modifiedTime || publishedTime,
          keywords: normalizedKeywords
        })
      : null

  return (
    <>
      <Head>
        <meta charSet='utf-8' />
        <meta httpEquiv='Content-Type' content='text/html; charset=utf-8' />
        <meta
          name='viewport'
          content='width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover'
        />
        <meta name='author' content={config.author} />

        <meta name='mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-status-bar-style' content='black' />

        <meta
          name='theme-color'
          media='(prefers-color-scheme: light)'
          content='#fefffe'
          key='theme-color-light'
        />
        <meta
          name='theme-color'
          media='(prefers-color-scheme: dark)'
          content='#2d3439'
          key='theme-color-dark'
        />

        <meta
          name='robots'
          content='index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1'
        />
        <meta
          name='googlebot'
          content='index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1'
        />
        <meta property='og:type' content={isBlogPost ? 'article' : 'website'} />
        <meta property='og:locale' content={config.language} />

        {site && (
          <>
            <meta property='og:site_name' content={site.name} />
            <meta property='twitter:domain' content={site.domain} />
          </>
        )}

        {config.twitter && (
          <meta name='twitter:creator' content={`@${config.twitter}`} />
        )}

        {description && (
          <>
            <meta name='description' content={description} />
            <meta property='og:description' content={description} />
            <meta name='twitter:description' content={description} />
          </>
        )}
        {normalizedKeywords.length > 0 && (
          <meta name='keywords' content={normalizedKeywords.join(', ')} />
        )}

        {socialImageUrl ? (
          <>
            <meta name='twitter:card' content='summary_large_image' />
            <meta name='twitter:image' content={socialImageUrl} />
            <meta name='twitter:image:alt' content={title} />
            <meta property='og:image' content={socialImageUrl} />
            <meta property='og:image:alt' content={title} />
            <meta property='og:image:width' content='1200' />
            <meta property='og:image:height' content='630' />
            <meta property='og:image:type' content='image/png' />
          </>
        ) : (
          <meta name='twitter:card' content='summary' />
        )}

        {canonicalUrl && (
          <>
            <link rel='canonical' href={canonicalUrl} />
            <meta property='og:url' content={canonicalUrl} />
            <meta property='twitter:url' content={canonicalUrl} />
          </>
        )}

        <link
          rel='alternate'
          type='application/rss+xml'
          href={rssFeedUrl}
          title={site?.name}
        />

        <meta property='og:title' content={title} />
        <meta name='twitter:title' content={title} />
        {config.twitter && <meta name='twitter:site' content={`@${config.twitter}`} />}
        {isBlogPost && publishedTime && (
          <meta property='article:published_time' content={publishedTime} />
        )}
        {isBlogPost && modifiedTime && (
          <meta property='article:modified_time' content={modifiedTime} />
        )}
        {modifiedTime && <meta property='og:updated_time' content={modifiedTime} />}
        {isBlogPost && <meta property='article:author' content={config.author} />}
        {isBlogPost &&
          normalizedKeywords.map((keyword) => (
            <meta key={`article-tag-${keyword}`} property='article:tag' content={keyword} />
          ))}
        <title>{title}</title>
      </Head>

      <Script id='organization-jsonld' type='application/ld+json' strategy='afterInteractive'>
        {organizationJsonLd}
      </Script>
      <Script id='website-jsonld' type='application/ld+json' strategy='afterInteractive'>
        {websiteJsonLd}
      </Script>

      {/* Better SEO for the blog posts */}
      {blogPostingJsonLd && (
        <Script
          id={`blog-post-jsonld-${pageId ?? 'page'}`}
          type='application/ld+json'
          strategy='afterInteractive'
        >
          {blogPostingJsonLd}
        </Script>
      )}

      {/*
        MailerLite disabled for now.
        Re-enable when you have an active campaign by restoring the script below.
      */}
      {/*
      <Script id='mailerlite-init' strategy='afterInteractive'>
        {`(function(w,d,e,u,f,l,n){w[f]=w[f]||function(){
  (w[f].q=w[f].q||[]).push(arguments)},l=d.createElement(e),l.async=1,l.src=u,
  n=d.getElementsByTagName(e)[0],n.parentNode.insertBefore(l,n)
})(window,document,'script','https://assets.mailerlite.com/js/universal.js','ml');
ml('account', '1930777');`}
      </Script>
      */}
    </>
  )
}
