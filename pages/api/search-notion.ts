import { type NextApiRequest, type NextApiResponse } from 'next'
import { parsePageId } from 'notion-utils'

import type * as types from '../../lib/types'
import { search } from '../../lib/notion'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '16kb'
    }
  }
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 60
const MAX_QUERY_LENGTH = 512
const MAX_SEARCH_SESSION_ID_LENGTH = 128
const EMPTY_SEARCH_RESULTS: types.SearchResults = {
  recordMap: {
    block: {}
  },
  results: [],
  total: 0
}

type RateLimitBucket = {
  count: number
  resetAt: number
}

const rateLimitBuckets = new Map<string, RateLimitBucket>()

function getClientIp(req: NextApiRequest): string {
  const forwardedFor = req.headers['x-forwarded-for']

  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0]!.trim()
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0]!.split(',')[0]!.trim()
  }

  return req.socket.remoteAddress || 'unknown'
}

function checkRateLimit(clientIp: string): {
  allowed: boolean
  retryAfterSeconds?: number
} {
  const now = Date.now()
  const current = rateLimitBuckets.get(clientIp)

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(clientIp, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    })

    return { allowed: true }
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000)
      )
    }
  }

  current.count += 1
  rateLimitBuckets.set(clientIp, current)
  return { allowed: true }
}

function validateSearchParams(input: unknown):
  | { type: 'success'; value: types.SearchParams }
  | { type: 'error'; statusCode: number; message: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      type: 'error',
      statusCode: 400,
      message: 'invalid request body'
    }
  }

  const body = input as Record<string, unknown>

  if (typeof body.ancestorId !== 'string') {
    return {
      type: 'error',
      statusCode: 400,
      message: 'invalid ancestorId'
    }
  }

  const ancestorId = parsePageId(body.ancestorId, { uuid: false })
  if (!ancestorId) {
    return {
      type: 'error',
      statusCode: 400,
      message: 'invalid ancestorId'
    }
  }

  if (typeof body.query !== 'string') {
    return {
      type: 'error',
      statusCode: 400,
      message: 'invalid query'
    }
  }

  const query = body.query.trim()
  if (query.length > MAX_QUERY_LENGTH) {
    return {
      type: 'error',
      statusCode: 400,
      message: 'invalid query'
    }
  }

  const searchParams: types.SearchParams = {
    ancestorId,
    query
  }

  if (body.filters !== undefined) {
    if (
      !body.filters ||
      typeof body.filters !== 'object' ||
      Array.isArray(body.filters)
    ) {
      return {
        type: 'error',
        statusCode: 400,
        message: 'invalid filters'
      }
    }

    const filters = body.filters as Record<string, unknown>
    const filterKeys = [
      'isDeletedOnly',
      'excludeTemplates',
      'isNavigableOnly',
      'requireEditPermissions'
    ] as const

    const validatedFilters = {} as NonNullable<types.SearchParams['filters']>

    for (const key of filterKeys) {
      if (typeof filters[key] !== 'boolean') {
        return {
          type: 'error',
          statusCode: 400,
          message: 'invalid filters'
        }
      }

      validatedFilters[key] = filters[key]
    }

    searchParams.filters = validatedFilters
  }

  if (body.limit !== undefined) {
    if (
      typeof body.limit !== 'number' ||
      !Number.isInteger(body.limit) ||
      body.limit < 1 ||
      body.limit > 100
    ) {
      return {
        type: 'error',
        statusCode: 400,
        message: 'invalid limit'
      }
    }

    searchParams.limit = body.limit
  }

  if (body.searchSessionId !== undefined) {
    if (
      typeof body.searchSessionId !== 'string' ||
      body.searchSessionId.length > MAX_SEARCH_SESSION_ID_LENGTH
    ) {
      return {
        type: 'error',
        statusCode: 400,
        message: 'invalid searchSessionId'
      }
    }

    searchParams.searchSessionId = body.searchSessionId
  }

  return {
    type: 'success',
    value: searchParams
  }
}

export default async function searchNotion(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).send({ error: 'method not allowed' })
  }

  if (!req.headers['content-type']?.includes('application/json')) {
    return res.status(415).send({ error: 'unsupported media type' })
  }

  const clientIp = getClientIp(req)
  const rateLimit = checkRateLimit(clientIp)
  if (!rateLimit.allowed) {
    if (rateLimit.retryAfterSeconds) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds))
    }
    return res.status(429).send({ error: 'rate limit exceeded' })
  }

  const validatedBody = validateSearchParams(req.body)
  if (validatedBody.type === 'error') {
    return res
      .status(validatedBody.statusCode)
      .send({ error: validatedBody.message })
  }

  // react-notion-x sends an empty query once to warm up search on open.
  if (!validatedBody.value.query) {
    return res.status(200).json(EMPTY_SEARCH_RESULTS)
  }

  let results: types.SearchResults
  try {
    results = await search(validatedBody.value)
  } catch {
    return res.status(502).send({ error: 'search backend unavailable' })
  }

  res.setHeader(
    'Cache-Control',
    'public, s-maxage=60, max-age=60, stale-while-revalidate=60'
  )
  res.status(200).json(results)
}
