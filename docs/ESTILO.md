# Rediseño visual de Hucha de Saques

Encargo para aplicar sobre el repo `m0k0h/piggy` (la app que se publica en
`https://m0k0h.github.io/piggy/`). Es un cambio **solo visual**: no toca la lógica, ni el
almacenamiento, ni las rutas. Si algo de aquí choca con cómo está montada la app, manda la
estructura de la app y adapta los valores, no al revés.

Referencia visual: hay un lienzo de diseño con las cuatro pantallas maquetadas. Esto es su
traducción a código.

---

## 1. Qué se cambia, en una frase

Se sustituye el rosa degradado genérico y la tipografía del sistema por una identidad propia:
fondo ciruela oscuro, un rosa magenta de marca, tipografía Outfit + Plus Jakarta Sans, iconos SVG
en vez de emojis, y una cerdita rosa como logo.

---

## 2. Fuentes

Añadir en el `<head>` de `index.html` (antes de los estilos):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap">
```

- **Outfit** → cifras grandes y títulos (600/700/800).
- **Plus Jakarta Sans** → todo lo demás (400/500/600/700).

Nada más usa otra familia. Si la app ya cargaba otra fuente, se retira.

---

## 3. Tokens

Reemplazar las variables de color actuales por estas (en el CSS global / `:root`):

```css
:root {
  /* Acento */
  --rosa: #ff3d8a;              /* botones, píldora activa de la nav, barras */
  --rosa-pulsado: #e12a72;      /* :active / :hover de los botones */
  --rosa-texto: #ff7faf;        /* importes y antetítulos sobre fondo oscuro */
  --rosa-tinte: rgba(255, 61, 138, .18);  /* fondo de distintivos rosas */
  --sobre-rosa: #2a1020;        /* texto/icono ENCIMA del rosa vivo */
  --hero: linear-gradient(135deg, #d42a7d 0%, #a51f79 100%);

  /* Cerdita */
  --cerdita: #ffa8c6;
  --cerdita-oscuro: #ff6fa5;
  --morro: #ffd3e3;
  --colorete: #ff85b3;
  --ojo: #3a2436;
  --ranura: #c4477e;

  /* Superficies */
  --fondo: #17121c;
  --tarjeta: #221b28;
  --nav: #1c1622;
  --borde: #332a3b;
  --borde-fuerte: #4a3d52;
  --divisor: #2b2333;

  /* Texto */
  --texto: #f7f2f6;
  --texto-suave: #a79bb0;
  --texto-tenue: #7b7086;   /* solo iconos pequeños, nunca texto */

  /* Estado pagado */
  --ok-fondo: #dff3e6;
  --ok-texto: #0b6b3a;

  /* Tipografía */
  --display: 'Outfit', system-ui, sans-serif;
  --cuerpo: 'Plus Jakarta Sans', system-ui, sans-serif;

  /* Radios */
  --r-boton: 12px;
  --r-tarjeta: 20px;
  --r-pildora: 999px;

  /* Sombra */
  --sombra-hero: 0 10px 28px rgba(165, 31, 121, .35);
}

body {
  margin: 0;
  background: var(--fondo);
  color: var(--texto);
  font-family: var(--cuerpo);
  -webkit-font-smoothing: antialiased;
}
```

**Regla de contraste, importante:** el rosa vivo `--rosa` lleva SIEMPRE texto oscuro
(`--sobre-rosa`) encima, nunca blanco. El blanco solo va sobre el degradado `--hero`, que es más
oscuro a propósito para que el texto pequeño se lea. Sobre tarjetas oscuras, el rosa de texto es
`--rosa-texto`, nunca `--rosa`.

---

## 4. Escala tipográfica

| Uso | Familia | Tamaño | Peso | Tracking |
|---|---|---|---|---|
| Cifra del hero | Outfit | 62 px | 800 | −0.035em |
| Cifra de tarjeta (36 €, 86 %) | Outfit | 34 px | 800 | −0.03em |
| Título de pantalla (Partidos, Stats) | Outfit | 23 px | 800 | −0.025em |
| Título de tarjeta / nombre de equipo | Outfit | 16–19 px | 700 | −0.015em |
| Importe en fila de lista | Outfit | 16.5 px | 800 | — |
| Antetítulo (QUIÉN DEBE, PRÓXIMO) | Jakarta | 10.5–11 px | 700 | +0.14em, mayúsculas |
| Fila de lista | Jakarta | 14.5 px | 600 | — |
| Secundario | Jakarta | 11.5–12 px | 400 | — |
| Etiqueta de nav | Jakarta | 10.5 px | 700 | — |

Todo lo que sea dinero o cuenta lleva `font-variant-numeric: tabular-nums;` para que no baile al
actualizarse.

---

## 5. Componentes

```css
/* ---- Cabecera ---- */
.cabecera {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #251e2c;
  background: var(--fondo);
}
.cabecera__titulo { font-family: var(--display); font-size: 19px; font-weight: 700; letter-spacing: -0.015em; }
.cabecera__sub    { font-size: 12px; color: var(--texto-suave); }

/* ---- Hero de la hucha ---- */
.hero {
  position: relative; overflow: hidden;
  background: var(--hero);
  border-radius: var(--r-tarjeta);
  padding: 20px;
  box-shadow: var(--sombra-hero);
  color: #fff;
}
.hero__antetitulo { font-size: 11px; font-weight: 700; letter-spacing: .14em; }
.hero__cifra {
  font-family: var(--display); font-size: 62px; font-weight: 800;
  letter-spacing: -0.035em; line-height: 1; margin-top: 8px;
  font-variant-numeric: tabular-nums;
}
.hero__nota  { font-size: 12.5px; margin-top: 6px; }
.hero__tiles { display: flex; gap: 8px; margin-top: 16px; }
.hero__tile  { flex: 1; background: rgba(42, 16, 32, .30); border-radius: 12px; padding: 10px 12px; }
.hero__tile-label { font-size: 10px; font-weight: 700; letter-spacing: .1em; }
.hero__tile-valor { font-family: var(--display); font-size: 19px; font-weight: 800; margin-top: 2px; font-variant-numeric: tabular-nums; }
/* La cerdita de marca de agua: <CerditaLinea> dentro del .hero */
.hero__marca { position: absolute; right: -28px; bottom: -34px; width: 168px; opacity: .16; }
/* El texto del hero va en un hijo con position: relative para quedar por encima */

/* ---- Tarjeta ---- */
.tarjeta {
  background: var(--tarjeta);
  border: 1px solid var(--borde);
  border-radius: var(--r-tarjeta);
}

/* ---- Antetítulo de sección ---- */
.antetitulo {
  font-size: 10.5px; font-weight: 700; letter-spacing: .14em;
  color: var(--texto-suave); padding: 0 2px;
}

/* ---- Botones ---- */
.boton {
  height: 46px; border: none; border-radius: var(--r-boton);
  background: var(--rosa); color: var(--sobre-rosa);
  font-family: var(--cuerpo); font-size: 14.5px; font-weight: 700; letter-spacing: -0.01em;
  cursor: pointer; transition: background 120ms cubic-bezier(.2,.9,.2,1), transform 120ms;
}
.boton:hover  { background: var(--rosa-pulsado); }
.boton:active { transform: scale(.98); }
.boton--fantasma {
  background: var(--fondo); color: var(--texto);
  border: 1px solid var(--borde-fuerte);
}
.boton--fantasma:hover { background: var(--tarjeta); }

/* ---- Distintivos ---- */
.chip {
  padding: 4px 9px; border-radius: var(--r-pildora);
  font-size: 10px; font-weight: 700; letter-spacing: .06em;
}
.chip--pagado { background: var(--ok-fondo); color: var(--ok-texto); }
.chip--rosa   { background: var(--rosa-tinte); color: var(--rosa-texto); }
.chip--neutro { background: var(--borde); color: var(--texto); }

/* ---- Fila de lista (quién debe) ---- */
.fila { display: flex; align-items: center; gap: 12px; padding: 12px 16px; }
.fila + .fila { border-top: 1px solid var(--divisor); }
.fila__avatar {
  width: 36px; height: 36px; border-radius: var(--r-pildora);
  display: flex; align-items: center; justify-content: center;
  background: var(--borde); font-size: 12.5px; font-weight: 700;
}
.fila__nombre  { font-size: 14.5px; font-weight: 600; }
.fila__sub     { font-size: 11.5px; color: var(--texto-suave); }
.fila__importe {
  font-family: var(--display); font-size: 16.5px; font-weight: 800;
  color: var(--rosa-texto); font-variant-numeric: tabular-nums;
}
.fila__importe--pagado { color: var(--texto-suave); text-decoration: line-through; }

/* ---- Barra de ranking ---- */
.barra      { height: 8px; border-radius: var(--r-pildora); background: var(--borde); overflow: hidden; }
.barra__fill{ height: 8px; border-radius: var(--r-pildora); background: var(--rosa); }

/* ---- Nav inferior ---- */
.nav {
  display: flex; gap: 6px;
  padding: 8px 12px calc(20px + env(safe-area-inset-bottom));
  background: var(--nav); border-top: 1px solid var(--borde);
}
.nav__item {
  flex: 1; height: 56px; border-radius: var(--r-pildora);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  color: var(--texto-suave); text-decoration: none;
  font-size: 10.5px; font-weight: 700;
}
.nav__item--activo { background: var(--rosa); color: var(--sobre-rosa); }
```

Detalles de maquetación que importan:

- Contenido de las pantallas: `padding: 18px 20px 0` y `gap: 18px` entre secciones.
- Todo lo pulsable mide 44 px de alto como mínimo (56 en la nav).
- Los iconos de la nav son de trazo y heredan `currentColor`, así que cambian de color solos entre
  activo e inactivo.

---

## 6. La cerdita

Van dos versiones. Ambas son componentes, sin dependencias.

**A color** — cabecera, estados vacíos, tarjetas:

```jsx
export function Cerdita({ size = 38 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M52 33c6-2 7.5 4.5 2.2 6-2.8.8-3.8-2.2-1.2-3" fill="none" stroke="var(--cerdita-oscuro)" strokeWidth="3" strokeLinecap="round" />
      <path d="M15.5 21 12.6 8.2c-.4-1.8 1-2.6 2.4-1.7L27 13.8Z" fill="var(--cerdita-oscuro)" />
      <path d="M48.5 21l2.9-12.8c.4-1.8-1-2.6-2.4-1.7L37 13.8Z" fill="var(--cerdita-oscuro)" />
      <ellipse cx="32" cy="36" rx="24" ry="20.5" fill="var(--cerdita)" />
      <ellipse cx="17" cy="41" rx="4" ry="2.6" fill="var(--colorete)" />
      <ellipse cx="47" cy="41" rx="4" ry="2.6" fill="var(--colorete)" />
      <rect x="25" y="18" width="14" height="3.6" rx="1.8" fill="var(--ranura)" />
      <circle cx="22.5" cy="33" r="2.7" fill="var(--ojo)" />
      <path d="M38.5 33.4c1.6-2.2 3.8-2.2 5.4 0" fill="none" stroke="var(--ojo)" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="32" cy="45" rx="11.5" ry="8.5" fill="var(--morro)" />
      <ellipse cx="28.2" cy="45" rx="2" ry="2.6" fill="var(--cerdita-oscuro)" />
      <ellipse cx="35.8" cy="45" rx="2" ry="2.6" fill="var(--cerdita-oscuro)" />
    </svg>
  );
}
```

El ojo derecho es un guiño: es un arco, no un círculo. Que no se «arregle».

**De trazo** — nav y marca de agua del hero:

```jsx
export function CerditaLinea({ size = 22, ...props }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5.6 8.4 4.7 4.6c-.1-.5.3-.8.8-.6l3.6 1.6" />
      <path d="m18.4 8.4.9-3.8c.1-.5-.3-.8-.8-.6l-3.6 1.6" />
      <path d="M12 6.4c5 0 9 3.2 9 7.2s-4 7.2-9 7.2-9-3.2-9-7.2 4-7.2 9-7.2Z" />
      <ellipse cx="12" cy="15.3" rx="3.5" ry="2.7" />
      <path d="M10.8 15.3h.01" /><path d="M13.2 15.3h.01" /><path d="M8.2 11.7h.01" />
    </svg>
  );
}
```

**Icono de la app / favicon:** la cerdita de trazo en blanco, centrada dentro de un cuadrado
redondeado (radio ~28 % del lado) con el degradado `--hero` de fondo. Sustituye al favicon actual.

---

## 7. Los otros iconos (fuera emojis)

La app usa emojis (🐷 🗓️ 📊 🏐) como iconos. Se sustituyen todos por SVG de trazo de 24 px,
`stroke="currentColor"`, `stroke-width="1.8"`:

```jsx
// Partidos (pelota)
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
  <circle cx="12" cy="12" r="9" />
  <path d="M5.6 5.6c3.5 2.9 4.5 9 2.5 13.1" />
  <path d="M18.4 5.6c-3.5 2.9-4.5 9-2.5 13.1" />
