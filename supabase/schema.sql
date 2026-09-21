-- Esquema para compartir la hucha entre los móviles del equipo.
--
-- Cómo usarlo:
--   1. Crea un proyecto gratuito en https://supabase.com
--   2. Abre el "SQL Editor" del proyecto y pega este archivo entero
--   3. Pulsa "Run"
--   4. En Project Settings → API copia la "Project URL" y la clave "anon"
--      y pégalas en Ajustes → Compartir con el equipo dentro de la app
--
-- Todo el estado viaja en una sola tabla con el documento en JSON: así el
-- esquema no cambia cada vez que la app gana un campo nuevo, y basta una
-- suscripción de realtime para que todas veáis lo mismo al instante.

create table if not exists public.piggy_rows (
  team_code   text        not null,
  collection  text        not null check (collection in ('players', 'matches', 'serves', 'payments')),
  id          text        not null,
  updated_at  timestamptz not null default now(),
  payload     jsonb       not null,
  primary key (team_code, collection, id)
);

create index if not exists piggy_rows_team_idx on public.piggy_rows (team_code, collection);

alter table public.piggy_rows enable row level security;

-- El código del equipo es el secreto que da acceso: quien lo tenga (junto con
-- la clave anon, que la app lleva dentro) puede leer y escribir los datos de
-- ese equipo. Es suficiente para una hucha de saques, pero no guardes aquí
-- nada que no dirías en el vestuario. Usa el botón "Generar código" de la app,
-- que crea uno largo y aleatorio, en vez de inventarte uno corto.
drop policy if exists "acceso con código de equipo" on public.piggy_rows;
create policy "acceso con código de equipo"
  on public.piggy_rows
  for all
  to anon, authenticated
  using (length(team_code) >= 6)
  with check (length(team_code) >= 6);

-- Realtime: que cada saque anotado aparezca en el resto de móviles sin recargar.
do $$
begin
  alter publication supabase_realtime add table public.piggy_rows;
exception
  when duplicate_object then null;
end
$$;
