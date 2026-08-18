---
name: Kubikar
description: Edición de referencia reglada para cubicar obra sobre la planta dibujada del recinto.
colors:
  paper: '#f6f5f2'
  block: '#ffffff'
  margin: '#edebe6'
  margin-deep: '#e3e0d9'
  ink: '#14161a'
  ink-2: '#4a5058'
  ink-3: '#5c636c'
  ink-onfill: '#ffffff'
  rule: '#c9c7c0'
  rule-strong: '#7a776f'
  navy: '#1a237e'
  navy-ink: '#1a237e'
  navy-hover: '#141b63'
  navy-soft: '#e6e7f0'
  accent: '#f39200'
  accent-ink: '#8f5300'
  accent-hover: '#d97f00'
  accent-onfill: '#14161a'
  accent-soft: '#fdefd9'
  ok: '#4caf50'
  ok-ink: '#26722b'
  ok-soft: '#e6f2e7'
  warn: '#c77700'
  warn-ink: '#8a5200'
  warn-soft: '#fbf0dd'
  error: '#b3261e'
  error-ink: '#8c1d18'
  error-soft: '#fbe9e7'
  focus: '#1a237e'
  canvas-ground: '#fbfaf8'
  grid-minor: '#dedbd4'
  grid-major: '#bcb8ae'
  vertex: '#1a237e'
  vertex-active: '#b56d00'
  edge: '#14161a'
  edge-guide: '#8f5300'
  cota: '#4a5058'
typography:
  display:
    fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', ui-serif, Georgia, serif"
    fontSize: '1.5rem'
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: 'normal'
  headline:
    fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', ui-serif, Georgia, serif"
    fontSize: '1.25rem'
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: '-0.012em'
  title:
    fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', ui-serif, Georgia, serif"
    fontSize: '1.0625rem'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
  body:
    fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', ui-serif, Georgia, serif"
    fontSize: '0.9375rem'
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 'normal'
  label:
    fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', ui-serif, Georgia, serif"
    fontSize: '0.6875rem'
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '0.1em'
  cifra:
    fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', ui-serif, Georgia, serif"
    fontSize: '0.8125rem'
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: '-0.012em'
    fontFeature: 'tabular-nums lining-nums'
rounded:
  none: '0'
spacing:
  base: '4px'
  campo: '8px'
  bloque: '16px'
  seccion: '24px'
  touch-sm: '36px'
  touch: '44px'
  rail: '40px'
  margin-left: '240px'
  margin-right: '384px'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.accent-onfill}'
    rounded: '{rounded.none}'
    padding: '0 16px'
    height: '{spacing.touch-sm}'
  button-primary-hover:
    backgroundColor: '{colors.accent-hover}'
    textColor: '{colors.accent-onfill}'
  button-secondary:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    rounded: '{rounded.none}'
    padding: '0 16px'
    height: '{spacing.touch-sm}'
  button-secondary-hover:
    backgroundColor: '{colors.margin-deep}'
    textColor: '{colors.ink}'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.ink-2}'
    rounded: '{rounded.none}'
    padding: '0 16px'
    height: '{spacing.touch-sm}'
  button-danger:
    backgroundColor: 'transparent'
    textColor: '{colors.error-ink}'
    rounded: '{rounded.none}'
    padding: '0 16px'
    height: '{spacing.touch-sm}'
  detente:
    backgroundColor: 'transparent'
    textColor: '{colors.ink-2}'
    rounded: '{rounded.none}'
    padding: '0 8px'
    size: '{spacing.touch-sm}'
  detente-activo:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.accent-onfill}'
  campo:
    backgroundColor: '{colors.block}'
    textColor: '{colors.ink}'
    rounded: '{rounded.none}'
    padding: '0 12px'
    height: '{spacing.touch-sm}'
  campo-error:
    backgroundColor: '{colors.block}'
    textColor: '{colors.ink}'
  tabla-titulo:
    backgroundColor: '{colors.navy-soft}'
    textColor: '{colors.navy-ink}'
    typography: '{typography.label}'
    padding: '4px 8px'
  tabla-celda-cifra:
    backgroundColor: '{colors.block}'
    textColor: '{colors.ink}'
    typography: '{typography.title}'
    padding: '4px 8px'
---

# Design System: Kubikar

## Overview

**Creative North Star: "La edición de referencia reglada"**

Kubikar no es un panel de control: es una edición impresa de referencia, del tipo que un jefe de obra abre sobre el capot de la camioneta. Papel neutro, tinta hierro, filete de un píxel, riel central con detentes y un margen de aparato donde la memoria de cálculo cuelga encorchetada a su línea. La categoría entera —la cubicación— publica siempre la misma grilla de tarjetas con métrica grande y sombra suave; esta edición la rechaza de plano. Acá la jerarquía la hace el filete y el registro tipográfico, no la elevación.

La densidad es alta y deliberada. El producto se usa con guantes, con sol y con apuro, y su promesa es que el número que se compra se pueda reconstruir a mano: por eso cada línea de material trae su cuenta escrita al costado, y por eso el mundo visual gasta su presupuesto en el motor de reglado —la capa que mide las cajas reales y traza el corchete que une una cifra con su explicación— y no en decoración. Si el reglado no se ve, el producto no cumplió.

El vocabulario es propio y no intercambiable: la cruz de registro es la marca del sistema y es la misma figura que marca los vértices del lienzo, a otra escala; el detente cuadrado es el único control de estado sostenido; la barra de rúbrica naranja es la única marca de selección de la clave del margen. Nada de esto se puede trasplantar a otro producto sin que se note de dónde salió.

