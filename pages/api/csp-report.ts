import type { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: {
    bodyParser: false
  }
}

const MAX_LOG_FIELD_LENGTH = 512

function truncate(value: unknown): unknown {
  if (typeof value !== 'string') return value
  if (value.length <= MAX_LOG_FIELD_LENGTH) return value
  return `${value.slice(0, MAX_LOG_FIELD_LENGTH)}...`
}

async function readRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })

    req.on('error', reject)
  })
}

export default async function cspReport(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const rawBody = await readRawBody(req)
    const parsed = rawBody ? JSON.parse(rawBody) : {}
    const parsedBody =
      parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : {}
    const csp = parsedBody?.['csp-report'] || parsedBody?.body || parsedBody

    if (csp && typeof csp === 'object') {
      console.warn('csp report-only violation', {
        documentUri: truncate(csp['document-uri']),
        referrer: truncate(csp.referrer),
        violatedDirective: truncate(csp['violated-directive']),
        effectiveDirective: truncate(csp['effective-directive']),
        blockedUri: truncate(csp['blocked-uri']),
        sourceFile: truncate(csp['source-file']),
        lineNumber: csp['line-number'],
        columnNumber: csp['column-number'],
        disposition: truncate(csp.disposition)
      })
    } else {
      console.warn('csp report-only violation (unparsed payload)', {
        payload: truncate(rawBody)
      })
    }
  } catch (err: any) {
    console.warn('csp report-only parse failure', {
      message: err?.message
    })
  }

  return res.status(204).end()
}
