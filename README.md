# 🐷 Hucha de saques

Web para móvil que cuenta los saques fallados del equipo de voleibol y lleva la
hucha: cada fallo son 1 € (o lo que decidáis). De paso sale gratis el ratio de
acierto al saque de cada jugadora.

Funciona sin cobertura: los datos se guardan en el propio móvil y se suben
cuando vuelve la conexión. Se puede instalar en la pantalla de inicio como una
app más.

La administradora prepara el equipo y el calendario desde una zona aparte; el
resto solo abre un partido ya creado y anota. La separación la aplica la base
de datos, no la interfaz.

## Cómo se usa

Los pasos 1 y 2 son de la administradora, en `#/admin`. Del 3 al 7 los hace
cualquiera del equipo.

1. **Jugadoras** → da de alta la plantilla.
2. **Partidos** → crea el partido contra el rival de turno.
3. En la app del equipo, ábrelo y pulsa **Iniciar partido**: te pregunta quién ha venido a la
   convocatoria. Si aparece alguien de última hora, se añade ahí mismo.
4. Durante el partido, cada vez que saquemos: toca a la jugadora y marca
   **Fallado**, **Dentro** o **Ace**. El contador de fallos y los euros van
   subiendo arriba. Cualquier saque mal anotado se deshace desde la lista.
5. El selector de **Set** sirve para separar las estadísticas por set.
6. Al acabar, **Finalizar**: queda el acta del partido con el ratio de cada una
   y un botón para compartir el resumen por WhatsApp.
7. En **Hucha** se ve quién debe cuánto, y el botón de compartir saca el estado
   de cuentas listo para anunciarlo antes del siguiente partido. Los pagos se
   registran desde administración, en **Cobros**.

## La base de datos del equipo

Sin configurar nada, la app funciona entera pero solo en un móvil. Para que
todas veáis lo mismo en tiempo real hace falta un proyecto gratuito de
Supabase. Se hace una vez, y el equipo no toca nada de esto:

1. Crea una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo.
2. Abre el **SQL Editor**, pega el contenido de
   [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.
3. **Authentication → Users → Add user**: tu email y una contraseña, con *Auto
   Confirm User* marcado. Ese es tu acceso de administradora.
4. **Project Settings → API**: copia la *Project URL* y la clave *anon*.
5. En GitHub, en **Settings → Secrets and variables → Actions → New repository
   secret**, crea `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con esos dos
   valores.
6. Vuelve a lanzar el despliegue (**Actions → Desplegar en GitHub Pages → Run
   workflow**). A partir de ahí la app ya sale conectada.

El equipo solo tiene que abrir el enlace: no hay claves que pegar ni códigos
que compartir. Para desarrollar en local, copia `.env.example` a `.env` y pon
ahí los mismos valores.

El punto verde de la cabecera indica que está sincronizado. Si se va la
conexión en el pabellón, se sigue anotando igual y los cambios suben solos al
volver.

## Administración

La app que se abre es la del equipo. La administración vive aparte, en una
dirección a la que no enlaza nada:

```
https://<tu-usuario>.github.io/piggy/#/admin
```

Guárdala en favoritos. Pide tu email y contraseña la primera vez, y el móvil
recuerda la sesión; mientras la tengas abierta aparece un botón **Admin** en la
cabecera para ir y volver.

Desde ahí se gestiona el **equipo** (nombre, escudo, euros por fallo), las
**jugadoras**, los **partidos**, los **cobros** y la **copia de seguridad**.

## Quién puede hacer qué

| | Administradora | Resto del equipo |
| --- | --- | --- |
| Nombre, escudo y euros por fallo | Cambiar | Solo ver |
| Plantilla de jugadoras | Crear, editar, quitar | No la ve |
| Calendario de partidos | Crear, editar, borrar | Solo consultar |
| Convocatoria e inicio del partido | Sí | Sí |
| Anotar y corregir saques | Sí | Sí |
| Hucha y estadísticas | Ver y cobrar | Solo ver |

La separación no es cosmética. Las reglas de
[`supabase/schema.sql`](supabase/schema.sql) las aplica Postgres: sin sesión
iniciada, la base de datos solo acepta escrituras en convocatorias y saques. Un
intento de crear una jugadora se rechaza en el servidor aunque alguien
modificara la app en su navegador. Nadie, ni la administradora, puede borrar
filas: la app marca lo borrado con un campo, así que un fallo no se lleva por
delante el historial.

> **Hasta dónde llega:** la app está publicada en una web pública y no pide
> nada para entrar, así que quien dé con la dirección puede ver los datos del
> equipo y anotar saques. Es el precio de que las chicas no tengan que
> registrarse. Administrar, en cambio, exige tu contraseña. No guardes aquí
> nada que no dirías en el vestuario.

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm test         # cuentas, permisos y migración de datos
npm run lint
npm run build    # genera dist/
```

Los tests de `src/lib/__tests__/` cubren las cuentas de la hucha, el reparto de
permisos y la migración desde el formato anterior.

### Publicar

`.github/workflows/deploy.yml` publica la app en GitHub Pages con cada push a
`main`, inyectando en el build los secretos del repositorio. Hay que activarlo
una vez en **Settings → Pages → Source: GitHub Actions**. Al usar rutas
relativas, el mismo `dist/` vale también para Netlify, Vercel o cualquier
hosting estático.

## Cómo está montado

| Dónde | Qué hay |
| --- | --- |
| `src/types.ts` | El dominio: jugadoras, partidos, convocatorias, saques, pagos. |
| `src/lib/store.ts` | Estado, persistencia en el móvil y migración de formatos. |
| `src/lib/sync.ts` | Conexión con Supabase: sesión, rol, réplica y cola de reintentos. |
| `src/lib/stats.ts` | Ratios, deudas y totales de la hucha. |
| `src/lib/config.ts` | La conexión con la base de datos, leída del entorno. |
| `src/screens/Admin.tsx` | La zona de administración, tras el login. |
| `src/lib/summary.ts` | Los textos que se comparten por WhatsApp. |
| `src/screens/` | Las pantallas. |

Los borrados son lógicos y cada fila lleva `updatedAt`: así dos móviles que
anotan a la vez nunca se pisan, gana siempre la versión más reciente.

La convocatoria y el estado del acta viven en su propia colección (`lineups`),
separados de la ficha del partido. Eso es lo que permite que el equipo pueda
iniciar y cerrar un partido sin tener permiso para tocar la fecha o el rival, y
que la administradora corrija el calendario mientras alguien anota sin que uno
pise al otro.

`PLAYER_WRITABLE` en [`src/types.ts`](src/types.ts) y las políticas de
[`supabase/schema.sql`](supabase/schema.sql) tienen que decir lo mismo; hay un
test que falla si dejan de coincidir.
