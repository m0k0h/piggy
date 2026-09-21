import { useState } from 'react'
import { matchDate, plural } from '../lib/format'
import { goBack } from '../lib/router'
import {
  fetchTeam,
  parsePasted,
  type FetchReport,
  type ParsedMatch,
  type ParsedPlayer,
  type PasteKind,
} from '../lib/sportagia'
import { addMatch, addPlayer, updateSettings, useAppState } from '../lib/store'
import { allMatches, allPlayers } from '../lib/stats'
import { Empty, Field, ScreenHeader, SectionTitle } from '../ui/bits'

const norm = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function Import() {
  const state = useAppState()
  const [url, setUrl] = useState(state.settings.teamUrl)
  const [kind, setKind] = useState<PasteKind>('players')
  const [pasted, setPasted] = useState('')
  const [players, setPlayers] = useState<ParsedPlayer[]>([])
  const [matches, setMatches] = useState<ParsedMatch[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [report, setReport] = useState<FetchReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')

  const existingPlayers = new Set(allPlayers(state).map((player) => norm(player.name)))
  const existingMatches = new Set(
    allMatches(state).map((match) => `${match.date.slice(0, 10)}|${norm(match.opponent)}`),
  )

  const show = (foundPlayers: ParsedPlayer[], foundMatches: ParsedMatch[]) => {
    const already: string[] = []
    const newPlayers = foundPlayers.filter((player) => {
      if (!existingPlayers.has(norm(player.name))) return true
      already.push(player.name)
      return false
    })
    const newMatches = foundMatches.filter((match) => {
      if (!existingMatches.has(`${match.date.slice(0, 10)}|${norm(match.opponent)}`)) return true
      already.push(`${match.opponent} (${matchDate(match.date)})`)
      return false
    })
    setPlayers(newPlayers)
    setMatches(newMatches)
    setSkipped(already)
    setDone('')
  }

  const onParse = () => {
    const parsed = parsePasted(pasted, kind)
    show(parsed.players, parsed.matches)
  }

  const onFetch = async () => {
    setBusy(true)
    setReport(null)
    try {
      updateSettings({ teamUrl: url })
      const result = await fetchTeam(url)
      setReport(result)
      show(result.players, result.matches)
    } finally {
      setBusy(false)
    }
  }

  const onImport = () => {
    for (const player of players) addPlayer(player.name, player.number, player.externalId)
    for (const match of matches) {
      addMatch({
        date: match.date,
        opponent: match.opponent,
        venue: match.venue,
        home: match.home,
        externalId: match.externalId,
      })
    }
    const parts: string[] = []
    if (players.length > 0) parts.push(plural(players.length, 'jugadora', 'jugadoras'))
    if (matches.length > 0) parts.push(plural(matches.length, 'partido', 'partidos'))
    setDone(`Importado: ${parts.join(' y ')}.`)
    setPlayers([])
    setMatches([])
    setPasted('')
  }

  const found = players.length + matches.length

  return (
    <>
      <ScreenHeader title="Importar desde Sportagia" onBack={goBack} />
      <main>
        <div className="card stack">
          <Field
            label="URL del equipo"
            hint="La página del equipo en Sportagia, con su número al final."
          >
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <button className="btn ghost block" onClick={onFetch} disabled={busy || !url.trim()}>
            {busy ? 'Probando…' : 'Probar conexión automática'}
          </button>
          <p className="small muted">
            Sportagia carga los datos con JavaScript y no sabemos aún cuál es su API, así que esto
            puede no funcionar. Si falla, usa el pegado de aquí abajo: funciona siempre.
          </p>
        </div>

        {report ? (
          <div className={report.hits.length > 0 ? 'banner good' : 'banner bad'}>
            {report.hits.length > 0 ? (
              <>
                Conectado: {report.hits.join(', ')}
              </>
            ) : (
              <>
                No he podido leer la web automáticamente. Suele ser el bloqueo CORS del navegador.
                Usa el pegado manual.
              </>
            )}
          </div>
        ) : null}

        <SectionTitle>Pegar datos</SectionTitle>
        <div className="card stack">
          <div className="segmented">
            <button onClick={() => setKind('players')} aria-pressed={kind === 'players'}>
              Jugadoras
            </button>
            <button onClick={() => setKind('matches')} aria-pressed={kind === 'matches'}>
              Partidos
            </button>
          </div>
          <Field
            label={kind === 'players' ? 'Listado de jugadoras' : 'Calendario de partidos'}
            hint={
              kind === 'players'
                ? 'Una por línea: "12 Anna Núñez", "Anna Núñez - 12" o solo el nombre.'
                : 'Una por línea, con la fecha delante: "25/10/2025 18:30 CV Barcelona".'
            }
          >
            <textarea
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              placeholder={
                kind === 'players'
                  ? '12 Anna Núñez\n7 Marta Soler\nLaura Puig'
                  : "25/10/2025 18:30 CV Barcelona\n08/11/2025 17:00 CN Sabadell"
              }
              spellCheck={false}
            />
          </Field>
          <p className="small muted">
            Vale tanto el texto que selecciones en la página como el JSON que veas en la pestaña Red
            de las herramientas de desarrollo.
          </p>
          <button className="btn block" onClick={onParse} disabled={!pasted.trim()}>
            Revisar lo pegado
          </button>
        </div>

        {done ? <div className="banner good">{done}</div> : null}

        {found > 0 ? (
          <>
            <SectionTitle aside={<span>{found}</span>}>Listo para importar</SectionTitle>
            <div className="card flush">
              <div className="list">
                {players.map((player, index) => (
                  <div key={`p${index}`} className="row">
                    <span className="grow">
                      <span className="title">{player.name}</span>
                      <span className="meta">
                        Jugadora{player.number ? ` · dorsal ${player.number}` : ''}
                      </span>
                    </span>
                    <button
                      className="undo"
                      onClick={() => setPlayers((rows) => rows.filter((_, i) => i !== index))}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                {matches.map((match, index) => (
                  <div key={`m${index}`} className="row">
                    <span className="grow">
                      <span className="title">{match.opponent}</span>
                      <span className="meta">Partido · {matchDate(match.date)}</span>
                    </span>
                    <button
                      className="undo"
                      onClick={() => setMatches((rows) => rows.filter((_, i) => i !== index))}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <button className="btn block" onClick={onImport}>
              Importar {found}
            </button>
          </>
        ) : null}

        {skipped.length > 0 ? (
          <div className="banner">Ya estaban y me los salto: {skipped.join(', ')}.</div>
        ) : null}

        {report && report.hits.length === 0 && report.errors.length > 0 ? (
          <details className="card tight">
            <summary className="small muted">Detalle técnico del intento</summary>
            <div className="log small muted" style={{ marginTop: 8 }}>
              {report.errors.map((error) => (
                <div key={error} className="log-item">
                  {error}
                </div>
              ))}
            </div>
          </details>
        ) : null}

        {found === 0 && !done && pasted.trim() ? (
          <div className="card">
            <Empty glyph="🔍" title="Nada reconocible todavía">
              Pulsa "Revisar lo pegado". Si sigue vacío, prueba a cambiar entre Jugadoras y
              Partidos.
            </Empty>
          </div>
        ) : null}
      </main>
    </>
  )
}
