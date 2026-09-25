import { useRef, useState } from 'react'
import {
  defaultMatchDate,
  euros,
  matchDate,
  normalizeImageUrl,
  normalizeUrl,
  plural,
  relativeDay,
  serveSummary,
  toInputValue,
} from '../lib/format'
import { teamConfig } from '../lib/config'
import { ImageTooBig, toLogo } from '../lib/image'
import { navigate } from '../lib/router'
import {
  addMatch,
  addPayment,
  addPlayer,
  removeMatch,
  removePayment,
  removePlayer,
  updateMatch,
  updatePlayer,
  updateTeam,
  useAppState,
} from '../lib/store'
import {
  allPayments,
  balances,
  knownOpponent,
  matchStatus,
  upcomingMatches,
  finishedMatches,
  type Balance,
} from '../lib/stats'
import { signIn, signOut, useRole, useSync } from '../lib/sync'
import type { Match, Player } from '../types'
import { Sheet } from '../ui/Sheet'
import { Avatar, Crest, Empty, Field, OpponentCrest, ScreenHeader, SectionTitle } from '../ui/bits'
import {
  BallIcon,
  CalendarIcon,
  ChevronIcon,
  CoinsIcon,
  PartyIcon,
  PeopleIcon,
  PlusIcon,
  ShieldIcon,
} from '../ui/icons'

const SECTIONS = [
  { key: 'equipo', label: 'Equipo', icon: <ShieldIcon />, hint: 'Nombre, escudo y euros por fallo' },
  { key: 'jugadoras', label: 'Jugadoras', icon: <PeopleIcon />, hint: 'Altas, dorsales y bajas' },
  { key: 'partidos', label: 'Partidos', icon: <CalendarIcon />, hint: 'Calendario de la temporada' },
  { key: 'cobros', label: 'Cobros', icon: <CoinsIcon />, hint: 'Registrar lo que paga cada una' },
]

export function Admin({ section }: { section: string }) {
  const isAdmin = useRole() === 'admin'

  if (!isAdmin) return <LoginGate />

  switch (section) {
    case 'equipo':
      return <TeamSection />
    case 'jugadoras':
      return <PlayersSection />
    case 'partidos':
      return <MatchesSection />
    case 'cobros':
      return <PaymentsSection />
    default:
      return <AdminHome />
  }
}

function AdminHome() {
  const state = useAppState()
  const sync = useSync()

  return (
    <>
      <ScreenHeader title="Administración" onBack={() => navigate('hucha')} />
      <main>
        {!teamConfig ? (
          <div className="banner bad">
            Esta copia no tiene base de datos compartida: sin{' '}
            <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en los
            secretos del repositorio, cada móvil ve solo lo suyo. Revisa Settings → Secrets and
            variables → Actions en GitHub.
          </div>
        ) : null}
        <div className="card spread">
          <div className="inline">
            <Crest team={state.team} />
            <div>
              <strong>{state.team.name}</strong>
              <div className="small muted">{euros(state.team.fineAmount)} por saque fallado</div>
            </div>
          </div>
        </div>

        <div className="card flush">
          <div className="list admin-menu">
            {SECTIONS.map((item) => (
              <button
                key={item.key}
                className="row"
                onClick={() => navigate(`admin/${item.key}`)}
              >
                <span className="glyph" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="grow">
                  <span className="title">{item.label}</span>
                  <span className="meta">{item.hint}</span>
                </span>
                <span className="trail" aria-hidden="true">
                  <ChevronIcon size={18} />
                </span>
              </button>
            ))}
          </div>
        </div>

        <button className="btn ghost block" onClick={() => navigate('hucha')}>
          Ver la app del equipo
        </button>

        {sync.signedIn ? (
          <button className="btn quiet" onClick={() => void signOut()}>
            Cerrar sesión ({sync.email})
          </button>
        ) : null}
      </main>
    </>
  )
}

