import { createRoot } from 'react-dom/client'
import Widget from '../sidebar/Sidebar'
import sidebarStyles from '../sidebar/sidebar.css?inline'

// Guard: only inject once
if (!document.getElementById('aurexviper-ext-host')) {
  const host = document.createElement('div')
  host.id = 'aurexviper-ext-host'

  // Zero-size anchor — the widget uses position:fixed internally
  Object.assign(host.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: '0',
    height: '0',
    zIndex: '2147483647',
    pointerEvents: 'none',
  })

  const shadow = host.attachShadow({ mode: 'open' })

  // Inject Tailwind + custom styles into the shadow root
  const styleEl = document.createElement('style')
  styleEl.textContent = sidebarStyles
  shadow.appendChild(styleEl)

  // React mount container
  const container = document.createElement('div')
  shadow.appendChild(container)

  document.documentElement.appendChild(host)

  createRoot(container).render(<Widget />)
}
