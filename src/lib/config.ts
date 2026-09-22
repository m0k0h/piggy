/**
 * Conexión con la base de datos del equipo.
 *
 * Sale de variables de entorno en tiempo de compilación (`.env` en local,
 * secretos del repositorio al desplegar), no de nada que haya que teclear en
 * el móvil. Quien abre la app ya está conectada al equipo.
 *
 * La clave `anon` es pública por diseño: viaja en el JavaScript de cualquier
 * web hecha con Supabase. Lo que protege los datos son las políticas de
 * `supabase/schema.sql`, no el secreto de esta clave.
 */
export interface TeamConfig {
  url: string
  anonKey: string
  /** Separa equipos dentro del mismo proyecto. Con uno solo, da igual cuál sea. */
  code: string
}

/**
 * La web de Supabase enseña la Project URL justo al lado del endpoint REST
 * (`.../rest/v1/`), y es fácil copiar el que no toca. El cliente ya añade
 * esas rutas por su cuenta, así que si alguien pega de más nos quedamos solo
 * con el origen y la app sigue funcionando igual.
 */
export function normalizeSupabaseUrl(value: string): string {
  if (!value) return value
  try {
    return new URL(value).origin
  } catch {
    return value
  }
}

const url = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL?.trim() ?? '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
const code = import.meta.env.VITE_TEAM_CODE?.trim() || 'equipo-principal'

/** `null` cuando no hay base de datos: la app funciona igual, solo en este móvil. */
export const teamConfig: TeamConfig | null = url && anonKey ? { url, anonKey, code } : null