/** Puerta de entrada. La contraseña es el secreto; la dirección, no. */
function LoginGate() {
  const sync = useSync()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError('')
    const result = await signIn(email, password)
    setBusy(false)
    if (!result.ok) setError(result.message)
  }

  return (
    <>
      <ScreenHeader title="Administración" onBack={() => navigate('hucha')} />
      <main>
        <form
          className="card form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <p className="small muted">
            Solo para la administradora. El móvil recuerda la sesión, así que esto se hace una vez.
          </p>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              autoFocus
              spellCheck={false}
            />
          </Field>
          <Field label="Contraseña">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </Field>
          {error ? <div className="banner bad">{error}</div> : null}
          {sync.status === 'error' && !error ? (
            <div className="banner bad">{sync.message}</div>
          ) : null}
          <button className="btn block" type="submit" disabled={busy || !email.trim() || !password}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </main>
    </>
  )
}

// --------------------------------------------------------------------- equipo

function TeamSection() {
  const state = useAppState()
  const [fine, setFine] = useState(String(state.team.fineAmount))
  const [lastFine, setLastFine] = useState(state.team.fineAmount)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  if (lastFine !== state.team.fineAmount) {
    setLastFine(state.team.fineAmount)
    setFine(String(state.team.fineAmount))
  }

  const commitFine = () => {
    const value = Number(fine.replace(',', '.'))
    if (Number.isFinite(value) && value >= 0) updateTeam({ fineAmount: value })
    else setFine(String(state.team.fineAmount))
  }

  const pickLogo = async (file: File) => {
    setError('')
    try {
      updateTeam({ logo: await toLogo(file) })
    } catch (err) {
      setError(
        err instanceof ImageTooBig
          ? 'Esa imagen pesa demasiado. Prueba con una más sencilla.'
          : 'No he podido leer esa imagen.',
      )
    }
  }

  return (
    <>
      <ScreenHeader title="Equipo" onBack={() => navigate('admin')} />
      <main>
        <div className="card stack center">
          <div className="inline" style={{ justifyContent: 'center' }}>
            <Crest team={state.team} big />
          </div>
          <div className="btn-row">
            <button className="btn ghost small" onClick={() => fileRef.current?.click()}>
              {state.team.logo ? 'Cambiar escudo' : 'Poner escudo'}
            </button>
            {state.team.logo ? (
              <button className="btn quiet small" onClick={() => updateTeam({ logo: '' })}>
                Quitar
              </button>
            ) : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void pickLogo(file)
              event.target.value = ''
            }}
          />
          {error ? <div className="banner bad">{error}</div> : null}
        </div>

        <div className="card form">
          <Field label="Nombre del equipo">
            <input
              value={state.team.name}
              onChange={(event) => updateTeam({ name: event.target.value })}
              autoComplete="off"
            />
          </Field>
          <Field label="Euros por saque fallado" hint="Lo que cae a la hucha con cada fallo.">
            <input
              value={fine}
              onChange={(event) => setFine(event.target.value)}
              onBlur={commitFine}
              inputMode="decimal"
            />
          </Field>
        </div>
      </main>
    </>
  )
}

// ----------------------------------------------------------------- jugadoras

