import { useState } from 'react'
import { euros, percent, plural } from '../lib/format'
import { navigate } from '../lib/router'
import { addPlayer, removePlayer, updatePlayer, useAppState } from '../lib/store'
import { balances } from '../lib/stats'
import type { Player } from '../types'
import { Sheet } from '../ui/Sheet'
import { Avatar, Empty, Field, SectionTitle } from '../ui/bits'

type Editing = Player | 'new' | null

export function Roster() {
  const state = useAppState()
  const rows = balances(state)
  const [editing, setEditing] = useState<Editing>(null)

  return (
    <>
      <SectionTitle aside={<span>{rows.length}</span>}>Plantilla</SectionTitle>

      {rows.length === 0 ? (
        <div className="card">
          <Empty glyph="🏐" title="Todavía no hay jugadoras">
            Añádelas a mano o impórtalas desde Sportagia.
          </Empty>
          <div className="btn-row">
            <button className="btn ghost" onClick={() => navigate('importar')}>
              Importar
            </button>
            <button className="btn" onClick={() => setEditing('new')}>
              Añadir
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card flush">
            <div className="list">
              {rows.map(({ player, tally, pending }) => (
                <button key={player.id} className="row" onClick={() => setEditing(player)}>
                  <Avatar name={player.name} />
                  <span className="grow">
                    <span className="title">{player.name}</span>
                    <span className="meta">
                      {player.number ? `Dorsal ${player.number} · ` : ''}
                      {plural(tally.attempts, 'saque', 'saques')} · {percent(tally.ratio)} dentro
                    </span>
                  </span>
                  <span className="trail">
                    <span className={pending > 0 ? 'chip money' : 'chip good'}>
                      {pending > 0 ? euros(pending) : 'al día'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="btn-row">
            <button className="btn ghost" onClick={() => navigate('importar')}>
              Importar
            </button>
            <button className="btn" onClick={() => setEditing('new')}>
              Añadir jugadora
            </button>
          </div>
        </>
      )}

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
