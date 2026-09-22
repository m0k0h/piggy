# Hucha de saques

App de voleibol para contar saques fallados y llevar la hucha del equipo. Ver
`README.md` para cómo está montada, cómo se despliega y el reparto de
permisos entre administradora y equipo.

## Guía de estilo

El diseño visual de la app sigue **`docs/ESTILO.md`**: el encargo de
rediseño original (tokens de color, tipografía Outfit + Plus Jakarta Sans,
radios, iconos de trazo). Cualquier pantalla o componente nuevo debe leerlo
primero y reutilizar lo que ya existe en vez de inventar valores sueltos.

Lo que hay que saber para aplicarlo sin releer todo el documento:

- **Una sola hoja de estilos**, `src/styles.css`. Tokens en `:root`, sin
  tema claro: la app es oscura siempre (`docs/ESTILO.md` no describe un
  modo claro, así que el ciruela oscuro es la identidad, no una opción).
- **No se renombran clases para acercarlas al vocabulario del documento.**
  Cuando el encargo habla de `.hero`, `.tarjeta`, `.fila`, `.boton`,
  `.antetitulo` o `.nav`, en el código son `.pot`, `.card`, `.row`, `.btn`,
  `.section-title` y `.tabbar` respectivamente — los nombres que ya tenía la
  app. Se adaptan los *valores* (color, tipografía, radio, tamaño) del
  selector existente, no se reestructura el componente. Ante un encargo de
  diseño nuevo, sigue esa misma regla: manda la estructura de la app.
- **Iconos:** todos viven en `src/ui/icons.tsx`, un componente por icono,
  mismo lenguaje visual (lienzo 24×24, trazo 1.8, `currentColor`, esquinas
  redondeadas). `docs/ESTILO.md` solo da el SVG de 7 (pelota, barras,
  calendario, más, chevron, cerdita a color, cerdita de trazo); el resto
  (escudo, personas, monedas, guardar, check, aspa, estrella, fiesta,
  encogimiento de hombros, portapapeles) están diseñados a mano siguiendo el
  mismo estilo porque la app usa más emojis de los que el documento cubre
  explícitamente. Si hace falta un icono que no está, créalo ahí con el
  mismo lenguaje en vez de meter un emoji o una librería nueva.
- **No queda ni un emoji en la interfaz** — ver la regla de comprobación al
  final de `docs/ESTILO.md`. Excepción a propósito: `src/lib/summary.ts`
  (los textos que se comparten por WhatsApp) sí lleva emojis, porque es
  contenido para fuera de la app, no interfaz.
- El componente `Empty` (`src/ui/bits.tsx`) pinta los estados vacíos:
  `icon` es el SVG y `highlight` (booleano) da el círculo rosa tenue de
  fondo — reservado para "la hucha está vacía" (`src/screens/Pot.tsx`), que
  es la identidad de esa pantalla. El resto de estados vacíos usa el icono
  a secas, sin el círculo, para no repetir ese tratamiento por todas partes.
- Money/cuentas usan `font-variant-numeric: tabular-nums` (ya aplicado a
  `.pot .amount`, `.stat .v`, `.row .trail .big`) para que las cifras no
  bailen al cambiar. Si añades una cifra nueva que se actualice en vivo,
  añádela a esa regla.
- Los campos de formulario (`.field input/select/textarea`) se quedan en
  16px de tamaño de letra pase lo que pase con la escala tipográfica del
  resto de la app: por debajo de eso, iOS hace zoom automático al enfocar.

## Comandos

```bash
npm install
npm run dev      # servidor local
npm test         # cuentas, permisos y migración de datos
npm run lint
npm run build    # genera dist/
```
