import { useRef, useState } from 'react'
import { euros } from '../lib/format'
import { buildInviteLink, randomTeamCode } from '../lib/invite'
import { goBack, navigate } from '../lib/router'
import { fineAmount, teamName } from '../lib/stats'
import { copyText } from '../lib/summary'
import {
  exportState,
  importState,
  resetState,
  updateSettings,
  updateTeam,
  useAppState,
} from '../lib/store'
import { connect, useRole, useSync } from '../lib/sync'
import { AdminSwitch } from './AdminLogin'
import { Field, ScreenHeader, SectionTitle } from '../ui/bits'

const STATUS_TEXT: Record<string, string> = {
  off: 'Solo en este móvil',
  connecting: 'Conectando…',
  online: 'Sincronizado con el equipo',
  error: 'Error de conexión',
}

export function Settings() {
  const state = useAppState()
  const sync = useSync()
  const isAdmin = useRole() === 'admin'
  const { settings } = state

  const [fine, setFine] = useState(String(state.team.fineAmount))
  const [lastFine, setLastFine] = useState(state.team.fineAmount)
  const [toast, setToast] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Si el importe cambia porque lo tocó otra persona del equipo, refrescamos el
  // campo sin pisar lo que se esté tecleando.
  if (lastFine !== state.team.fineAmount) {
    setLastFine(state.team.fineAmount)
    setFine(String(state.team.fineAmount))
  }

  const flash = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 2500)
  }

  const commitFine = () => {
    const value = Number(fine.replace(',', '.'))
    if (Number.isFinite(value) && value >= 0) updateTeam({ fineAmount: value })
    else setFine(String(state.team.fineAmount))
  }

  const onExport = () => {
    const blob = new Blob([exportState()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `hucha-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const onImportFile = async (file: File) => {
    try {
      importState(await file.text())
      flash('Copia restaurada')
    } catch {
      flash('Ese archivo no es una copia válida')
    }
  }

  const canInvite = Boolean(settings.supabaseUrl && settings.supabaseAnonKey && settings.teamCode)

  return (
    <>
      <ScreenHeader title="Ajustes" onBack={goBack} />
      <main>
        <SectionTitle>Quién eres</SectionTitle>
        <div className="card stack">
          <AdminSwitch />
        </div>

        <SectionTitle>Equipo</SectionTitle>
        {isAdmin ? (
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
            <button className="btn ghost block" onClick={() => navigate('importar')}>
              Importar desde Sportagia
            </button>
          </div>
        ) : (
          <div className="card stack">
            <div className="spread">
              <span className="muted small">Equipo</span>
              <strong>{teamName(state)}</strong>
            </div>
            <div className="spread">
              <span className="muted small">Por saque fallado</span>
              <strong>{euros(fineAmount(state))}</strong>
            </div>
            <p className="small muted">Esto lo configura la administradora.</p>
          </div>
        )}

        <SectionTitle
          aside={
            <span className="inline">
              <span className={`dot ${sync.status}`} />
              <span className="small">{STATUS_TEXT[sync.status]}</span>
            </span>
          }
        >
          Sincronización
        </SectionTitle>

        <div className="card form">
          <p className="small muted">
            Con un proyecto gratuito de Supabase, todas veis la misma hucha en tiempo real. Sin
            esto, la app funciona igual pero solo en este móvil.
          </p>

          <Field label="URL del proyecto" hint="https://xxxx.supabase.co">
            <input
              value={settings.supabaseUrl}
              onChange={(event) => updateSettings({ supabaseUrl: event.target.value.trim() })}
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Clave anon (publishable)">
            <input
              value={settings.supabaseAnonKey}
              onChange={(event) => updateSettings({ supabaseAnonKey: event.target.value.trim() })}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Código del equipo" hint="El mismo código en todos los móviles del equipo.">
            <input
              value={settings.teamCode}
              onChange={(event) => updateSettings({ teamCode: event.target.value.trim() })}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>

          <div className="btn-row">
            {isAdmin ? (
              <button
                className="btn ghost"
                onClick={() => updateSettings({ teamCode: randomTeamCode() })}
              >
                Generar código
              </button>
            ) : null}
            <button className="btn" onClick={() => void connect(state.settings)}>
              Conectar
            </button>
          </div>

          {sync.status === 'error' ? <div className="banner bad">{sync.message}</div> : null}
          {sync.pending > 0 ? (
            <div className="banner">
              {sync.pending} cambios esperando a subir. Se envían solos al recuperar la conexión.
            </div>
          ) : null}

          {isAdmin && canInvite ? (
            <button
              className="btn ghost block"
              onClick={async () => {
                const link = buildInviteLink(state.settings, teamName(state))
                if (navigator.share) {
                  try {
                    await navigator.share({ title: 'Hucha del equipo', url: link })
                    return
                  } catch {
                    // Si cancela el diálogo, caemos en copiar.
                  }
                }
                flash((await copyText(link)) ? 'Enlace copiado' : 'No se ha podido copiar')
              }}
            >
              Invitar al equipo
            </button>
          ) : null}

          {isAdmin && canInvite ? (
            <p className="small muted">
              El enlace deja entrar a anotar saques, nada más. Para administrar hace falta tu
              contraseña, y eso lo comprueba la propia base de datos.
            </p>
          ) : null}
        </div>

        <SectionTitle>Copia de seguridad</SectionTitle>
        <div className="card form">
          <div className="btn-row">
            <button className="btn ghost" onClick={onExport}>
              Exportar
            </button>
            {isAdmin ? (
              <button className="btn ghost" onClick={() => fileRef.current?.click()}>
                Restaurar
              </button>
            ) : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void onImportFile(file)
              event.target.value = ''
            }}
          />

          {isAdmin ? (
            confirmReset ? (
              <div className="stack">
                <p className="small muted center">
                  Se borran jugadoras, partidos, saques y pagos de este móvil. Los ajustes se
                  mantienen, y lo que ya esté en la base de datos del equipo volverá a bajar al
                  conectar.
                </p>
                <div className="btn-row">
                  <button className="btn ghost" onClick={() => setConfirmReset(false)}>
                    Cancelar
                  </button>
                  <button
                    className="btn danger"
                    onClick={() => {
                      resetState()
                      setConfirmReset(false)
                      flash('Datos borrados')
                    }}
                  >
                    Borrar todo
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn quiet" onClick={() => setConfirmReset(true)}>
                Borrar todos los datos de este móvil
              </button>
            )
          ) : null}
        </div>

        {toast ? <div className="banner good">{toast}</div> : null}
      </main>
    </>
  )
}
