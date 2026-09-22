import { useEffect } from 'react'
import { euros } from './lib/format'
import { navigate, useRoute } from './lib/router'
import { getState, useAppState } from './lib/store'
import { pot, teamName } from './lib/stats'
import { connect, retry, useRole, useSync } from './lib/sync'
import type { Role } from './types'
import { Import } from './screens/Import'
import { Join } from './screens/Join'
import { Matches } from './screens/Matches'
import { MatchScreen } from './screens/MatchScreen'
import { Pot } from './screens/Pot'
import { Roster } from './screens/Roster'
import { Settings } from './screens/Settings'
import { Stats } from './screens/Stats'

interface Tab {
  key: string
  label: string
  glyph: string
  screen: () => React.JSX.Element
  /** La plantilla solo la gestiona la admin, así que al equipo no le ocupa sitio. */
  adminOnly?: boolean
}

const TABS: Tab[] = [
  { key: 'hucha', label: 'Hucha', glyph: '🐷', screen: Pot },
  { key: 'partidos', label: 'Partidos', glyph: '🏐', screen: Matches },
  { key: 'plantilla', label: 'Plantilla', glyph: '👥', screen: Roster, adminOnly: true },
  { key: 'stats', label: 'Stats', glyph: '📊', screen: Stats },
]

const tabsFor = (role: Role) => TABS.filter((tab) => role === 'admin' || !tab.adminOnly)

export function App() {
  const route = useRoute()
  const role = useRole()

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

  const tabs = tabsFor(role)
  const current = tabs.find((tab) => tab.key === head) ?? tabs[0]
  const Screen = current.screen

  return (
    <div className="app has-tabs">
      <TopBar />
      <main>
        <Screen />
      </main>
      <nav className="tabbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => navigate(tab.key)}
            aria-current={current.key === tab.key ? 'page' : undefined}
          >
            <span className="glyph" aria-hidden="true">
              {tab.glyph}
            </span>
            {tab.label}
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
        {teamName(state)}
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
