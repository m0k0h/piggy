import { useEffect, useRef, useState } from 'react'
import {
  defaultMatchDate,
  euros,
  matchDate,
  normalizeImageUrl,
  percent,
  normalizeUrl,
  plural,
  relativeDay,
  serveSummary,
  toInputValue,
} from '../lib/format'
import { teamConfig } from '../lib/config'
import { ImageTooBig, toLogo, toPhoto } from '../lib/image'
import { navigate } from '../lib/router'
import {
  addMatch,
  addPayment,
  addPlayer,
  publishNotice,
  removeMatch,
  removeNotice,
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
import { fetchViews, signIn, signOut, useRole, useSync } from '../lib/sync'
import { summarizeViews, type ViewRecord } from '../lib/views'
import { POSITION_LABELS, type Match, type Player, type Position } from '../types'
import { Sheet } from '../ui/Sheet'
import {
  Avatar,
  Crest,
  Empty,
  Field,
  Stat,
  OpponentCrest,
  PlayerName,
  ScreenHeader,
  SectionTitle,
} from '../ui/bits'
import {
  BallIcon,
  CalendarIcon,
  ChevronIcon,
  CoinsIcon,
  EyeIcon,
  MegaphoneIcon,
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
  { key: 'comentar', label: 'Mensaje de portada', icon: <MegaphoneIcon />, hint: 'La noticia de la portada' },
  { key: 'visitas', label: 'Visitas', icon: <EyeIcon />, hint: 'Cuánta gente entra y a qué pantalla' },
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
    case 'comentar':
      return <NoticeSection />
    case 'visitas':
      return <VisitsSection />
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
                    <span className="title"><PlayerName player={player} /></span>
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
  const [position, setPosition] = useState<Position | ''>(player?.position ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = () => {
    const clean = name.trim()
    if (!clean) return
    const chosen = position || undefined
    if (player) updatePlayer(player.id, { name: clean, number: number.trim(), position: chosen })
    else addPlayer(clean, number, null, chosen)
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
        <Field label="Posición (opcional)">
          <select
            value={position}
            onChange={(event) => setPosition(event.target.value as Position | '')}
          >
            <option value="">Sin indicar</option>
            {(Object.keys(POSITION_LABELS) as Position[]).map((key) => (
              <option key={key} value={key}>
                {POSITION_LABELS[key]}
              </option>
            ))}
          </select>
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
  const [home, setHome] = useState(match?.home ?? true)
  const [leagueUrl, setLeagueUrl] = useState(match?.leagueUrl ?? '')
  const [mapsUrl, setMapsUrl] = useState(match?.mapsUrl ?? '')
  const [logo, setLogo] = useState(match?.opponentLogo ?? '')
  const [logoError, setLogoError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const logoFileRef = useRef<HTMLInputElement>(null)

  /**
   * Al terminar de escribir el rival, recuperamos su enlace, su escudo y el
   * mapa de su pabellón de la última vez que lo jugamos. Solo rellena lo que
   * esté vacío.
   */
  const recallOpponent = () => {
    if (leagueUrl && logo && mapsUrl) return
    const known = knownOpponent(state, opponent, match?.id ?? '')
    if (!known) return
    if (!leagueUrl) setLeagueUrl(known.leagueUrl)
    if (!logo) setLogo(known.logo)
    if (!mapsUrl) setMapsUrl(known.mapsUrl)
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
      // Ya no se pide el pabellón como texto (el mapa lo sustituye); se conserva
      // el que tuvieran los partidos antiguos.
      venue: match?.venue ?? '',
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
            El escudo, el enlace y el mapa se guardan con el partido, y se reaprovechan la
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
                    <span className="title"><PlayerName player={row.player} /></span>
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

// --------------------------------------------------------- mensaje de portada

/**
 * La noticia de la portada. Solo hay una: publicar sustituye a la anterior y
 * "Quitar de la portada" la retira. El borrador se queda en el formulario, así
 * que se puede volver a publicar sin reescribirlo.
 */
function NoticeSection() {
  const state = useAppState()
  const current = state.team.notice ?? null
  const [text, setText] = useState(current?.text ?? '')
  const [image, setImage] = useState(current?.image ?? '')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const hasContent = Boolean(text.trim() || image)
  const unchanged = Boolean(current) && current?.text === text.trim() && current?.image === image

  const pickImage = async (file: File) => {
    setError('')
    try {
      setImage(await toPhoto(file))
    } catch (err) {
      setError(
        err instanceof ImageTooBig
          ? 'Esa imagen pesa demasiado. Prueba con otra.'
          : 'No he podido leer esa imagen.',
      )
    }
  }

  const flash = (message: string) => {
    setDone(message)
    setTimeout(() => setDone(''), 2500)
  }

  return (
    <>
      <ScreenHeader title="Mensaje de portada" onBack={() => navigate('admin')} />
      <main>
        <div className="card form">
          <Field label="Texto (opcional si pones imagen)">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="El sábado quedamos a las 17:30 en el pabellón..."
            />
          </Field>

          {image ? <img className="notice-image" src={image} alt="Imagen de la noticia" /> : null}
          <div className="btn-row">
            <button className="btn ghost small" onClick={() => fileRef.current?.click()}>
              {image ? 'Cambiar imagen' : 'Añadir imagen'}
            </button>
            {image ? (
              <button className="btn quiet small" onClick={() => setImage('')}>
                Quitar imagen
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
              if (file) void pickImage(file)
              event.target.value = ''
            }}
          />
          {error ? <div className="banner bad">{error}</div> : null}

          <button
            className="btn block"
            disabled={!hasContent || unchanged}
            onClick={() => {
              if (publishNotice(text, image)) flash('Publicada en la portada')
            }}
          >
            {current ? 'Publicar y sustituir la actual' : 'Publicar en la portada'}
          </button>
        </div>

        {current ? (
          <div className="card spread notice-status">
            <div className="grow">
              <div className="label">En portada</div>
              <div className="small muted">Desde el {matchDate(current.publishedAt)}</div>
            </div>
            <button
              className="btn ghost small"
              onClick={() => {
                removeNotice()
                flash('Quitada de la portada')
              }}
            >
              Quitar
            </button>
          </div>
        ) : null}

        {done ? <div className="banner good">{done}</div> : null}
      </main>
    </>
  )
}

// ------------------------------------------------------------------- visitas

const RANGES = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
]
const MAX_DAYS = RANGES[RANGES.length - 1].days

const decimal = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })
const shortDay = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
const dayLabel = (date: Date) => shortDay.format(date).replace('.', '')

/**
 * Cuánta gente abre la app del equipo y qué mira. Se baja entero el periodo
 * más largo una vez y el selector solo recorta, así cambiar de rango no espera.
 */
function VisitsSection() {
  const [rows, setRows] = useState<ViewRecord[] | null>(null)
  const [error, setError] = useState('')
  const [days, setDays] = useState(30)
  const [picked, setPicked] = useState<number | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!teamConfig) return
    let alive = true
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - (MAX_DAYS - 1))
    fetchViews(since).then(
      (data) => {
        if (!alive) return
        setRows(data)
        setError('')
      },
      (err: unknown) => {
        if (!alive) return
        const message = err instanceof Error ? err.message : String(err)
        // La tabla es nueva: si el esquema no se ha vuelto a pasar, no existe.
        setError(
          message.includes('piggy_views')
            ? 'Falta la tabla de visitas. Vuelve a pasar supabase/schema.sql en el SQL Editor de Supabase.'
            : message,
        )
      },
    )
    return () => {
      alive = false
    }
  }, [reload])

  const header = (
    <ScreenHeader
      title="Visitas"
      subtitle="App del equipo"
      onBack={() => navigate('admin')}
      actions={
        teamConfig ? (
          <button className="btn ghost small" onClick={() => setReload((n) => n + 1)}>
            Actualizar
          </button>
        ) : null
      }
    />
  )

  if (!teamConfig) {
    return (
      <>
        {header}
        <main>
          <div className="card">
            <Empty icon={<EyeIcon />} title="Sin base de datos no hay visitas">
              Las visitas se cuentan en la base de datos del equipo, y esta copia no tiene.
            </Empty>
          </div>
        </main>
      </>
    )
  }

  if (!rows) {
    return (
      <>
        {header}
        <main>
          {error ? (
            <div className="banner bad">{error}</div>
          ) : (
            <p className="small muted center">Contando visitas…</p>
          )}
        </main>
      </>
    )
  }

  const summary = summarizeViews(rows, days)
  const peak = Math.max(1, ...summary.perDay.map((day) => day.visitors))
  const topViews = Math.max(1, ...summary.perView.map((item) => item.views))
  const pickedIndex = picked !== null && picked < summary.perDay.length ? picked : summary.perDay.length - 1
  const pickedDay = summary.perDay[pickedIndex]

  return (
    <>
      {header}
      <main>
        {error ? <div className="banner bad">{error}</div> : null}

        <div className="segmented">
          {RANGES.map((option) => (
            <button
              key={option.days}
              onClick={() => {
                setDays(option.days)
                setPicked(null)
              }}
              aria-pressed={days === option.days}
            >
              {option.label}
            </button>
          ))}
        </div>

        {summary.views === 0 ? (
          <div className="card">
            <Empty icon={<EyeIcon />} title="Nadie ha entrado todavía">
              En cuanto alguien del equipo abra la app, aparecerá aquí.
            </Empty>
          </div>
        ) : (
          <>
            <div className="stat-row">
              <Stat value={summary.visitors} label="Personas" />
              <Stat value={summary.views} label="Visitas" />
              <Stat value={summary.today} label="Hoy" />
            </div>
            <div className="stat-row">
              <Stat value={decimal.format(summary.dailyAverage)} label="Al día" />
              <Stat value={decimal.format(summary.views / summary.visitors)} label="Por persona" />
              <Stat value={percent(summary.installed)} label="Instalada" />
            </div>

            <SectionTitle>Personas por día</SectionTitle>
            <div className="card visits-chart">
              <div className="visits-picked">
                <strong>{plural(pickedDay.visitors, 'persona', 'personas')}</strong>
                <span className="muted">
                  {pickedIndex === summary.perDay.length - 1 ? 'hoy' : dayLabel(pickedDay.date)} ·{' '}
                  {plural(pickedDay.views, 'visita', 'visitas')}
                </span>
              </div>
              <div className="visits-bars" role="list" aria-label="Personas distintas cada día">
                {summary.perDay.map((day, index) => (
                  <button
                    key={day.date.getTime()}
                    role="listitem"
                    className={index === pickedIndex ? 'on' : undefined}
                    onClick={() => setPicked(index)}
                    aria-label={`${dayLabel(day.date)}: ${plural(day.visitors, 'persona', 'personas')}`}
                  >
                    <i style={{ height: day.visitors ? `${(day.visitors / peak) * 100}%` : undefined }} />
                  </button>
                ))}
              </div>
              <div className="visits-axis small muted">
                <span>{dayLabel(summary.perDay[0].date)}</span>
                <span>máx. {peak}</span>
                <span>hoy</span>
              </div>
            </div>

            <SectionTitle>Por pantalla</SectionTitle>
            <div className="card flush">
              <div className="list">
                {summary.perView.map((item) => (
                  <div key={item.view} className="row">
                    <span className="grow">
                      <span className="title">{item.label}</span>
                      <span className="meta">{plural(item.visitors, 'persona', 'personas')}</span>
                      <div className="bar share" aria-hidden="true">
                        <i style={{ width: `${(item.views / topViews) * 100}%` }} />
                      </div>
                    </span>
                    <span className="trail">
                      <span className="big">{item.views}</span>
                      <span className="meta">{item.views === 1 ? 'visita' : 'visitas'}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <p className="small muted">
          Cada móvil cuenta como una persona, sin saber quién es. Volver a la misma pantalla en
          menos de media hora es la misma visita, y lo que miras con la sesión de administradora
          abierta no cuenta. «Instalada» es la parte que entra desde la pantalla de inicio.
        </p>
      </main>
    </>
  )
}
