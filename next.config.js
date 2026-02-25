import path from 'node:path'
import { fileURLToPath } from 'node:url'

import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  // eslint-disable-next-line no-process-env
  enabled: process.env.ANALYZE === 'true'
})

export default withBundleAnalyzer({
  staticPageGenerationTimeout: 300,
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    const cspReportEndpoint = '/api/csp-report'
    const cspBaseDirectives = [
      "base-uri 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "form-action 'self'"
    ]

    const cspCompatDirectives = [
      "default-src 'self'",
      // Keep compatibility with Next.js + existing inline script usage.
      [
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        'https://app.posthog.com',
        'https://cdn.usefathom.com',
        'https://va.vercel-scripts.com',
        'https://vitals.vercel-insights.com'
      ].join(' '),
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https:",
      "frame-src 'self' https:",
      "worker-src 'self' blob:",
      "media-src 'self' data: blob: https:"
    ]

    const cspEnforced = [...cspBaseDirectives, ...cspCompatDirectives].join('; ')

    const cspReportOnly = [
      ...cspBaseDirectives,
      // Candidate stricter script/connect policy for a future phase:
      // remove unsafe-eval and restrict connect-src to known endpoints.
      [
        "script-src 'self' 'unsafe-inline'",
        'https://app.posthog.com',
        'https://cdn.usefathom.com',
        'https://va.vercel-scripts.com',
        'https://vitals.vercel-insights.com'
      ].join(' '),
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      [
        "connect-src 'self'",
        'https://app.posthog.com',
        'https://cdn.usefathom.com',
        'https://vitals.vercel-insights.com',
        'https://va.vercel-scripts.com'
      ].join(' '),
      "frame-src 'self' https:",
      "worker-src 'self' blob:",
      "media-src 'self' data: blob: https:",
      "default-src 'self'",
      `report-uri ${cspReportEndpoint}`
    ].join('; ')

    const baseHeaders = [
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin'
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()'
      },
      {
        key: 'Content-Security-Policy',
        value: cspEnforced
      },
      {
        key: 'Content-Security-Policy-Report-Only',
        value: cspReportOnly
      }
    ]

    // HSTS should only be set on HTTPS production deployments.
    // eslint-disable-next-line no-process-env
    if (process.env.NODE_ENV === 'production') {
      baseHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload'
      })
    }

    return [
      {
        source: '/(.*)',
        headers: baseHeaders
      }
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.notion.so' },
      { protocol: 'https', hostname: 'notion.so' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'abs.twimg.com' },
      { protocol: 'https', hostname: 'pbs.twimg.com' },
      { protocol: 'https', hostname: 's3.us-west-2.amazonaws.com' }
    ],
    formats: ['image/avif', 'image/webp'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"
  },

  webpack: (config) => {
    // Workaround for ensuring that `react` and `react-dom` resolve correctly
    // when using a locally-linked version of `react-notion-x`.
    // @see https://github.com/vercel/next.js/issues/50391
    const dirname = path.dirname(fileURLToPath(import.meta.url))
    config.resolve.alias.react = path.resolve(dirname, 'node_modules/react')
    config.resolve.alias['react-dom'] = path.resolve(
      dirname,
      'node_modules/react-dom'
    )
    return config
  },

  // See https://react-tweet.vercel.app/next#troubleshooting
  transpilePackages: ['react-tweet']
})
