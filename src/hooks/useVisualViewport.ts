import { useEffect } from 'react'

/**
 * Keeps --vvh/--vvt in sync with the visual viewport so a full-height chat
 * layout stays above the on-screen keyboard (iOS Safari does not resize the
 * layout viewport when the keyboard opens).
 */
export function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const update = () => {
      root.style.setProperty('--vvh', `${vv.height}px`)
      root.style.setProperty('--vvt', `${vv.offsetTop}px`)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      root.style.removeProperty('--vvh')
      root.style.removeProperty('--vvt')
    }
  }, [])
}
