import { lazy, Suspense, useEffect } from 'react'
import { ToastProvider } from './components/Toasts'
import { Loading } from './components/ui'
import { isConfigured } from './lib/config'
import { usePath } from './lib/router'
import { Landing } from './pages/Landing'

// Everything beyond the landing page is split out and loaded on demand.
const Create = lazy(() => import('./pages/Create'))
const Game = lazy(() => import('./pages/Game'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Rules = lazy(() => import('./pages/Rules'))
const Report = lazy(() => import('./pages/Report'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Setup = lazy(() => import('./pages/Setup'))

const DEFAULT_TITLE = 'ANONYMASS — How Well Do You Know Me?'

function route(path: string) {
  const game = /^\/g\/([A-Za-z0-9]{1,16})\/?$/.exec(path)
  if (game) return { page: <Game code={game[1].toUpperCase()} />, title: 'Someone is hiding behind this link 👀 — ANONYMASS' }
  switch (path.replace(/\/$/, '') || '/') {
    case '/':
      return { page: <Landing />, title: DEFAULT_TITLE }
    case '/create':
      return { page: <Create />, title: 'Create your game — ANONYMASS' }
    case '/privacy':
      return { page: <Privacy />, title: 'Privacy — ANONYMASS' }
    case '/rules':
      return { page: <Rules />, title: 'Rules — ANONYMASS' }
    case '/report':
      return { page: <Report />, title: 'Report — ANONYMASS' }
    default:
      return { page: <NotFound />, title: "This mystery doesn't exist — ANONYMASS" }
  }
}

export function App() {
  const path = usePath()
  const { page, title } = route(path)
  const needsBackend = path === '/create' || path.startsWith('/g/')

  useEffect(() => {
    document.title = title
  }, [title])

  return (
    <ToastProvider>
      <Suspense fallback={<Loading />}>{needsBackend && !isConfigured ? <Setup /> : page}</Suspense>
    </ToastProvider>
  )
}
