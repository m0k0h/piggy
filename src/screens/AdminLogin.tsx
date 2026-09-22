import { useState } from 'react'
import { signIn, signOut, useSync } from '../lib/sync'
import { Sheet } from '../ui/Sheet'
import { Field } from '../ui/bits'

/**
 * Entrada de la administradora. La contraseña es el secreto, no el enlace:
 * el equipo abre exactamente la misma dirección.
 */
export function AdminLogin({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError('')
    const result = await signIn(email, password)
    setBusy(false)
    if (result.ok) onClose()
    else setError(result.message)
  }

  return (
    <Sheet title="Entrar como administradora" onClose={onClose}>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <p className="small muted">
          El usuario que creaste en Supabase. Solo hace falta una vez: el móvil
          recuerda la sesión.
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
        <button className="btn block" type="submit" disabled={busy || !email.trim() || !password}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </Sheet>
  )
}

/** Fila de Ajustes que muestra quién eres y permite entrar o salir. */
export function AdminSwitch() {
  const sync = useSync()
  const [opening, setOpening] = useState(false)

  if (sync.status === 'off') {
    return (
      <p className="small muted">
        Sin base de datos compartida no hay roles: esta app es solo tuya y puedes
        hacerlo todo.
      </p>
    )
  }

  return (
    <>
      <div className="spread">
        <span className={sync.signedIn ? 'role-pill admin' : 'role-pill'}>
          {sync.signedIn ? `Administradora · ${sync.email}` : 'Vista de jugadora'}
        </span>
        {sync.signedIn ? (
          <button className="btn quiet" onClick={() => void signOut()}>
            Salir
          </button>
        ) : (
          <button className="btn small" onClick={() => setOpening(true)}>
            Soy la admin
          </button>
        )}
      </div>
      {opening ? <AdminLogin onClose={() => setOpening(false)} /> : null}
    </>
  )
}
