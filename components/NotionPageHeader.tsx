import type * as types from 'notion-types'
import cs from 'classnames'
import { useRouter } from 'next/router'
import * as React from 'react'
import { IoMoonSharp, IoSunnyOutline } from 'react-icons/io5'
import { Breadcrumbs, Search, useNotionContext } from 'react-notion-x'

import { isSearchEnabled, navigationLinks, navigationStyle } from '@/lib/config'
import { useDarkMode } from '@/lib/use-dark-mode'

import styles from './styles.module.css'

function ToggleThemeButton() {
  const [hasMounted, setHasMounted] = React.useState(false)
  const { isDarkMode, toggleDarkMode } = useDarkMode()

  React.useEffect(() => {
    setHasMounted(true)
  }, [])

  const onToggleTheme = React.useCallback(() => {
    toggleDarkMode()
  }, [toggleDarkMode])

  return (
    <div
      className={cs('breadcrumb', 'button', !hasMounted && styles.hidden)}
      onClick={onToggleTheme}
    >
      {hasMounted && isDarkMode ? <IoMoonSharp /> : <IoSunnyOutline />}
    </div>
  )
}

export function NotionPageHeader({
  block
}: {
  block: types.CollectionViewPageBlock | types.PageBlock
}) {
  const router = useRouter()
  const { components, mapPageUrl } = useNotionContext()
  const [isScrolled, setIsScrolled] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 14)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const normalizedPath = React.useMemo(() => {
    const path = (router.asPath || '/').split('#')[0]?.split('?')[0] || '/'
    return path === '/' ? '/' : path.replace(/\/+$/, '')
  }, [router.asPath])

  const isActivePageLink = React.useCallback(
    (href: string) => {
      const normalizedHref = href === '/' ? '/' : href.replace(/\/+$/, '')
      return normalizedPath === normalizedHref
    },
    [normalizedPath]
  )

  const showCustomNavLinks = navigationStyle !== 'default'

  return (
    <header
      className={cs(
        'notion-header',
        isScrolled && 'notion-header--scrolled'
      )}
    >
      <div className='notion-nav-header'>
        <Breadcrumbs block={block} />

        <div className='notion-nav-header-rhs breadcrumbs'>
          {showCustomNavLinks &&
            navigationLinks
              ?.map((link, index) => {
                if (!link?.pageId && !link?.url) {
                  return null
                }

                if (link.pageId) {
                  const href = mapPageUrl(link.pageId)
                  const isActive = isActivePageLink(href)
                  return (
                    <components.PageLink
                      href={href}
                      key={index}
                      className={cs(
                        styles.navLink,
                        isActive && styles.navLinkActive,
                        'breadcrumb',
                        'button'
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {link.title}
                    </components.PageLink>
                  )
                } else {
                  return (
                    <components.Link
                      href={link.url}
                      key={index}
                      className={cs(styles.navLink, 'breadcrumb', 'button')}
                    >
                      {link.title}
                    </components.Link>
                  )
                }
              })
              .filter(Boolean)}

          <ToggleThemeButton />

          {isSearchEnabled && <Search block={block} title={null} />}
        </div>
      </div>
    </header>
  )
}
