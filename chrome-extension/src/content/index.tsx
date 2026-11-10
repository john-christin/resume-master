import { createRoot } from 'react-dom/client'
import Widget from '../sidebar/Sidebar'
import sidebarStyles from '../sidebar/sidebar.css?inline'

const HOST_ID = 'aurexviper-ext-host'

// Greenhouse's Remix SPA can call documentElement.replaceChildren or re-hydrate after
// document_idle, evicting injected nodes. It also ships a global CSS reset that hides
// unknown elements. We defend in layers (see watchdog below for Greenhouse).
const GREENHOUSE_RE = /\.(greenhouse\.io)$/i

function inject() {
  if (document.getElementById(HOST_ID)) return

  const host = document.createElement('div')
  host.id = HOST_ID

  // Force these with setAttribute so Greenhouse's global * { display:none } reset can't
  // win — inline style already beats most selectors, but setAttribute keeps it explicit.
  host.setAttribute('style', [
    'position:fixed!important',
    'top:0!important',
    'right:0!important',
    'width:0!important',
    'height:0!important',
    'z-index:2147483647!important',
    'pointer-events:none!important',
    'display:block!important',
    'visibility:visible!important',
    'opacity:1!important',
  ].join(';'))

  const shadow = host.attachShadow({ mode: 'open' })

  // Tailwind sizes everything in rem, and rem resolves against the host page's <html>
  // font-size even inside a shadow root, so pages with 62.5% or 14px roots shrank the UI.
  const styleEl = document.createElement('style')
  styleEl.textContent = sidebarStyles.replace(/(\d*\.?\d+)rem\b/g, (_: string, n: string) => `${parseFloat(n) * 16}px`)
  shadow.appendChild(styleEl)

  const container = document.createElement('div')
  shadow.appendChild(container)

  document.documentElement.appendChild(host)
  createRoot(container).render(<Widget />)
}

inject()

if (GREENHOUSE_RE.test(location.hostname)) {
  // Greenhouse's Remix SPA calls hydrateRoot(document, …) in a startTransition, which
  // reconciles the entire <html> element and strips any child it didn't server-render.
  // It can also swap documentElement itself, silently disconnecting a MutationObserver.
  //
  // Defence layers (matches the approach used by JSR and similar robust extensions):
  //   1. Re-inject on DOMContentLoaded and load.
  //   2. MutationObserver on documentElement re-injects on any top-level child removal.
  //   3. Watchdog polls every 250ms for the first 10s, then every 1s indefinitely.
  //      It re-binds the observer whenever documentElement has been swapped.

  document.addEventListener('DOMContentLoaded', inject)
  window.addEventListener('load', () => setTimeout(inject, 0), { once: true })

  let observedRoot = document.documentElement
  let observer = new MutationObserver(() => {
    if (!document.getElementById(HOST_ID) && document.documentElement) inject()
  })
  observer.observe(observedRoot, { childList: true, subtree: false })

  const FAST_MS = 250
  const SLOW_MS = 1000
  const FAST_DURATION = 10_000
  const start = Date.now()

  function watchdog() {
    // Re-bind observer if documentElement was replaced (would be stale otherwise)
    if (document.documentElement !== observedRoot) {
      observer.disconnect()
      observedRoot = document.documentElement
      observer = new MutationObserver(() => {
        if (!document.getElementById(HOST_ID) && document.documentElement) inject()
      })
      observer.observe(observedRoot, { childList: true, subtree: false })
    }

    if (!document.getElementById(HOST_ID) && document.documentElement) inject()

    const delay = Date.now() - start < FAST_DURATION ? FAST_MS : SLOW_MS
    setTimeout(watchdog, delay)
  }

  setTimeout(watchdog, FAST_MS)
}
