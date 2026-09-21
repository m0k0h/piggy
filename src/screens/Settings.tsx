import { useRef, useState } from 'react'
import { buildInviteLink, randomTeamCode } from '../lib/invite'
import { goBack, navigate } from '../lib/router'
import { copyText } from '../lib/summary'
import { exportState, importState, resetState, updateSettings, useAppState } from '../lib/store'
import { connect, useSync } from '../lib/sync'
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
  const { settings } = state

  const [fine, setFine] = useState(String(settings.fineAmount))
  const [lastFine, setLastFine] = useState(settings.fineAmount)
  const [toast, setToast] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Si el importe cambia por sincronización o por un enlace de invitación,
  // refrescamos el campo sin pisar lo que se esté tecleando.
  if (lastFine !== settings.fineAmount) {
    setLastFine(settings.fineAmount)
    setFine(String(settings.fineAmount))
  }

  const flash = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 2500)
  }

  const commitFine = () => {
    const value = Number(fine.replace(',', '.'))
    if (Number.isFinite(value) && value >= 0) updateSettings({ fineAmount: value })
    else setFine(String(settings.fineAmount))
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

  const canShare = Boolean(settings.supabaseUrl && settings.supabaseAnonKey && settings.teamCode)

  return (
    <>
      <ScreenHeader title="Ajustes" onBack={goBack} />
      <main>
        <SectionTitle>Equipo</SectionTitle>
        <div className="card form">
          <Field label="Nombre del equipo">
            <input
              value={settings.teamName}
              onChange={(event) => updateSettings({ teamName: event.target.value })}
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

        <SectionTitle
          aside={
            <span className="inline">
              <span className={`dot ${sync.status}`} />
              <span className="small">{STATUS_TEXT[sync.status]}</span>
            </span>
          }
        >
          Compartir con el equipo
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
            <button
              className="btn ghost"
              onClick={() => updateSettings({ teamCode: randomTeamCode() })}
            >
              Generar código
            </button>
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

          {canShare ? (
            <button
              className="btn ghost block"
              onClick={async () => {
                const link = buildInviteLink(state.settings)
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
        </div>

        <SectionTitle>Copia de seguridad</SectionTitle>
        <div className="card form">
          <div className="btn-row">
            <button className="btn ghost" onClick={onExport}>
              Exportar
            </button>
            <button className="btn ghost" onClick={() => fileRef.current?.click()}>
              Restaurar
            </button>
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

          {confirmReset ? (
            <div className="stack">
              <p className="small muted center">
                Se borran jugadoras, partidos, saques y pagos de este móvil. Los ajustes se
                mantienen.
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
              Borrar todos los datos
            </button>
          )}
        </div>

        {toast ? <div className="banner good">{toast}</div> : null}
      </main>
    </>
  )
}