**Key Characteristics:**
- Papel neutro y tinta hierro; el color institucional aparece poco y siempre con oficio.
- Cero radios, cero gradientes, cero glassmorphism: rectángulos y filetes de un píxel.
- Una sola familia tipográfica con cifras tabulares reales.
- El estado se comunica con marcas impresas —detente macizo, ticks de registro, barra de rúbrica, diagonal de tachado—, nunca con halos.
- El motor de reglado mide con `getBoundingClientRect` y alinea al píxel del dispositivo.
- Contraste medido contra la superficie real más oscura, no contra el papel.

## Colors

Paleta de tres neutros de papel, una tinta hierro en tres pesos y los tres colores institucionales Karbec, cada uno en dos sabores: uno de relleno y uno de tinta. Los ratios de esta sección son WCAG 2.2 reales, calculados con luminancia relativa; se declara el valor sobre `paper` (#f6f5f2) y, entre paréntesis, el de la superficie real más desfavorable, que casi siempre es `margin-deep` (#e3e0d9).

### Primary

- **Naranja de rúbrica** (`accent`): relleno macizo de lo activo y de lo seleccionado. Detente encendido, botón primario, barra de rúbrica de la clave, corchete destacado del reglado. 2,16:1 sobre papel: es relleno, **nunca texto**.
- **Naranja de tinta** (`accent-ink`): la versión escribible del naranja. Rótulo en rúbrica, icono naranja, guía elástica del lienzo, filete del detente encendido del interruptor. 5,66:1 sobre papel (4,68:1 sobre `margin-deep`).
- **Naranja de presión** (`accent-hover`): el mismo naranja un escalón más oscuro, solo como relleno de hover y de activo. 2,76:1 sobre papel; no lleva texto encima.

### Secondary

- **Azul marino estructural** (`navy-ink` / `navy`): la tinta de la estructura. Marca del producto, rótulos fuertes de zona, cabecera de tabla, cruz de vértice en reposo, relleno del polígono cerrado y **color de foco**. 12,15:1 sobre papel (10,05:1 sobre `margin-deep`).
- **Azul de cabecera** (`navy-soft`): el único relleno tonal del sistema. Fondo de la fila de cabecera de toda tabla.

### Tertiary

- **Verde de validación** (`ok-ink` 5,47:1 / `ok` / `ok-soft`): confirma un resultado válido. Nivel `ok` del componente de aviso.
- **Ámbar de advertencia** (`warn-ink` 5,86:1 / `warn` / `warn-soft`): lo que no bloquea pero hay que mirar. Polígono cruzado, recintos fuera del consolidado.
- **Rojo de error** (`error-ink` 8,36:1 / `error` / `error-soft`): el problema que impide cubicar. Mensaje en línea de campo, aviso de nivel error, segmento cruzado del lienzo, escuadra de registro del detente de Resultados.

### Neutral

- **Papel** (`paper`): fondo de la aplicación. El suelo de todo.
- **Bloque** (`block`): la superficie del bloque de medida —lienzo de tabla, campo de entrada, diálogo—. Es el papel un tono más limpio, para que la carga útil se despegue del fondo.
- **Margen** (`margin`): el segundo neutro. Paneles, barra superior, margen de aparato, franja de herramientas del lienzo.
- **Margen profundo** (`margin-deep`): la superficie en reposo sobre la que se apoya un detente. Riel de pestañas, hover de fila y de entrada de la clave.
- **Tinta hierro** (`ink`): 16,61:1 sobre papel (13,74:1 sobre `margin-deep`). Todo texto de lectura y toda cifra.
- **Tinta secundaria** (`ink-2`): 7,47:1 (6,18:1). Columna de apoyo, unidad, cifra intermedia, cota del lienzo.
- **Tinta terciaria** (`ink-3`): 5,57:1 (**4,61:1** sobre `margin-deep`). El registro de rótulo y la ayuda de campo. Este token es el que más superficie cubre del producto y por eso es el que se mide contra la superficie más oscura, no contra el papel.
- **Filete decorativo** (`rule`): 1,55:1. Separación, no límite: divide filas de tabla y agrupa parámetros. No delimita ningún control.
- **Filete de control** (`rule-strong`): 4,10:1 (**3,39:1** sobre `margin-deep`). El contorno de todo control sin relleno: detente en reposo, campo de entrada, marco del interruptor, botón secundario.

### Lienzo

- **Papel del lienzo** (`canvas-ground`): el fondo del dibujo, apenas más claro que el papel de la aplicación.
- **Grilla menor y mayor** (`grid-minor` / `grid-major`): retícula de referencia; línea mayor cada cinco pasos.
- **Arista** (`edge`) y **cota** (`cota`): el trazo del polígono y su medida.
- **Vértice** (`vertex`, azul marino) y **vértice activo** (`vertex-active`, ámbar #b56d00, 3,91:1 sobre el papel del lienzo): el vértice seleccionado, los cuatro ticks de registro, el cuadrado punteado del punto de cierre y los corchetes del segmento seleccionado. Es un ámbar más oscuro que el naranja de marca **a propósito**: son objetos gráficos esenciales y tienen que pasar 3:1.
- **Despiece** (`layout-pieza` / `layout-eje`): el reparto de material que el módulo declara y el lienzo dibuja dentro del polígono, recortado contra la planta. Se separa de la grilla **por tono y no por peso**: la grilla es tierra, la pieza toma el azul marino de los vértices y el eje toma el ámbar de las guías. A igual grosor se distinguen de un vistazo, y con la grilla apagada por zoom la retícula del despiece sigue leyéndose sola. Va sobre el relleno y **bajo** las aristas, las cotas y los vértices: ordena la lectura de la planta, no la define, y nunca recibe un evento de puntero. **Dentro del despiece, las piezas van encima de los ejes**, porque las juntas del lado largo suelen caer exactamente sobre un eje y al revés quedaban tapadas.

Sus interruptores —uno por rol— viven en la barra del lienzo junto a "ajustar vista" y no junto al imán: imán y ortogonal cambian **cómo se dibuja**, estos detentes cambian **qué se ve**, y son dos gramáticas distintas. El rótulo de cada uno lo pone el módulo ("Planchas", "Perfilería"): la barra conoce los dos roles del vocabulario de dibujo, nunca las partidas de construcción.

### Contraste medido

Ratios WCAG 2.2 reales de cada tinta del sistema, calculados con luminancia relativa. `paper` es el fondo nominal; `margin-deep` es el peor caso real del producto. Los plenos institucionales (`accent`, `ok`, `warn`) aparecen para dejar constancia de que **no son tintas**.

| token | valor | sobre `paper` | sobre `block` | sobre `margin` | sobre `margin-deep` | sobre `canvas-ground` |
|---|---|---|---|---|---|---|
| `ink` | #14161a | 16,61 | 18,11 | 15,20 | 13,74 | 17,36 |
| `ink-2` | #4a5058 | 7,47 | 8,14 | 6,83 | 6,18 | 7,80 |
| `ink-3` | #5c636c | 5,57 | 6,08 | 5,10 | **4,61** | 5,82 |
| `rule-strong` | #7a776f | 4,10 | 4,47 | 3,75 | **3,39** | 4,29 |
| `rule` | #c9c7c0 | 1,55 | 1,69 | 1,42 | 1,28 | 1,62 |
| `navy-ink` · `focus` · `vertex` | #1a237e | 12,15 | 13,24 | 11,12 | 10,05 | 12,70 |
| `accent-ink` · `edge-guide` | #8f5300 | 5,66 | 6,17 | 5,18 | 4,68 | 5,91 |
| `accent` (relleno) | #f39200 | 2,16 | 2,35 | 1,98 | 1,79 | 2,26 |
| `accent-hover` (relleno) | #d97f00 | 2,76 | 3,01 | 2,52 | 2,28 | 2,88 |
| `ok-ink` | #26722b | 5,47 | 5,96 | 5,00 | 4,52 | 5,71 |
| `ok` (relleno) | #4caf50 | 2,55 | 2,78 | 2,33 | 2,11 | 2,66 |
| `warn-ink` | #8a5200 | 5,86 | 6,39 | 5,36 | 4,85 | 6,12 |
| `warn` (relleno) | #c77700 | 3,17 | 3,46 | 2,91 | 2,63 | 3,32 |
| `error-ink` | #8c1d18 | 8,36 | 9,11 | 7,65 | 6,91 | 8,74 |
| `error` (filete) | #b3261e | 6,00 | 6,54 | 5,49 | 4,96 | 6,27 |
| `vertex-active` | #b56d00 | 3,74 | 4,08 | 3,42 | 3,09 | **3,91** |
| `edge` | #14161a | 16,61 | 18,11 | 15,20 | 13,74 | 17,36 |
| `cota` | #4a5058 | 7,47 | 8,14 | 6,83 | 6,18 | 7,80 |
| `grid-major` | #bcb8ae | 1,82 | 1,98 | 1,66 | 1,50 | 1,90 |
| `grid-minor` | #dedbd4 | 1,27 | 1,38 | 1,16 | 1,05 | 1,33 |
| `layout-pieza` | #8a8ebb | 2,89 | 3,15 | 2,64 | 2,39 | **3,02** |
| `layout-eje` | #a6763a | 3,65 | 3,98 | 3,34 | 3,02 | **3,82** |

Umbrales que rigen: **4,5:1** para texto normal (SC 1.4.3), **3:1** para el límite de un control y para un objeto gráfico esencial (SC 1.4.11). `rule` y las dos grillas quedan bajo 3:1 a propósito: son separación y referencia, no límite de control ni información esencial, y 1.4.11 no las alcanza. Un control deshabilitado también queda fuera del umbral por la misma norma.

Los dos tokens del despiece pasan 3:1 y ambos se miden contra `canvas-ground`, que es la única superficie donde caen. `layout-pieza` nació en 1,94:1, tratado como referencia igual que la grilla, y **no alcanzaba**: el largo útil de una plancha suele ser múltiplo exacto de la separación entre ejes —2400 con 40 cm, 3000 con 60 cm—, de modo que cada junta del lado largo cae justo encima de un eje de perfilería. A ese contraste la junta desaparecía bajo el ámbar y la retícula parecía dividida solo a lo ancho. Es la línea por donde se corta y por donde topan dos planchas: es objeto gráfico esencial y le corresponde el umbral.

### Named Rules

**La Regla de los Dos Sabores.** Ningún color institucional se usa para las dos cosas. El relleno es `accent` / `ok` / `warn` / `error`; el texto y el icono son `accent-ink` / `ok-ink` / `warn-ink` / `error-ink`. Sobre relleno naranja el texto es tinta hierro (`accent-onfill`), nunca blanco.

**La Regla de la Superficie Real.** El contraste de un token se mide contra la superficie más oscura sobre la que cae de verdad, no contra el papel. La aplicación casi nunca pone texto secundario sobre `paper`: lo pone sobre `margin` y sobre `margin-deep`. Un token que solo cumple AA contra papel es un token que no cumple.

**La Regla del Filete de Control.** `rule` separa, `rule-strong` delimita. Si un filete es el único indicador del límite de un control, es `rule-strong` y debe pasar 3:1 sobre la superficie donde ese control vive.

## Typography

**Familia única:** Source Serif 4 Variable (con respaldo Source Serif 4, ui-serif, Georgia, Times New Roman, serif).

**Character:** una transicional de trabajo diseñada para pantalla, con cifras tabulares reales. Sostiene título, rótulo, control y columna numérica sin partir el mundo en dos tipografías. `--font-sans` y `--font-mono` son alias defensivos de la misma familia: `font-sans` no saca a nadie del mundo visual.

Escala fija, razón ~1,18. **No hay tipografía fluida**: una herramienta de medición no cambia de tamaño de letra con el ancho de la ventana.

### Hierarchy

- **Display** (24px / `--text-2xl`, interlínea 1,2): título de vista. Consolidado de materiales. Es el registro más alto que se usa en el producto.
- **Headline** (20px / `--text-xl`, tracking -0,012em): la marca en la barra superior y el título de diálogo.
- **Title / brevier** (17px / `--text-lg`, interlínea 1,5): dos usos y solo dos. `.kb-prose` —la prosa de la edición: nota de cálculo, estado vacío, descripción de diálogo, medida máxima 66ch— y **la cifra de cierre**, la cantidad que se compra.
- **Body** (15px / `--text-base`, interlínea 1,45): la interfaz por defecto. Texto de control, nombre de recinto, celda de tabla en densidad normal.
- **Tabla densa** (13px / `--text-sm`): celda de tabla densa, ayuda de campo, razón de un botón deshabilitado.
- **Label** (11px / `--text-xs`, versal, tracking 0,1em, peso 600, `ink-3`): `.kb-label`, el nombre impreso de cada cosa. Rótulo de todo control de formulario, cabecera de tabla, número correlativo de la clave, sufijo de unidad dentro de un campo.
- **Cota mínima** (10px / `--text-2xs`): solo la cota de segmento sobre el lienzo, que se lee a distancia de dibujo.

`--text-3xl` (30px) está declarado en `tokens.css` y **no se usa** en esta versión: el producto tope en 24px.

### Registros implementados

Los cuatro registros del sistema viven como clases en `src/styles/base.css` y no se reimplementan en ninguna vista:

- **`.kb-label`** — rótulo de aparato: 11px, versal, tracking 0,1em, peso 600, tinta terciaria. Sus dos modificadores son `.kb-label-strong` (azul marino, el rótulo estructural de una zona) y `.kb-label-rubric` (naranja de tinta, el rótulo de lo activo o seleccionado).
- **`.kb-num`** — columna numérica: cifras tabulares y tracking -0,012em. Toda cifra pasa por acá.
- **`.kb-prose`** — brevier: 17px, interlínea 1,5, medida máxima 66ch, tinta secundaria. Nota de cálculo, estado vacío, descripción de diálogo.

### Named Rules

**La Regla de la Cifra Tabular.** Toda cifra del producto lleva `.kb-num` o `tabular-nums`. Las cifras se leen en columna y un error de un cero tiene que saltar a la vista por desalineación.

**La Regla del Registro Único de Compra.** La cantidad que se compra —columna Final en Resultados, columna Cantidad en el Consolidado, total de ambos pies— va SIEMPRE en el registro de 17px con cifras tabulares, con su rótulo de cabecera en rúbrica y un filete vertical a la izquierda que la separa del resto de la fila. Es la salida del producto y no puede pesar lo mismo que la columna de desperdicio. Se pide con la prop `registro="cifra"` de `TablaCelda`, nunca con una clase de tamaño suelta.

**La Regla del Rótulo Intacto.** `.kb-label` fija su propio tamaño. Ninguna utilidad de tamaño de texto se le pone encima: dos declaraciones de `font-size` sobre el mismo elemento se resuelven por el orden de la hoja generada y la utilidad gana siempre. Por eso el relleno de celda y el registro de celda viajan separados en `Tabla.jsx`.

## Layout

Rejilla CSS de tres pistas medidas con tokens estructurales, nunca con anchos escritos a mano:

```
┌ BARRA SUPERIOR ───────────────────────────────────────────────────┐
├──────────────┬───────────────────────────────┬────────────────────┤
│ clave del    │  bloque de medida             │ riel │ aparato     │
│ margen izq.  │  240px …  minmax(0, 1fr)      │ 40px │ 384px       │
└──────────────┴───────────────────────────────┴────────────────────┘
```

- **Zona izquierda** (`--size-margin-left`, 240px): la clave numerada de recintos. Cada entrada lleva su correlativo de dos cifras en rótulo, su nombre y su área en cifra tabular.
- **Zona central**: `minmax(0, 1fr)`. El `minmax(0, …)` no es decorativo: sin él una tabla ancha estiraría la pista y empujaría el aparato fuera de la pantalla.
- **Riel** (`--size-rail`, 40px): franja vertical de un filete con tres detentes cuadrados. Sube a 52px con puntero grueso.
- **Zona derecha** (`--size-margin-right`, 384px): el margen de aparato.

**Ritmo de espaciado.** Base de 4px (`--spacing: 0.25rem`). La rejilla de espaciado es la misma que ordena el reglado. Cinco pasos hacen casi todo el trabajo:

| paso | valor | dónde |
|---|---|---|
| 0.5 | 2px | separación de una cifra y su unidad, ticks de esquina |
| 1 | 4px | entre un rótulo y su control; entre un título y su regla |
| 2 | 8px | entre controles hermanos; relleno horizontal de celda densa |
| 3 | 12px | relleno horizontal de campo, de celda normal y de entrada de la clave |
| 4 | 16px | relleno de zona y de panel; aire bajo un título |
| 6 | 24px | entre secciones de una pestaña; canal del margen de aparato |

Un título lleva **más aire arriba que abajo**: la regla que lo subraya va pegada al título (4px) y el contenido arranca 16px más abajo, mientras la sección anterior queda a 24px.

**Objetivos táctiles.** Ningún blanco baja de `--size-touch-sm` (36px), que es el piso de escritorio denso declarado por el sistema; con puntero grueso todo sube a `--size-touch` (44px). Lo que separa el tamaño `sm` del `md` es el relleno horizontal y el registro de texto, **no** el tamaño del blanco.

**Responsivo estructural, no fluido.** No hay tipografía fluida ni anchos en porcentaje. Hay tres cortes y en cada uno una pieza cambia de sitio entera:

- **1180px**: el margen de aparato deja de ser columna y pasa a ser lámina inferior desplegable (45dvh); el riel se convierte en tira horizontal de detentes.
- **900px**: la clave de recintos se repliega en el desplegable de la barra superior y se retira su pista; además desaparece el botón de renombrar proyecto, que sigue disponible en la vista de proyectos.
- **640px**: las tres salidas del trabajo —Biblioteca, JSON, CSV— se repliegan en un botón de desbordamiento que abre un diálogo.

El lienzo es la única zona que sobrevive los tres cortes.

### Named Rules

**La Regla del Ancho del Aparato.** El bloque de medida más su margen de anotación piden 560px (320 de bloque + 240 de margen). Donde no hay 560px, el margen no se monta y las notas vuelven al flujo. Por eso la pestaña Resultados **no vive en el margen derecho**: en el diseño amplio se monta en la zona central, que es la única pista con ancho suficiente, y la pista derecha se encoge hasta el riel. Geometría y Módulo se quedan a la derecha porque son entrada y acompañan al dibujo. El lienzo no desaparece: queda como franja superior del 30%.

**La Regla del Encogimiento por Resta.** Una barra se encoge quitando controles, nunca apilándolos. Bajo 900px la barra superior SUMA el desplegable de recintos, así que retira el renombrado; bajo 640px retira las tres exportaciones a un desbordamiento. Una cabecera de cinco filas le come al lienzo media pantalla.

## Elevation & Depth

El sistema es **plano por construcción**. No hay elevación ambiental, no hay capas de sombra y no hay tarjetas: la profundidad se comunica con tres neutros de papel (`paper` → `margin` → `margin-deep`, o `paper` → `block` para la carga útil) y con el filete de un píxel que los separa. Un panel no flota sobre otro: está al lado, y el filete dice dónde termina uno y empieza el otro.

Solo flota lo que de verdad sale del flujo.

### Shadow Vocabulary

- **Levante de diálogo** (`--shadow-lift`: `0 6px 20px -6px color-mix(in srgb, #14161a 28%, transparent), 0 1px 0 0 var(--color-rule-strong)`): la única sombra del sistema, para el `<dialog>` nativo. Tiene desplazamiento y difuminado reales más un filete de asiento. Un halo sin desplazamiento es decoración y no existe acá.

### Named Rules

**La Regla del Papel Apoyado.** Si un elemento no está en la capa superior del navegador, no lleva sombra. El espacio de nombres `--shadow-*` está vaciado: `shadow-md` no compila a nada y `shadow-lift` es el único token disponible.

## Shapes

**Sin radios, en ninguna parte.** El espacio de nombres `--radius-*` de Tailwind está vaciado: `rounded-lg` no compila a nada. Todo es rectangular, incluido el conmutador, que en esta edición es un detente que se corre de un extremo al otro y no una píldora.

El trazo tiene dos pesos y nada más: `--hairline` / `--rule-weight` (1px) para todo filete, y `--rule-weight-strong` (2px) para el contorno de foco y para la barra de rúbrica. Un `border-left` de color de más de un píxel está prohibido: la banda gruesa a la izquierda de un aviso es decoración de plantilla, y acá el aviso se marca con la misma regla con que está trazado todo lo demás.

La figura recurrente del sistema es la **cruz de registro**: dos líneas y un cuadrado pequeño. Marca el producto en la barra superior y marca cada vértice sobre el lienzo, a otra escala. Su pariente es el juego de cuatro **ticks de esquina** (`.kb-ticks`), que es como esta edición señala lo enfocado y lo seleccionado.

## Components

Todo componente consume tokens. **Ningún componente escribe un color, un radio, una sombra ni un tamaño de texto en duro.** `src/styles/tokens.css` es la fuente única de verdad visual; si falta un valor se agrega ahí, no en el componente. El espacio de nombres de color de Tailwind está vaciado: `bg-slate-500` y `text-gray-600` no compilan a nada, que es exactamente la señal que se busca.

### Buttons

- **Forma:** rectángulo sin radio, delimitado por un filete de un píxel. Alto mínimo 36px, 44px en puntero grueso.
- **Primaria:** relleno naranja macizo con tinta hierro encima y filete `accent-hover`. Relleno horizontal 16px.
- **Secundaria:** sin relleno, filete `rule-strong`, tinta hierro. Al presionar se llena de naranja.
- **Fantasma:** sin filete y sin relleno, tinta secundaria. Para acciones de icono dentro de una fila o una cabecera.
- **Peligro:** filete `error`, tinta `error-ink`, relleno suave al pasar.
- **Estados:** reposo, hover (relleno `margin-deep` o naranja de presión), foco (contorno de 2px `focus` con 2px de separación, global y nunca anulado), activo sostenido (`aria-pressed`, macizo naranja), deshabilitado (**diagonal de tachado** de `.kb-detent`, tinta terciaria, sin relleno) y cargando (testigo `LoaderCircle` que reemplaza al icono para que la caja no cambie de ancho, con `aria-busy`).
- **Nombre accesible:** si el botón tiene texto visible, ese texto **es** su nombre. `etiquetaAccesible` solo se emite cuando no hay texto que leer; lo demás va en `title`.

### Detente

El botón cuadrado del riel y la pieza de estado del sistema. Todo su vocabulario vive en `.kb-detent` (base.css) y ningún consumidor lo repinta:

- **Reposo:** transparente con filete `rule-strong`, tinta secundaria.
- **Hover:** relleno `margin-deep`, tinta hierro.
- **Activo:** relleno naranja macizo, filete `accent-hover`, tinta hierro. Sirve para los tres portadores de estado: `data-state="on"` (herramienta), `aria-selected` (pestaña), `aria-pressed` (valor rápido, alternador).
- **Deshabilitado:** diagonal de tachado dibujada con un gradiente, tinta terciaria, cursor bloqueado.
- **Aviso:** escuadra de registro de 8px en la esquina superior derecha, dos filetes en `error-ink` (3,87:1 sobre el naranja del detente encendido). La marca declara que la pestaña Resultados trae problemas; el conteo viaja además en el nombre accesible y en el `title`.
- La transición cubre color de fondo, de filete y de tinta durante 120ms. Nada de layout se anima.

### Inputs / Fields

- **Estilo:** caja rectangular sobre `block`, filete `rule-strong` de un píxel, relleno horizontal 12px, alto mínimo 36px.
- **Hover:** el filete se oscurece a `ink-3`. Los cinco controles de entrada responden igual.
- **Foco:** los cuatro ticks de registro de esquina (`.kb-ticks`) sobre el contorno de foco global. El rótulo del campo pasa a rúbrica naranja mientras dura el foco.
- **Error:** filete `error`, `aria-invalid`, y el mensaje en `error-ink` a 13px. La región del mensaje está **montada siempre** —`sr-only` cuando está vacía— con `role="alert"`: una región viva que aparece junto con su texto no se anuncia.
- **Deshabilitado:** filete `rule`, diagonal de tachado, tinta terciaria.
- **Cifras:** el campo numérico guarda su propio texto mientras tiene foco (se puede escribir "1," sin que un parseo prematuro borre la coma), acepta coma y punto, abre teclado decimal y normaliza al formato chileno al salir. Nunca inventa un valor: vaciar un campo emite `null`, no cero.
- **Valores rápidos:** fila de detentes bajo el campo, agrupada con `role="group"` y enlazada al campo por `aria-describedby`.

### Tablas

- **Cabecera:** relleno `navy-soft`, tinta `navy-ink`, registro de rótulo de 11px versal, filete `rule-strong` abajo. La tinta terciaria no alcanza AA a 11px sobre ese relleno; por eso la cabecera va en azul marino.
- **Celda:** filete `rule` abajo, sin bordes colapsados (`border-separate` con espaciado cero) para que la barra de rúbrica de fila se pueda dibujar como sombra interior.
- **Columna numérica:** a la derecha, cifras tabulares, sin quiebre de línea.
- **Alineación vertical:** prop `alineacion` (`arriba` | `medio` | `base`), nunca una clase suelta. Las filas que mezclan dos registros tipográficos se alinean por la línea de base.
- **Fila elegible:** cursor de mano, hover `margin`, Enter y Espacio la accionan, y la selección viaja por `aria-current` sobre el `<tr>` —`aria-selected` no es válido fuera de una grilla— con la barra de rúbrica de `.kb-key-mark` como marca visible.
- **Desplazamiento:** el contenedor desplaza en horizontal por su cuenta. Una tabla ancha nunca empuja el ancho de la página.

### Avisos

Cuatro niveles y una sola forma: filete de un píxel del color pleno a la izquierda, relleno suave del mismo tono, tinta de contraste garantizado. `error` va con `role="alert"`; los otros tres con `role="status"`. El texto nombra el problema **y la salida**: "No se pudo guardar" es una queja; "La separación entre ejes no puede ser 0. Ingresa un valor mayor que 0 para cubicar la perfilería." es un aviso.

### Aparato y motor de reglado (componente de firma)

La pieza que define esta edición. `Aparato.jsx` compone dos columnas: a la izquierda el **bloque de medida**, que es la carga útil y manda el ancho; a la derecha el **margen de anotación**, donde cuelga la memoria de cálculo. Entre las dos queda el canal por el que `RulingLayer.jsx` traza el filete y el corchete que unen cada nota con su fila.

`RulingLayer` es una capa SVG en posición absoluta que:

1. **Mide, no calcula.** Lee la caja real de cada fila y de cada nota con `getBoundingClientRect` y dibuja encima. No reposiciona nada, así que nunca hay realimentación entre lo que dibuja y lo que mide.
2. **Alinea al píxel del dispositivo.** Cada coordenada pasa por `Math.round(v * dpr) / dpr + 0.5 / dpr`. Un filete de un píxel en coordenada fraccionaria sale gris y borroso; así sale negro y exacto en cualquier pantalla.
3. **Se apaga antes de mentir.** Si entre la fila y su nota no quedan al menos 16px de canal, esa unión no se dibuja. La capa nunca inventa un corchete que cruza texto.
4. Se re-resuelve con `ResizeObserver` —llevando su propio registro de lo observado, porque `observe()` sobre un elemento ya observado **no** es una operación nula según la especificación—, con `resize`, con el desplazamiento de cualquier contenedor (oyente en captura y **pasivo**) y con `document.fonts.ready`.

Cada trazo son tres caminos: la marca de registro en el borde de la fila, el conector que cruza el canal en dos tramos y el corchete que abraza el alto de la nota. La unión destacada va en naranja; el resto en `rule-strong` y `rule`. La capa es `aria-hidden` y no recibe puntero: es tinta, no interfaz.

**Dos aplicaciones:** la pestaña Resultados —cada línea de material con su memoria de cálculo— y el Consolidado —cada grupo con la composición de lo que aportó cada recinto—. En los dos casos, cuando el margen no alcanza, la nota vuelve al flujo bajo su fila, y en el Consolidado reaparece la columna del detalle desplegable. Nunca están las dos formas a la vez.

### Lienzo

Un único `<svg>` con transformación de vista `translate(...) scale(...)`. No se usa canvas: el dibujo tiene que ser inspeccionable, seleccionable y accesible por teclado.

- **Tres sistemas de coordenadas:** mundo (milímetros, lo único que se guarda), pantalla (`mundo · zoom + vista`) y unidad de lectura (mm, cm, m), que solo entra al formatear y **jamás** toca la geometría.
- **Grosor constante:** dentro del grupo escalado el trazo se divide por el zoom; fuera del grupo la posición se multiplica por el zoom y el tamaño queda constante por construcción.
- **Grilla:** `<pattern>` de líneas menores y mayores cada cinco pasos; el paso se configura en la unidad activa porque es una distancia física del recinto. Bajo 6px de celda en pantalla, la retícula se apaga.
- **Vértices:** cruz de registro en azul marino; el seleccionado en ámbar con los cuatro ticks. Área de captura transparente de 32px de diámetro, que es además el objetivo de tabulación. El vértice **no es un botón** —Espacio ya es el modificador de desplazamiento del lienzo—: se anuncia como `role="img"` con `aria-roledescription="vértice arrastrable"`, y su foco se dibuja a mano con un rectángulo de 26px en el color de foco, porque el `outline` sobre figuras SVG llegó tarde y desigual a los navegadores.
- **Arrastre:** la posición en curso vive en estado local del lienzo y se despacha al reductor **una sola vez, al soltar**. Un despacho por `pointermove` reconstruye el proyecto, cambia la identidad del contexto y vuelve a renderizar toda la aplicación a 60 Hz con la cubicación completa de vuelta.
- **Barra de herramientas:** franja propia **en el flujo**, arriba del papel, con filete abajo. Apilada sobre el dibujo se envolvía en varias filas y se quedaba con los clics de la esquina superior izquierda. El grupo primario va con `ml-auto` —es lo último que cede ancho— y con puntero grueso baja al pie del lienzo, al alcance del pulgar.
- **Cierre:** clic sobre el primer vértice con tolerancia de pantalla, o el botón primario. La razón por la que no se puede cerrar se imprime al lado del botón, no en un globo que hay que descubrir.
- **Cotas y área:** cada segmento lleva su medida al centro sobre un rectángulo de papel medido con `getBBox`; el polígono cerrado lleva su área en m² sobre el centroide. La medición entra al estado y el papel se dibuja en el render siguiente, para no intercalar lecturas y escrituras de layout en el mismo cuadro.

### Navigation

- **Riel de pestañas:** `role="tablist"` de verdad, con foco itinerante, las cuatro flechas, Inicio y Fin, y una sola pestaña en el orden de tabulación. El corte entre entrada (Geometría, Módulo) y salida (Resultados) es una regla, no un elemento de la lista.
- **Clave del margen:** la selección se marca con `.kb-key-mark[data-current="true"]`, una barra de rúbrica naranja de 2px inserta a la izquierda más el relleno `block`. Es la única marca de selección de la clave, y la misma clase la usa la fila de tabla seleccionable.
- **Bloque de cierre de la clave:** el Consolidado. Cierra la columna bajo un filete `rule-strong`, con la cruz de registro en azul marino, su nombre en el registro de lectura de 15px y su cifra de cierre a la derecha —recintos cubicados sobre el total— en 17px con `.kb-num`. Es una de las salidas del producto y por eso pesa como una salida: la jerarquía la hacen el filete, el registro y la cifra, **no** un relleno naranja. El naranja se queda en «Agregar recinto», que es la acción de edición de esta columna, y el bloque conserva la misma marca de selección que un recinto. Cuando hay recintos fuera del consolidado lleva la **escuadra de registro** de 8px en `error-ink`, la misma con que el detente de Resultados declara que trae problemas, y el conteo viaja en el nombre accesible y en el `title`.
- **Barra superior:** identidad del proyecto a la izquierda, testigo de guardado ("Guardando" / "Guardado 12:40", en registro de rótulo, sin icono y sin animación), lente de unidad y salidas del trabajo a la derecha.

### Motion

120–180ms, `--ease-damped` (`cubic-bezier(0.2, 0, 0, 1)`), un solo eje, sin rebote. **Solo comunica estado**: color de fondo, de filete, de tinta y la sombra interior de la barra de rúbrica. Con `prefers-reduced-motion: reduce` no se apaga la retroalimentación, se apaga el **desplazamiento**: la transición se acota a `background-color, border-color, color, box-shadow, opacity`, el corrimiento del interruptor se congela con `transform: none` y el testigo de trabajo deja de girar y pasa a pulsar en opacidad, para que siga diciendo que algo está ocurriendo.

## Impresión

El papel es un **documento aparte**, no la pantalla restilada. La rejilla de la aplicación apoya su alto en contenedores con desplazamiento propio, y en papel esos contenedores recortan el documento a una sola página; desarmarlos a la fuerza con `!important` da un resultado distinto en cada navegador. `src/components/HojaImpresion.jsx` monta un árbol hermano de la aplicación, invisible en pantalla, y `src/styles/impresion.css` apaga uno y enciende el otro según el medio.

- **A4 vertical, márgenes de 14 mm.** El papel es `block` (blanco), no el papel neutro de la aplicación: la impresora ya trae su soporte y teñirlo gasta tóner sin aportar.
- **Cabecera fija:** «Kubikar · Karbec» en rótulo, la fecha de impresión a la derecha, el título del documento en 20px y el proyecto debajo. Es lo que permite reconocer una lámina suelta sobre el capot.
- **Dos hojas.** El **Consolidado** es la lista de compra: lo que quedó fuera arriba, la tabla con su total, y la composición por recinto. El **Recinto** es la lámina de terreno: la planta con su despiece y sus cotas, el listado y la memoria de cálculo de cada línea.
- **La anotación baja al flujo.** En papel no hay margen de aparato medido, así que la memoria de cálculo y la composición van bajo su fila, no al costado. `RulingLayer` se apaga con `.kb-ruling`: mide cajas de pantalla con `getBoundingClientRect` y en papel esa medida ya no vale. Es tinta decorativa y `aria-hidden`, así que apagarla no quita dato.
- **Cortes de página:** la cabecera de tabla se repite con `display: table-header-group`, una fila no se separa de su nota (`break-inside: avoid`) y un título no se queda solo al pie (`break-after: avoid`).
- **La planta impresa es un dibujo estático** (`PlantaImpresa.jsx`) con el `viewBox` calzado al recinto y trazo `non-scaling-stroke`. No comparte código con `Lienzo.jsx`: el lienzo es una máquina de estados con vista, zoom, arrastre, foco, teclado e imán, y ninguna de esas cosas existe en una hoja de papel.
- **Sin controles.** Ningún botón, ningún desplegable, ninguna fila elegible: lo que en pantalla se abre, en papel ya está abierto.

## Do's and Don'ts

### Do:

- **Do** tomar todo color, tamaño y medida de `src/styles/tokens.css`. Si falta un valor, se agrega ahí.
- **Do** medir el contraste de un token contra la superficie real más oscura donde cae, que casi siempre es `margin-deep` (#e3e0d9), no contra `paper`.
- **Do** usar `accent-ink`, `ok-ink`, `warn-ink` y `error-ink` para texto e icono; los plenos son relleno.
- **Do** poner `.kb-num` o `tabular-nums` en toda cifra del producto.
- **Do** dar el registro de 17px con filete de cierre a la cantidad que se compra, en cualquier pantalla donde aparezca, pidiéndolo con `registro="cifra"`.
- **Do** montar la región de error de un campo desde el primer render, vacía y en `sr-only`, con `role="alert"`.
- **Do** dejar que el texto visible de un control sea su nombre accesible; el `title` amplía, nunca contradice.
- **Do** declarar el dato ausente: precio sin cargar deja la celda vacía con la razón en `sr-only`, y la declaración explícita se hace una sola vez, en la nota al pie.
- **Do** nombrar en cada error el problema **y** la salida.
- **Do** dar a cada control sus siete estados: reposo, hover, foco, activo, deshabilitado, cargando y error.

### Don't:

- **Don't** escribir un hex, un `rgb()`, un `text-[…]`, un `shadow-[…]` ni un `bg-[#…]` en un componente. El detector de anti-patrones y `npm run design:check` corren sobre `src/`.
- **Don't** usar `rounded-*`: el espacio de nombres de radio está vaciado y no compila a nada.
- **Don't** usar el naranja `accent` como texto sobre papel, ni texto blanco sobre relleno naranja.
- **Don't** poner dos utilidades del mismo eje —`align-top` con `align-middle`, `text-sm` con `text-lg`, `hidden` con `flex`— sin variante sobre el mismo elemento: el orden de la hoja generada decide, no el orden en que se escriben. Para eso están las props `alineacion` y `registro` de `TablaCelda`, y por eso `hidden` viaja siempre con una variante de medio.
- **Don't** anidar tarjetas, ni usar gradientes, glassmorphism, emoji en la interfaz, texto motivacional, signos de exclamación ni animación decorativa.
- **Don't** poner una sombra sin desplazamiento ni un `border-left` de color de más de un píxel.
- **Don't** dibujar un icono con un glifo unicode: `lucide-react`, `strokeWidth={1.5}` y `size={16}` salvo excepción justificada.
- **Don't** anular `:focus-visible`.
- **Don't** bajar ningún objetivo interactivo de `--size-touch-sm` (36px), ni de `--size-touch` (44px) con puntero grueso.
- **Don't** montar el aparato donde no caben 560px: si el margen no alcanza, la nota vuelve al flujo y la capa de reglado se apaga con él.
- **Don't** despachar al estado global en cada `pointermove`. El gesto vive en estado local y se compromete al soltar.
- **Don't** apagar la transición de color bajo `prefers-reduced-motion`. Lo que se apaga es el desplazamiento.
