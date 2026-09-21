# 🐷 Hucha de saques

Web para móvil que cuenta los saques fallados del equipo de voleibol y lleva la
hucha: cada fallo son 1 € (o lo que decidáis). De paso sale gratis el ratio de
acierto al saque de cada jugadora.

Funciona sin cobertura: los datos se guardan en el propio móvil y se suben
cuando vuelve la conexión. Se puede instalar en la pantalla de inicio como una
app más.

## Cómo se usa

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
7. En **Hucha** ves quién debe cuánto; al tocar a una jugadora se registra lo
   que paga. También puedes compartir el estado de cuentas para anunciarlo
   antes del siguiente partido.

## Compartir la hucha con todo el equipo

Sin configurar nada, la app funciona entera pero solo en un móvil. Para que
todas veáis lo mismo en tiempo real hace falta un proyecto gratuito de
Supabase:

1. Crea una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo.
2. Abre el **SQL Editor**, pega el contenido de
   [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.
3. En **Project Settings → API** copia la *Project URL* y la clave *anon*.
4. En la app: **Ajustes → Compartir con el equipo**, pega las dos, pulsa
   **Generar código** y luego **Conectar**.
5. Pulsa **Invitar al equipo**: se genera un enlace que ya lleva dentro la
   configuración. Quien lo abra entra directo a la misma hucha.

El punto verde de la cabecera indica que está sincronizado. Si se va la
conexión en el pabellón, se sigue anotando igual y los cambios suben solos al
volver.

> **Sobre la privacidad:** quien tenga el enlace de invitación puede leer y
> escribir los datos del equipo. Es suficiente para una hucha de saques, pero
> no guardes aquí nada sensible.

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
npm test         # tests de la lógica de cuentas y del importador
npm run lint
npm run build    # genera dist/
```

El flujo completo (crear plantilla, jugar un partido, cobrar, importar) está
cubierto por los tests de `src/lib/__tests__/`.

### Publicar

`.github/workflows/deploy.yml` publica la app en GitHub Pages con cada push a
`main`. Hay que activarlo una vez en **Settings → Pages → Source: GitHub
Actions**. Al usar rutas relativas, el mismo `dist/` vale también para Netlify,
Vercel o cualquier hosting estático.

## Cómo está montado

| Dónde | Qué hay |
| --- | --- |
| `src/types.ts` | El dominio: jugadoras, partidos, saques, pagos. |
| `src/lib/store.ts` | Estado y persistencia en el móvil. |
| `src/lib/sync.ts` | Sincronización con Supabase (opcional, con cola de reintentos). |
| `src/lib/stats.ts` | Ratios, deudas y totales de la hucha. |
| `src/lib/sportagia.ts` | Importador y parser de lo pegado. |
| `src/lib/summary.ts` | Los textos que se comparten por WhatsApp. |
| `src/screens/` | Las pantallas. |

Los borrados son lógicos y cada fila lleva `updatedAt`: así dos móviles que
anotan a la vez nunca se pisan, gana siempre la versión más reciente.
