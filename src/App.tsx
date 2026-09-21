import { useEffect } from 'react'
import { navigate, useRoute } from './lib/router'
import { getState, useAppState } from './lib/store'
import { connect, retry, useSync } from './lib/sync'
import { pot } from './lib/stats'
import { euros } from './lib/format'
import { Import } from './screens/Import'
import { Join } from './screens/Join'
import { Matches } from './screens/Matches'
import { MatchScreen } from './screens/MatchScreen'
import { Pot } from './screens/Pot'
import { Roster } from './screens/Roster'
import { Settings } from './screens/Settings'
import { Stats } from './screens/Stats'

const TABS = [
  { key: 'hucha', label: 'Hucha', glyph: '🐷' },
  { key: 'partidos', label: 'Partidos', glyph: '🏐' },
  { key: 'plantilla', label: 'Plantilla', glyph: '👥' },
  { key: 'stats', label: 'Stats', glyph: '📊' },
] as const

type TabKey = (typeof TABS)[number]['key']

const TAB_SCREENS: Record<TabKey, () => React.JSX.Element> = {
  hucha: Pot,
  partidos: Matches,
  plantilla: Roster,
  stats: Stats,
}

export function App() {
  const route = useRoute()

  useEffect(() => {
    void connect(getState().settings)
  }, [])

  useEffect(() => {
    // Al volver la cobertura en el pabellón, subimos lo que quedó pendiente.
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [])

  const [head, param] = route

  if (head === 'partido' && param) {
    return (
      <div className="app">
        <MatchScreen matchId={param} />
      </div>
    )
  }
  if (head === 'unirse' && param) {
    return (
      <div className="app">
        <Join token={param} />
      </div>
    )
  }
  if (head === 'importar') {
    return (
      <div className="app">
        <Import />
      </div>
    )
  }
  if (head === 'ajustes') {
    return (
      <div className="app">
        <Settings />
      </div>
    )
  }

  const tab: TabKey = TABS.some((t) => t.key === head) ? (head as TabKey) : 'hucha'
  const Screen = TAB_SCREENS[tab]

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
            aria-current={tab === item.key ? 'page' : undefined}
          >
            <span className="glyph" aria-hidden="true">
              {item.glyph}
            </span>
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
  const totals = pot(state)

  return (
    <header className="topbar">
      <h1>
        {state.settings.teamName}
        <span className="sub">
          {totals.pending > 0 ? `${euros(totals.pending)} en la hucha` : 'Hucha al día'}
        </span>
      </h1>
      {sync.status !== 'off' ? (
        <span className={`dot ${sync.status}`} title={sync.message || sync.status} />
      ) : null}
      <button className="icon-btn" onClick={() => navigate('ajustes')} aria-label="Ajustes">
        ⚙
      </button>
    </header>
  )
}
