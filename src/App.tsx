import { useEffect } from 'react'
import { navigate, useRoute } from './lib/router'
import { useAppState } from './lib/store'
import { connect, reconnect, retry, useSync } from './lib/sync'
import { useTrackView, type View } from './lib/views'
import { Admin } from './screens/Admin'
import { Matches } from './screens/Matches'
import { MatchScreen } from './screens/MatchScreen'
import { Pot } from './screens/Pot'
import { Stats } from './screens/Stats'
import { Crest } from './ui/bits'
import { BallIcon, ChartIcon, PigLineIcon } from './ui/icons'

/**
 * La app es la del equipo. La administración vive aparte, en `#/admin`, y no
 * hay ningún botón que lleve allí: es un enlace que solo conoce quien lo lleva.
 */
const TABS = [
  { key: 'hucha', label: 'Hucha', icon: <PigLineIcon size={22} />, screen: Pot },
  { key: 'partidos', label: 'Partidos', icon: <BallIcon size={22} />, screen: Matches },
  { key: 'stats', label: 'Stats', icon: <ChartIcon size={22} />, screen: Stats },
]

/** Cada cuánto se reintenta conectar mientras no hay conexión. */
const RETRY_EVERY_MS = 30_000

export function App() {
  const route = useRoute()

  useEffect(() => {
    void connect()
  }, [])

  useEffect(() => {
    // Al volver la cobertura en el pabellón, bajamos lo de las demás y subimos
    // lo que quedó pendiente.
    window.addEventListener('online', reconnect)
    // Con cobertura a medias el móvil no avisa de nada, así que mientras esté
    // caída lo seguimos intentando; y al volver a la app desde otra, también.
    const timer = setInterval(retry, RETRY_EVERY_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') retry()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', reconnect)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const [head, param] = route
  const tab = TABS.find((item) => item.key === head) ?? TABS[0]
  // La administración no cuenta como visita: queremos saber qué usa el equipo.
  useTrackView(head === 'admin' ? null : head === 'partido' && param ? 'partido' : (tab.key as View))

  if (head === 'admin') {
    return (
      <div className="app">
        <Admin section={param ?? ''} />
      </div>
    )
  }
  if (head === 'partido' && param) {
    return (
      <div className="app">
        <MatchScreen matchId={param} />
      </div>
    )
  }

  const Screen = tab.screen

  return (
    <div className="app has-tabs">
      <TopBar />
      <main>
        <Screen />
      </main>
      <nav className="tabbar">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => navigate(item.key)}
            aria-current={tab.key === item.key ? 'page' : undefined}
          >
            <span className="glyph">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function TopBar() {
  const state = useAppState()
  const sync = useSync()

  return (
    <header className="topbar">
      <Crest team={state.team} />
      <h1>
        {state.team.name}
        <span className="sub">Temporada 26-27</span>
      </h1>
      {sync.status !== 'off' ? (
        <span className={`dot ${sync.status}`} title={sync.message || sync.status} />
      ) : null}
      {/* Solo aparece con la sesión abierta, para volver a administración. */}
      {sync.signedIn ? (
        <button className="btn ghost small" onClick={() => navigate('admin')}>
          Admin
        </button>
      ) : null}
    </header>
  )
}