function PlayersSection() {
  const state = useAppState()
  const rows = balances(state)
  const [editing, setEditing] = useState<Player | 'new' | null>(null)

  return (
    <>
      <ScreenHeader
        title="Jugadoras"
        subtitle={plural(rows.length, 'en la plantilla', 'en la plantilla')}
        onBack={() => navigate('admin')}
      />
      <main>
        {rows.length === 0 ? (
          <div className="card">
            <Empty icon={<BallIcon />} title="Todavía no hay jugadoras">
              Añádelas una a una; luego aparecerán en la convocatoria de cada partido.
            </Empty>
          </div>
        ) : (
          <div className="card flush">
            <div className="list">
              {rows.map(({ player, tally, pending }) => (
                <button key={player.id} className="row" onClick={() => setEditing(player)}>
                  <Avatar name={player.name} number={player.number} />
                  <span className="grow">
                    <span className="title">{player.name}</span>
                    <span className="meta">
                      {serveSummary(tally.errors, tally.attempts, tally.ratio)}
                    </span>
                  </span>
                  {pending > 0 ? (
                    <span className="trail">
                      <span className="chip money">{euros(pending)}</span>
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="btn block" onClick={() => setEditing('new')}>
          <PlusIcon size={18} />
          Añadir jugadora
        </button>
      </main>

      {editing ? (
        <PlayerSheet
          player={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}

function PlayerSheet({ player, onClose }: { player: Player | null; onClose: () => void }) {
  const [name, setName] = useState(player?.name ?? '')
  const [number, setNumber] = useState(player?.number ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = () => {
    const clean = name.trim()
    if (!clean) return
    if (player) updatePlayer(player.id, { name: clean, number: number.trim() })
    else addPlayer(clean, number)
    onClose()
  }

  return (
    <Sheet title={player ? 'Editar jugadora' : 'Nueva jugadora'} onClose={onClose}>
      <div className="form">
        <Field label="Nombre">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Anna Núñez"
            autoFocus={!player}
            autoComplete="off"
          />
        </Field>
        <Field label="Dorsal (opcional)">
          <input
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="12"
            inputMode="numeric"
          />
        </Field>

        <button className="btn block" onClick={save} disabled={!name.trim()}>
          Guardar
        </button>

        {player ? (
          confirmDelete ? (
            <div className="stack">
              <p className="small muted center">
                Se quita de la plantilla. Sus saques y pagos ya registrados se mantienen en el
                historial.
              </p>
              <div className="btn-row">
                <button className="btn ghost" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    removePlayer(player.id)
                    onClose()
                  }}
                >
                  Quitar
                </button>
              </div>
            </div>
          ) : (
            <button className="btn quiet" onClick={() => setConfirmDelete(true)}>
              Quitar de la plantilla
            </button>
          )
        ) : null}
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------ partidos

function MatchesSection() {
  const state = useAppState()
  const upcoming = upcomingMatches(state)
  const played = finishedMatches(state)
  const [editing, setEditing] = useState<Match | 'new' | null>(null)

  const row = (match: Match) => (
    <button key={match.id} className="row" onClick={() => setEditing(match)}>
      <OpponentCrest opponent={match.opponent} logo={match.opponentLogo} />
      <span className="grow">
        <span className="title">
          {match.home ? '' : '@ '}
          {match.opponent || 'Rival por definir'}
        </span>
        <span className="meta">
          {matchDate(match.date)}
          {matchStatus(state, match.id) === 'finished' ? '' : ` · ${relativeDay(match.date)}`}
          {match.venue ? ` · ${match.venue}` : ''}
        </span>
      </span>
      <span className="trail">
        {matchStatus(state, match.id) === 'live' ? (
          <span className="chip live">EN JUEGO</span>
        ) : (
          <span className="chip">
            editar
            <ChevronIcon size={11} />
          </span>
        )}
      </span>
    </button>
  )

  return (
    <>
      <ScreenHeader title="Partidos" onBack={() => navigate('admin')} />
      <main>
        <SectionTitle>Por jugar</SectionTitle>
        {upcoming.length === 0 ? (
          <div className="card">
            <Empty icon={<CalendarIcon />} title="Sin partidos pendientes">
              Crea el próximo para que el equipo pueda anotar los saques.
            </Empty>
          </div>
        ) : (
          <div className="card flush">
            <div className="list">{upcoming.map(row)}</div>
          </div>
        )}

        <button className="btn block" onClick={() => setEditing('new')}>
          <PlusIcon size={18} />
          Nuevo partido
        </button>

        {played.length > 0 ? (
          <>
            <SectionTitle aside={<span>{played.length}</span>}>Jugados</SectionTitle>
            <div className="card flush">
              <div className="list">{played.map(row)}</div>
            </div>
          </>
        ) : null}
      </main>

      {editing ? (
        <MatchSheet match={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  )
}

function MatchSheet({ match, onClose }: { match: Match | null; onClose: () => void }) {
  const state = useAppState()
  const [date, setDate] = useState(match ? toInputValue(match.date) : defaultMatchDate())
  const [opponent, setOpponent] = useState(match?.opponent ?? '')
  const [venue, setVenue] = useState(match?.venue ?? '')
  const [home, setHome] = useState(match?.home ?? true)
  const [leagueUrl, setLeagueUrl] = useState(match?.leagueUrl ?? '')
  const [mapsUrl, setMapsUrl] = useState(match?.mapsUrl ?? '')
  const [logo, setLogo] = useState(match?.opponentLogo ?? '')
  const [logoError, setLogoError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const logoFileRef = useRef<HTMLInputElement>(null)

  /**
   * Al terminar de escribir el rival, recuperamos su enlace y su escudo de la
   * última vez que lo jugamos. Solo rellena lo que esté vacío.
   */
  const recallOpponent = () => {
    if (leagueUrl && logo) return
    const known = knownOpponent(state, opponent, match?.id ?? '')
    if (!known) return
    if (!leagueUrl) setLeagueUrl(known.leagueUrl)
    if (!logo) setLogo(known.logo)
  }

  const uploadLogo = async (file: File) => {
    setLogoError('')
    try {
      setLogo(await toLogo(file))
    } catch (err) {
      setLogoError(
        err instanceof ImageTooBig
          ? 'Esa imagen pesa demasiado. Prueba con una más sencilla.'
          : 'No he podido leer esa imagen.',
      )
    }
  }

  const save = () => {
    if (!opponent.trim() || !date) return
    const fields = {
      date,
      opponent: opponent.trim(),
      venue: venue.trim(),
      home,
      leagueUrl: normalizeUrl(leagueUrl),
      opponentLogo: normalizeImageUrl(logo),
      // En casa no hace falta mapa: se guarda vacío aunque se hubiera escrito antes.
      mapsUrl: home ? '' : normalizeUrl(mapsUrl),
    }
    if (match) updateMatch(match.id, fields)
    else addMatch(fields)
    onClose()
  }

  return (
    <Sheet title={match ? 'Editar partido' : 'Nuevo partido'} onClose={onClose}>
      <div className="form">
        <div className="inline">
          <OpponentCrest opponent={opponent} logo={normalizeImageUrl(logo)} big />
          <div className="grow small muted">
            El escudo y el enlace se guardan con el partido, y se reaprovechan la
            próxima vez que juguéis contra este mismo rival.
          </div>
        </div>

        <Field label="Rival">
          <input
            value={opponent}
            onChange={(event) => setOpponent(event.target.value)}
            onBlur={recallOpponent}
            placeholder="CV Barcelona"
            autoFocus={!match}
            autoComplete="off"
          />
        </Field>
        <Field label="Día y hora">
          <input
            type="datetime-local"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <Field label="Pabellón (opcional)">
          <input
            value={venue}
            onChange={(event) => setVenue(event.target.value)}
            placeholder="Municipal de..."
            autoComplete="off"
          />
        </Field>
        <label className="switch">
          <span>Jugamos en casa</span>
          <input type="checkbox" checked={home} onChange={(event) => setHome(event.target.checked)} />
        </label>
        {home ? null : (
          <Field
            label="Pabellón en Google Maps (opcional)"
            hint="Sale como «Cómo llegar al pabellón» en el partido y al compartirlo."
          >
            <input
              value={mapsUrl}
              onChange={(event) => setMapsUrl(event.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        )}

        <Field
          label="Ficha en la liga (opcional)"
          hint="La página del rival en la web de la competición."
        >
          <input
            value={leagueUrl}
            onChange={(event) => setLeagueUrl(event.target.value)}
            placeholder="https://..."
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        <Field
          label="Escudo del rival (opcional)"
          hint="En la web de la liga, pulsa sobre el escudo y copia la dirección de la imagen."
        >
          <input
            value={logo}
            onChange={(event) => setLogo(event.target.value)}
            placeholder="https://.../escudo.png"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <div className="btn-row">
          <button className="btn ghost small" onClick={() => logoFileRef.current?.click()}>
            Subir una imagen
          </button>
          {logo ? (
            <button className="btn quiet small" onClick={() => setLogo('')}>
              Quitar escudo
            </button>
          ) : null}
        </div>
        <input
          ref={logoFileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void uploadLogo(file)
            event.target.value = ''
          }}
        />
        {logoError ? <div className="banner bad">{logoError}</div> : null}

        <button className="btn block" onClick={save} disabled={!opponent.trim() || !date}>
          {match ? 'Guardar' : 'Crear partido'}
        </button>

        {match ? (
          confirmDelete ? (
            <div className="stack">
              <p className="small muted center">
                Se borra el partido y los saques anotados en él. Lo que ya se pagó a la hucha no se
                toca.
              </p>
              <div className="btn-row">
                <button className="btn ghost" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    removeMatch(match.id)
                    onClose()
                  }}
                >
                  Borrar
                </button>
              </div>
            </div>
          ) : (
            <button className="btn quiet" onClick={() => setConfirmDelete(true)}>
              Borrar partido
            </button>
          )
        ) : null}
      </div>
    </Sheet>
  )
}

// -------------------------------------------------------------------- cobros

function PaymentsSection() {
  const state = useAppState()
  const rows = balances(state)
  const [paying, setPaying] = useState<Balance | null>(null)
  const withDebt = rows.filter((row) => row.pending > 0)

  return (
    <>
      <ScreenHeader title="Cobros" onBack={() => navigate('admin')} />
      <main>
        {withDebt.length === 0 ? (
          <div className="card">
            <Empty icon={<PartyIcon />} title="Nadie debe nada" />
          </div>
        ) : (
          <div className="card flush">
            <div className="list">
              {withDebt.map((row) => (
                <button key={row.player.id} className="row" onClick={() => setPaying(row)}>
                  <Avatar name={row.player.name} number={row.player.number} />
                  <span className="grow">
                    <span className="title">{row.player.name}</span>
                    <span className="meta">
                      {serveSummary(row.tally.errors, row.tally.attempts, row.tally.ratio)}
                      {row.paid > 0 ? ` · ${euros(row.paid)} pagados` : ''}
                    </span>
                  </span>
                  <span className="trail">
                    <span className="big">{euros(row.pending)}</span>
                    <span className="meta inline">
                      cobrar
                      <ChevronIcon size={11} />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {paying ? <PaymentSheet row={paying} onClose={() => setPaying(null)} /> : null}
    </>
  )
}

function PaymentSheet({ row, onClose }: { row: Balance; onClose: () => void }) {
  const state = useAppState()
  const [amount, setAmount] = useState(String(row.pending))
  const [note, setNote] = useState('')
  const value = Number(amount.replace(',', '.'))
  const history = allPayments(state)
    .filter((payment) => payment.playerId === row.player.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <Sheet title={`Pago de ${row.player.name}`} onClose={onClose}>
      <div className="form">
        <p className="small muted">
          Debe {euros(row.pending)} por {plural(row.tally.errors, 'saque fallado', 'saques fallados')}.
        </p>
        <Field label="Cuánto pone">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            autoFocus
          />
        </Field>
        <Field label="Nota (opcional)">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="En mano, Bizum..."
            autoComplete="off"
          />
        </Field>
        <button
          className="btn block"
          disabled={!Number.isFinite(value) || value <= 0}
          onClick={() => {
            addPayment(row.player.id, value, note)
            onClose()
          }}
        >
          Registrar {Number.isFinite(value) && value > 0 ? euros(value) : ''}
        </button>

        {history.length > 0 ? (
          <div className="stack">
            <SectionTitle>Pagos anteriores</SectionTitle>
            <div className="log">
              {history.map((payment) => (
                <div key={payment.id} className="log-item">
                  <span className="grow">
                    {euros(payment.amount)}
                    {payment.note ? ` · ${payment.note}` : ''}
                  </span>
                  <button className="undo" onClick={() => removePayment(payment.id)}>
                    Deshacer
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Sheet>
  )
}
