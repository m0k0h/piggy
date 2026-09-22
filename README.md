# 🐷 Hucha de saques

Web para móvil que cuenta los saques fallados del equipo de voleibol y lleva la
hucha: cada fallo son 1 € (o lo que decidáis). De paso sale gratis el ratio de
acierto al saque de cada jugadora.

Funciona sin cobertura: los datos se guardan en el propio móvil y se suben
cuando vuelve la conexión. Se puede instalar en la pantalla de inicio como una
app más.

La administradora prepara el equipo y el calendario; el resto solo abre un
partido ya creado y anota. La separación la aplica la base de datos, no la
interfaz.

## Cómo se usa

Los pasos 1 y 2 son de la administradora. Del 3 al 6 los hace cualquiera.

1. **Plantilla** → añade las jugadoras (o impórtalas, ver más abajo).
2. **Partidos** → crea el partido contra el rival de turno.
3. Ábrelo y pulsa **Iniciar partido**: te pregunta quién ha venido a la
   convocatoria. Si aparece alguien de última hora, se añade ahí mismo.
4. Durante el partido, cada vez que saquemos: toca a la jugadora y marca
   **Fallado**, **Dentro** o **Ace**. El contador de fallos y los euros van
   subiendo arriba. Cualquier saque mal anotado se deshace desde la lista.
5. El selector de **Set** sirve para separar las estadísticas por set.
6. Al acabar, **Finalizar**: queda el acta del partido con el ratio de cada una
   y un botón para compartir el resumen por WhatsApp.
7. En **Hucha** se ve quién debe cuánto. La administradora toca a una jugadora
   para registrar lo que paga; el resto lo consulta. El botón de compartir saca
   el estado de cuentas listo para anunciarlo antes del siguiente partido.

## La base de datos del equipo

Sin configurar nada, la app funciona entera pero solo en un móvil. Para que
todas veáis lo mismo en tiempo real hace falta un proyecto gratuito de
Supabase. Se hace una vez:

1. Crea una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo.
2. Abre el **SQL Editor**, pega el contenido de
   [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.
3. **Authentication → Users → Add user**: tu email y una contraseña, con *Auto
   Confirm User* marcado. Ese es tu usuario de administradora. El equipo no
   necesita ninguno.
4. **Project Settings → API**: copia la *Project URL* y la clave *anon*.
5. En la app: **Ajustes → Sincronización**, pega las dos, pulsa **Generar
   código** y luego **Conectar**.
6. **Ajustes → Soy la admin**: entra con el email y la contraseña del paso 3.
   El móvil recuerda la sesión.
7. **Invitar al equipo**: genera un enlace que ya lleva la configuración
   dentro. Quien lo abra entra directo a anotar saques.

El punto verde de la cabecera indica que está sincronizado. Si se va la
conexión en el pabellón, se sigue anotando igual y los cambios suben solos al
volver.

## Quién puede hacer qué

| | Administradora | Resto del equipo |
| --- | --- | --- |
| Plantilla de jugadoras | Crear, editar, quitar | No la ve |
| Calendario de partidos | Crear, editar, borrar, importar | Solo consultar |
| Convocatoria e inicio del partido | Sí | Sí |
| Anotar y corregir saques | Sí | Sí |
| Hucha y estadísticas | Ver y cobrar | Solo ver |
| Nombre del equipo y euros por fallo | Cambiar | Solo ver |

La administradora es simplemente quien ha iniciado sesión. El enlace es el
mismo para todas: **el secreto es la contraseña, no la URL**, que se comparte
por WhatsApp y queda en el historial del navegador.

Y la separación no es cosmética. Las reglas de
[`supabase/schema.sql`](supabase/schema.sql) las aplica Postgres: sin sesión
iniciada, la base de datos solo acepta escrituras en convocatorias y saques.
Un intento de crear una jugadora se rechaza en el servidor aunque alguien
modificara la app en su navegador. Nadie, ni la administradora, puede borrar
filas: la app marca lo borrado con un campo, así que un fallo no se lleva por
delante el historial.

> **Hasta dónde llega:** quien tenga el enlace de invitación puede leer los
> datos del equipo y anotar saques. Es lo que queremos. Pero no guardes aquí
> nada que no dirías en el vestuario.

## Importar desde Sportagia

En **Ajustes → Importar desde Sportagia** (o el botón *Importar* de Partidos y
Plantilla) hay dos caminos:

- **Conexión automática.** Prueba las rutas de API más probables de
  `sportagia.voleimasters.cat`. No hemos podido confirmar cuál usa la web de
  verdad ni si permite peticiones desde otro dominio, así que es posible que el
  navegador la bloquee (CORS).
- **Pegar datos.** Este funciona siempre. Abre la página del equipo, selecciona
  el listado de jugadoras o el calendario, cópialo y pégalo. También acepta
  directamente el JSON que se ve en la pestaña *Red* de las herramientas de
  desarrollo.

El importador entiende formatos variados (`12 Anna Núñez`, `Anna Núñez - 12`,
`25/10/2025 18:30 CV Barcelona`, `dissabte 25 d'octubre de 2025`…) y se salta lo
que ya esté dado de alta, así que se puede reimportar sin miedo a duplicar.

Cuando sepamos el endpoint real de Sportagia, basta con añadirlo a
`candidateEndpoints` en [`src/lib/sportagia.ts`](src/lib/sportagia.ts): el resto
del importador ya está hecho.

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm test         # cuentas, importador, permisos y migración de datos
npm run lint
npm run build    # genera dist/
```

Los tests de `src/lib/__tests__/` cubren las cuentas de la hucha, el parser del
importador, el reparto de permisos y la migración desde el formato anterior.

### Publicar

`.github/workflows/deploy.yml` publica la app en GitHub Pages con cada push a
`main`. Hay que activarlo una vez en **Settings → Pages → Source: GitHub
Actions**. Al usar rutas relativas, el mismo `dist/` vale también para Netlify,
Vercel o cualquier hosting estático.

## Cómo está montado

| Dónde | Qué hay |
| --- | --- |
| `src/types.ts` | El dominio: jugadoras, partidos, convocatorias, saques, pagos. |
| `src/lib/store.ts` | Estado, persistencia en el móvil y migración de formatos. |
| `src/lib/sync.ts` | Conexión con Supabase: sesión, rol, réplica y cola de reintentos. |
| `src/lib/stats.ts` | Ratios, deudas y totales de la hucha. |
| `src/lib/sportagia.ts` | Importador y parser de lo pegado. |
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
