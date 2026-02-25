import { useRouter } from 'next/router'
import * as React from 'react'

import { isHiddenTag, tagToSlug } from '@/lib/tags'

const TAG_SELECTOR = '.notion-property-multi_select .notion-property-select'

export function ClickableCollection(props: React.HTMLAttributes<HTMLDivElement>) {
  const router = useRouter()
  const rootRef = React.useRef<HTMLDivElement>(null)
  const prefetchedTagRoutesRef = React.useRef(new Set<string>())

  React.useEffect(() => {
    const rootEl = rootRef.current
    if (!rootEl) return

    const getTagRoute = (target: HTMLElement | null): string | null => {
      if (!target) return null

      const pill = target.closest<HTMLElement>(TAG_SELECTOR)
      if (!pill || !rootEl.contains(pill)) {
        return null
      }

      const tag = pill.textContent?.trim()
      if (!tag || isHiddenTag(tag)) {
        return null
      }

      const slug = tagToSlug(tag)
      if (!slug) {
        return null
      }

      return `/tag/${slug}`
    }

    const handlePrefetch = (event: Event) => {
      const target = event.target as HTMLElement | null
      const route = getTagRoute(target)
      if (!route) return

      if (prefetchedTagRoutesRef.current.has(route)) {
        return
      }
      prefetchedTagRoutesRef.current.add(route)

      void router.prefetch(route).catch(() => {
        prefetchedTagRoutesRef.current.delete(route)
      })
    }

    const handleClick = (event: Event) => {
      const target = event.target as HTMLElement | null
      const route = getTagRoute(target)
      if (!route) return

      event.preventDefault()
      event.stopPropagation()

      if (!prefetchedTagRoutesRef.current.has(route)) {
        prefetchedTagRoutesRef.current.add(route)
        void router.prefetch(route).catch(() => {
          prefetchedTagRoutesRef.current.delete(route)
        })
      }

      void router.push(`${route}#tag-content`)
    }

    const prefetchVisibleTagRoutes = () => {
      const pills = rootEl.querySelectorAll<HTMLElement>(TAG_SELECTOR)
      for (const pill of pills) {
        const route = getTagRoute(pill)
        if (!route) continue
        if (prefetchedTagRoutesRef.current.has(route)) continue

        prefetchedTagRoutesRef.current.add(route)
        void router.prefetch(route).catch(() => {
          prefetchedTagRoutesRef.current.delete(route)
        })
      }
    }

    rootEl.addEventListener('pointerover', handlePrefetch, true)
    rootEl.addEventListener('focusin', handlePrefetch, true)
    rootEl.addEventListener('touchstart', handlePrefetch, true)
    rootEl.addEventListener('click', handleClick, true)

    const warmupId = window.setTimeout(prefetchVisibleTagRoutes, 300)

    return () => {
      window.clearTimeout(warmupId)
      rootEl.removeEventListener('pointerover', handlePrefetch, true)
      rootEl.removeEventListener('focusin', handlePrefetch, true)
      rootEl.removeEventListener('touchstart', handlePrefetch, true)
      rootEl.removeEventListener('click', handleClick, true)
    }
  }, [router])

  return <div ref={rootRef} {...props} />
}