</svg>

// Stats (barras)
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
  <path d="M4 20V11" /><path d="M10 20V4" /><path d="M16 20v-6" /><path d="M21 20H3" />
</svg>

// Calendario (sin partidos)
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
  <rect x="3" y="5" width="18" height="16" rx="3" />
  <path d="M8 3v4" /><path d="M16 3v4" /><path d="M3 11h18" />
</svg>

// Más (anotar)
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
  <path d="M12 5v14" /><path d="M5 12h14" />
</svg>

// Chevron (fin de fila)
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
  <path d="m9 6 6 6-6 6" />
</svg>
```

Los iconos a secas (sin texto al lado) llevan `aria-label`; los que acompañan a un texto llevan
`aria-hidden="true"`.

---

## 8. Estado vacío de la hucha

Hoy es un emoji con dos líneas. Pasa a: círculo de `rgba(255,61,138,.14)` de 112 px con la cerdita
a color de 74 px dentro, título en Outfit 19 px/700, texto de apoyo en `--texto-suave` a 13 px con
`max-width: 250px` y centrado, y debajo un botón fantasma **«Crear un partido»**.

El hero se mantiene visible aunque esté a 0 € — es la identidad de la pantalla, no un dato más.

---

## 9. Textos

El equipo es de chicas. Revisar que todo concuerde en femenino («12 jugadoras», «lo que debe cada
una»). En el estado vacío, la nota del hero es: «Ni un saque fallado todavía. Va a durar poco.»

---

## 10. Comprobar al terminar

- A 375 px de ancho no hay scroll horizontal en ninguna de las tres pestañas.
- Ningún texto pequeño blanco sobre `--rosa` (solo sobre `--hero`).
- Las cifras no cambian de ancho al pasar de 9 € a 10 €.
- No queda ni un emoji en la interfaz.
- La nav respeta el área segura del iPhone (`env(safe-area-inset-bottom)`).
