import { useMemo, useState } from 'react'
import { readInvite } from '../lib/invite'
import { navigate } from '../lib/router'
import { getState, updateSettings } from '../lib/store'
import { connect } from '../lib/sync'
import { Empty, ScreenHeader } from '../ui/bits'

/** Pantalla a la que lleva el enlace de invitación del equipo. */
export function Join({ token }: { token: string }) {
  const invite = useMemo(() => readInvite(token), [token])
  const [busy, setBusy] = useState(false)

  if (!invite) {
    return (
      <>
        <ScreenHeader title="Unirse al equipo" onBack={() => navigate('hucha')} />
        <main>
          <div className="card">
            <Empty glyph="🔗" title="El enlace no es válido">
              Pide que te lo vuelvan a enviar desde Ajustes → Invitar al equipo.
            </Empty>
            <button className="btn block" onClick={() => navigate('hucha')}>
              Ir a la hucha
            </button>
          </div>
        </main>
      </>
    )
  }

  const join = async () => {
    setBusy(true)
    updateSettings(invite.settings)
    await connect(getState().settings)
    navigate('hucha')
  }

  return (
    <>
      <ScreenHeader title="Unirse al equipo" onBack={() => navigate('hucha')} />
      <main>
        <div className="card stack center">
          <span style={{ fontSize: 44 }} aria-hidden="true">
            🐷
          </span>
          <h2>{invite.teamName}</h2>
          <p className="small muted">
            Vas a compartir hucha, plantilla y partidos con el resto del equipo. Lo que anotes se
            verá en todos los móviles.
          </p>
          <button className="btn block" onClick={() => void join()} disabled={busy}>
            {busy ? 'Conectando…' : 'Unirme'}
          </button>
        </div>
      </main>
    </>
  )
}
