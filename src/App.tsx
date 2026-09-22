import { useEffect, useState, type ReactNode } from 'react'
import { teamConfig } from './lib/config'
import { navigate, useRoute } from './lib/router'
import { useAppState } from './lib/store'
import { connect, retry, useSync } from './lib/sync'
import { Admin } from './screens/Admin'
import { Matches } from './screens/Matches'
import { MatchScreen } from './screens/MatchScreen'
import { Pot } from './screens/Pot'
import { Stats } from './screens/Stats'
import { Crest, Empty } from './ui/bits'
import { BallIcon, ChartIcon, CloudOffIcon, PigLineIcon } from './ui/icons'

/**
 * La app es la del equipo. La administración vive aparte, en `#/admin`, y no
 * hay ningún botón que lleve allí: es un enlace que solo conoce quien lo lleva.
 */
const TABS = [
  { key: 'hucha', label: 'Hucha', icon: <PigLineIcon size={22} />, screen: Pot },
  { key: 'partidos', label: 'Partidos', icon: <BallIcon size={22} />, screen: Matches },
  { key: 'stats', label: 'Stats', icon: <ChartIcon size={22} />, screen: Stats },
]

export function App() {
  const route = useRoute()
  const sync = useSync()
  // Una vez conectada, un fallo puntual al subir algo (cobertura mala en el
  // pabellón) no debe tirar la app entera: eso ya lo avisa el puntito del
  // encabezado. El aviso de arranque es solo para el primer intento.
  const [everOnline, setEverOnline] = useState(sync.status === 'online')
  if (!everOnline && sync.status === 'online') setEverOnline(true)

  useEffect(() => {
    void connect()
  }, [])

  useEffect(() => {
    // Al volver la cobertura en el pabellón, subimos lo que quedó pendiente.
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [])

  // La app no guarda nada en el móvil: sin base de datos no hay dónde vivir
  // los datos, así que ni se intenta arrancar el resto de la interfaz.
  if (!teamConfig) {
    return (
      <StartupNotice title="Sin base de datos compartida">
        Faltan <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en los
        secretos del repositorio, así que no hay dónde guardar nada. Revisa Settings → Secrets
        and variables → Actions en GitHub.
      </StartupNotice>
    )
  }
  if (!everOnline) {
    if (sync.status === 'error') {
      return <StartupNotice title="Sin conexión con la base de datos">{sync.message}</StartupNotice>
    }
    return (
      <StartupNotice title="Conectando…" connecting>
        Un momento, estamos bajando los datos del equipo.
      </StartupNotice>
    )
  }

  const [head, param] = route

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

  const tab = TABS.find((item) => item.key === head) ?? TABS[0]
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

/** Pantalla de arranque cuando no hay datos que mostrar: sin base de datos,
 * sin conexión, o todavía bajando lo del equipo. Sustituye a toda la app
 * porque, sin guardar nada en el móvil, no hay nada más que ofrecer. */
function StartupNotice({
  title,
  connecting = false,
  children,
}: {
  title: string
  connecting?: boolean
  children: ReactNode
}) {
  return (
    <div className="app">
      <header className="topbar">
        <PigLineIcon size={26} />
        <h1>Hucha de saques</h1>
      </header>
      <main>
        <div className="card">
          <Empty icon={connecting ? <PigLineIcon /> : <CloudOffIcon />} title={title}>
            {children}
          </Empty>
        </div>
      </main>
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
      <span className={`dot ${sync.status}`} title={sync.message || sync.status} />
      {/* Solo aparece con la sesión abierta, para volver a administración. */}
      {sync.signedIn ? (
        <button className="btn ghost small" onClick={() => navigate('admin')}>
          Admin
        </button>
      ) : null}
    </header>
  )
}
