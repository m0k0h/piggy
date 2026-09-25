-- Base de datos compartida de la hucha.
--
-- Cómo montarlo, una sola vez:
--
--   1. Crea un proyecto gratuito en https://supabase.com
--   2. SQL Editor → pega este archivo entero → Run
--   3. Authentication → Users → "Add user" → tu email y una contraseña,
--      con "Auto Confirm User" marcado. Ese es tu usuario de administradora;
--      el equipo no necesita ninguno.
--   4. Project Settings → API → copia la "Project URL" y la clave "anon"
--   5. En GitHub: Settings → Secrets and variables → Actions, crea
--      VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY con esos dos valores y
--      vuelve a lanzar el despliegue. Para administrar, entra en #/admin con
--      el email y la contraseña del paso 3.
--
-- Quién puede qué:
--
--   Cualquiera con el enlace (rol `anon`)  → lee todo; escribe solo
--                                            convocatorias y saques.
--   Tú, con la sesión iniciada             → escribe todo: plantilla,
--   (rol `authenticated`)                    calendario, pagos y ajustes.
--
-- Esto no es cosmético: lo aplica Postgres. Aunque alguien modificara la app
-- en su navegador, un intento de crear una jugadora sin sesión se rechaza aquí.
--
-- Nadie puede borrar filas: no hay política de DELETE. La app marca las cosas
-- como borradas con un campo, así que un fallo no se lleva por delante el
-- historial. Para borrar de verdad, desde el panel de Supabase.

create table if not exists public.piggy_rows (
  team_code   text        not null,
  collection  text        not null,
  id          text        not null,
  updated_at  timestamptz not null default now(),
  payload     jsonb       not null,
  primary key (team_code, collection, id)
);

alter table public.piggy_rows drop constraint if exists piggy_rows_collection_check;
alter table public.piggy_rows add constraint piggy_rows_collection_check
  check (collection in ('players', 'matches', 'lineups', 'serves', 'payments', 'team'));

create index if not exists piggy_rows_team_idx on public.piggy_rows (team_code, collection);

alter table public.piggy_rows enable row level security;

-- El código del equipo es lo que separa a unos equipos de otros y lo que hace
-- falta para leer. Sale de VITE_TEAM_CODE (por defecto "equipo-principal"):
-- aquí solo exigimos que no sea trivialmente corto.
drop policy if exists "leer con el codigo del equipo" on public.piggy_rows;
create policy "leer con el codigo del equipo"
  on public.piggy_rows for select
  to anon, authenticated
  using (length(team_code) >= 6);

-- El equipo anota el partido: quién vino y cómo fue cada saque. Nada más.
-- La lista de colecciones es la misma que `PLAYER_WRITABLE` en src/types.ts.
drop policy if exists "el equipo anota el partido" on public.piggy_rows;
create policy "el equipo anota el partido"
  on public.piggy_rows for insert
  to anon
  with check (length(team_code) >= 6 and collection in ('lineups', 'serves'));

drop policy if exists "el equipo corrige lo que anoto" on public.piggy_rows;
create policy "el equipo corrige lo que anoto"
  on public.piggy_rows for update
  to anon
  using (collection in ('lineups', 'serves'))
  with check (length(team_code) >= 6 and collection in ('lineups', 'serves'));

-- Con sesión iniciada: plantilla, calendario, pagos y ajustes del equipo.
drop policy if exists "la admin prepara el equipo" on public.piggy_rows;
create policy "la admin prepara el equipo"
  on public.piggy_rows for insert
  to authenticated
  with check (length(team_code) >= 6);

drop policy if exists "la admin corrige el equipo" on public.piggy_rows;
create policy "la admin corrige el equipo"
  on public.piggy_rows for update
  to authenticated
  using (length(team_code) >= 6)
  with check (length(team_code) >= 6);

-- Visitas: qué pantallas abre el equipo, para el panel de administración.
-- Tabla aparte porque no es dato del equipo: no viaja a los móviles ni entra
-- en la réplica. Cada móvil lleva un identificador al azar (`visitor`), que
-- sirve para contar personas distintas sin saber quién es quién.
--
-- Cualquiera apunta su visita; solo la administradora las lee. Como el resto,
-- no se borra desde la app: si algún día quieres vaciarla, desde el panel de
-- Supabase.
create table if not exists public.piggy_views (
  id          bigint      generated always as identity primary key,
  team_code   text        not null,
  view        text        not null,
  visitor     text        not null,
  standalone  boolean     not null default false,
  created_at  timestamptz not null default now()
);

alter table public.piggy_views drop constraint if exists piggy_views_view_check;
alter table public.piggy_views add constraint piggy_views_view_check
  check (view in ('hucha', 'partidos', 'stats', 'partido'));

create index if not exists piggy_views_team_idx on public.piggy_views (team_code, created_at);

alter table public.piggy_views enable row level security;

drop policy if exists "cualquiera apunta su visita" on public.piggy_views;
create policy "cualquiera apunta su visita"
  on public.piggy_views for insert
  to anon, authenticated
  with check (length(team_code) >= 6 and length(visitor) <= 64);

drop policy if exists "la admin ve las visitas" on public.piggy_views;
create policy "la admin ve las visitas"
  on public.piggy_views for select
  to authenticated
  using (length(team_code) >= 6);

-- Realtime: que cada saque anotado aparezca en el resto de móviles sin recargar.
do $$
begin
  alter publication supabase_realtime add table public.piggy_rows;
exception
  when duplicate_object then null;
end
$$;
