-- Permiso TEMPORAL para borrar los partidos de prueba desde la app.
--
-- `schema.sql` no deja borrar filas a nadie, a propósito. Para la limpieza de
-- una vez (Administración → "Borrar todos los partidos"):
--
--   1. SQL Editor → pega el bloque "ABRIR" → Run
--   2. En la app, con tu sesión, pulsa el botón y confírmalo
--   3. SQL Editor → pega el bloque "CERRAR" → Run
--
-- Solo abre partidos, convocatorias y saques, y solo con sesión iniciada.
-- Jugadoras, cobros y datos del equipo no se pueden borrar ni con esto.

-- ABRIR ---------------------------------------------------------------------
drop policy if exists "borrado temporal de partidos" on public.piggy_rows;
create policy "borrado temporal de partidos"
  on public.piggy_rows for delete
  to authenticated
  using (collection in ('matches', 'lineups', 'serves'));

-- CERRAR (cuando hayas terminado) --------------------------------------------
-- drop policy if exists "borrado temporal de partidos" on public.piggy_rows;
