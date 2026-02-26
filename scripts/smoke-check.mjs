const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000'

const checks = [
  {
    path: '/',
    expectedContentType: 'text/html',
    expectedFragments: ['<html', '</html>', 'Open Almond Studios']
  },
  {
    path: '/blog',
    expectedContentType: 'text/html',
    expectedFragments: ['<html', '</html>']
  },
  {
    path: '/sitemap.xml',
    expectedContentType: 'xml',
    expectedFragments: ['<urlset', '</urlset>']
  },
  {
    path: '/robots.txt',
    expectedContentType: 'text/plain',
    expectedFragments: ['User-agent:']
  },
  {
    path: '/feed',
    expectedContentType: 'xml',
    expectedFragments: ['<rss', '</rss>']
  }
]

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const run = async () => {
  console.log(`running smoke checks against ${baseUrl}`)

  for (const check of checks) {
    const url = `${baseUrl}${check.path}`
    const res = await fetch(url, { redirect: 'follow' })
    const body = await res.text()
    const contentType = res.headers.get('content-type') || ''

    assert(
      res.ok,
      `failed ${check.path}: expected 2xx, got ${res.status} ${res.statusText}`
    )
    assert(
      contentType.toLowerCase().includes(check.expectedContentType),
      `failed ${check.path}: expected content-type "${check.expectedContentType}", got "${contentType}"`
    )

    for (const fragment of check.expectedFragments) {
      assert(
        body.includes(fragment),
        `failed ${check.path}: missing expected fragment "${fragment}"`
      )
    }

    if (check.path === '/') {
      assert(
        !!res.headers.get('content-security-policy'),
        'failed /: missing Content-Security-Policy header'
      )
      assert(
        !!res.headers.get('x-content-type-options'),
        'failed /: missing X-Content-Type-Options header'
      )
    }

    console.log(`ok ${check.path}`)
  }

  console.log('all smoke checks passed')
}

run().catch((err) => {
  console.error('smoke checks failed')
  console.error(err?.message || err)
  process.exit(1)
})
