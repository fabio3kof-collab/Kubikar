# Tornillos del módulo Cielo · diseño

Fecha: 2026-08-19

## El problema

El módulo Cielo cubica **una sola** línea de tornillo: `cielo.tornillos`, a 15 un/m²
sobre el área neta, con un selector que ofrece cualquier material de tipo `pieza`.
En obra eso es un tornillo que no existe. Un cielo lleva dos, y no son
intercambiables:

- **Tornillo drywall punta fina.** Fija la plancha al omega. Va donde la plancha
  cruza el perfil, cada 20 cm más o menos a lo largo de cada corrida.
- **Tornillo punta broca cabeza de lenteja.** Une metal con metal: el perfil
  perimetral con los omega, y el colgante con el omega. Va por punto de unión, no
  por superficie.

Cubicarlos como uno solo obliga a decidir en la ferretería cuál de los dos se
compró, y la única salida hoy es correr el recinto dos veces cambiando el
material a mano.

Hay además un campo que miente. `schema.js` define `consumo: 'por_m2' | 'por_ml'`
en cada pieza y el formulario de material lo deja elegir, pero **ningún cálculo
lo lee nunca**: `cielo.js` multiplica por área siempre. Un campo que promete
gobernar el cálculo y no lo gobierna es peor que no tenerlo, porque el usuario lo
ajusta creyendo que mueve el número.

## Decisiones

1. **La punta broca sale del encuentro trazado en planta**, no de una densidad.
   Cada corrida de omega llega al perimetral por sus dos extremos, y el reparto ya
   conoce esas corridas. Es la misma decisión que el módulo ya tomó al dejar de
   dividir el área para las barras.
2. **La punta fina sale de los metros lineales reales de omega**, divididos por
   la separación entre tornillos. Así el número reacciona a la separación entre
   ejes: abrir los ejes de 40 a 60 cm baja los tornillos de verdad, cosa que un
   15 un/m² no ve. A 40 cm da ~12,5 un/m², cerca de la regla de obra.
3. **La punta broca cuenta también la fijación del colgante al omega.** Es la
   misma caja de tornillos que se lleva a la faena; contarla aparte dejaría la
   compra corta.
4. **La pieza declara para qué sirve** y cada parámetro pide ese uso, de modo que
   el selector quede corto y correcto.
5. **`consumo` sale y `uso` entra.** El módulo decide cómo se consume cada
   accesorio; el material declara para qué sirve.

## Capa de datos

### `src/data/schema.js`

Sale `CONSUMOS_PIEZA` y el campo `consumo`. Entra:

```js
export const USOS_PIEZA = ['fijacion_plancha', 'fijacion_metal', 'colgante', 'general']
```

`uso` existe solo en las piezas; en plancha y barra va `null`, como el resto de
los campos que no aplican al tipo. `nuevoMaterial('pieza')` arranca en
`'general'`. `normalizarMaterial` manda a `'general'` cualquier valor ausente o
desconocido.

**`'general'` es comodín, no cajón de sastre.** Significa "sirve para cualquier
cosa" y por eso aparece en *todos* los selectores. Ahí está la migración: una
biblioteca guardada antes de este cambio entra completa, sin el campo, y no se le
vacía ningún desplegable al usuario. A medida que clasifique sus piezas, las
listas se le van acortando solas. La alternativa —inferir el uso leyendo el
nombre del material— amarra el cálculo al texto libre de un nombre, que es
exactamente la fragilidad que el proyecto ya evitó separando `designacion` de
`nombre`.

Leer un archivo viejo que traiga `consumo` no falla: el campo simplemente se
ignora al normalizar. No sube `FORMATO_VERSION`, porque quitar un campo que nadie
leía no rompe a ningún lector.

### `src/data/seed.js`

El tornillo único se parte en los dos reales y el alambre queda declarado:

| Nombre                                        | uso                |
| --------------------------------------------- | ------------------ |
| Tornillo drywall punta fina 6 × 1" (25 mm)    | `fijacion_plancha` |
| Tornillo punta broca cabeza lenteja 8 × ½"    | `fijacion_metal`   |
| Alambre galvanizado #14                       | `colgante`         |

`PRODUCT.md` enumera la semilla por nombre y cambia en el mismo commit.

### `src/components/FormularioMaterial.jsx`

El selector "Unidad de consumo" pasa a ser "Uso", con las cuatro opciones en
castellano legible: "Fijación a plancha", "Fijación metal-metal", "Colgante",
"Sin uso específico". Hereda la validación que hoy tiene `consumo`: elegir es
obligatorio al crear una pieza.

### `src/components/BibliotecaMateriales.jsx`

La columna "Consumo" de la tabla de piezas pasa a "Uso", con las mismas
etiquetas.

## Contrato de módulos

### `src/modules/registry.js`

`EsquemaParametro` gana `materialUso` (string opcional, solo con
`tipo: 'material'`). El registro valida únicamente que sea texto no vacío cuando
está presente: **no conoce el vocabulario**, igual que no conoce el significado de
las marcas de `preferir`. Esa ignorancia es lo que mantiene la regla 2 de
`CLAUDE.md` en pie.

`materialesDe(parametro, biblioteca)` concentra la regla de coincidencia, y
`materialInicial` la usa para preseleccionar: el conjunto del que sale la
preselección tiene que ser exactamente el que el desplegable muestra, o el panel
llegaría con algo elegido que su propia lista no contiene.

El comodín está acotado a donde el uso existe como concepto. `'general'` calza
siempre; un material **sin** `uso` calza solo si el parámetro pide piezas. Sin ese
límite, una plancha —que tampoco declara uso— se colaba en un parámetro que pide
"fijación metal-metal", ofreciendo para atornillar algo que no atornilla nada.

### `src/components/ParametroCampo.jsx`

El caso `'material'` filtra por tipo y por uso, con `'general'` de comodín, y
**siempre deja visible el material ya seleccionado** aunque no calce el uso: un
selector que borra una elección sin decirlo es peor que uno largo. Cuando el
parámetro declara `materialUso`, el texto de lista vacía nombra el parámetro
—"No hay materiales para «Tornillo metal-metal» en la biblioteca"— en vez del
tipo interno, que al usuario no le dice nada.

## Cálculo · `src/modules/cielo.js`

### Parámetros

Se van `tornillosActivo`, `tornillosId` y `tornillosPorM2`. Entran dos bloques en
el grupo Accesorios:

```
Tornillos de plancha             (booleano, on)
  ├─ Material                    (pieza · materialUso: 'fijacion_plancha')
  └─ Separación entre tornillos  20 cm   [15 · 20 · 25]

Tornillos metal-metal            (booleano, on)
  ├─ Material                    (pieza · materialUso: 'fijacion_metal')
  └─ Tornillos por encuentro     2 un    [1 · 2 · 3]
```

El parámetro de colgante gana `materialUso: 'colgante'`.

### Punta fina — sobre los metros lineales reales de omega

```
mlOmega = Σ corridas ÷ 1000        ← las mismas corridas que ya compraron las barras
teórica = mlOmega ÷ (separación / 100)
final   = techo(teórica)
```

Nota: `28,00 ml de omega ÷ 0,20 m entre tornillos = 140,00 → 140 un`

### Punta broca — encuentros trazados más colgantes

```
encuentros = corridas × 2          ← cada corrida llega al perimetral por sus dos extremos
teórica    = encuentros × porEncuentro + colgantes
final      = techo(teórica)
```

Nota: `7 corridas × 2 extremos × 2 un = 28 un · 16 colgantes × 1 un = 16 un → 44 un`

Tres reglas que sostienen estas dos líneas:

**La fijación del colgante va fija en 1, sin parámetro.** Un colgante se amarra al
omega en un punto; no es una variable.

**Los colgantes se leen del número ya redondeado de su propia línea, no se
recalculan.** Es el mismo principio que ya sostiene el módulo con el reparto: un
solo dato leído dos veces, para que la línea de colgantes y la de tornillos no
puedan discrepar.

**La punta fina depende de la perfilería.** Si la perfilería no se pudo cubicar
—falta el omega, la separación quedó en 0, la retícula se pasó del tope— no hay
metros lineales de dónde contar y la línea sale del listado con su aviso propio.
Antes, con el 15 un/m², la línea sobrevivía sola. Es el precio de que el número
reaccione a la separación entre ejes, y es un cambio de comportamiento real, no un
detalle de implementación.

El conteo de encuentros **no** depende de `perimetralActivo`: el extremo del omega
hay que fijarlo igual, y el usuario que no los quiera apaga la línea con su propio
interruptor.

### Estructura

El bucle genérico de accesorios ya no sirve para los tres casos. Se parte en tres
funciones con la misma forma que ya tiene `cubicarBarras` —devuelven `{linea}` o
`{aviso}`—: `cubicarTornillosPlancha`, `cubicarTornillosMetal` y `cubicarPorArea`,
que queda para los colgantes. Sigue el patrón del archivo; no inventa uno nuevo.

## Recintos ya guardados

Partir un parámetro en dos deja a los recintos guardados sin las claves nuevas, y
un booleano ausente se lee como falso: las dos líneas de tornillo se caerían del
listado de un presupuesto viejo sin un solo aviso que lo explique. Quien abre una
cubicación de hace un mes no tiene por qué notar solo que le faltan los tornillos.

`completarParametros(modulo, parametros, biblioteca)` rellena **solo lo ausente**
con los valores por defecto del módulo, y se aplica en `conProyecto`, que es el
único embudo por donde entra un proyecto al estado. No va en la capa de datos
porque `schema.js` a propósito no conoce el registro de módulos.

Se completa solo lo que falta, nunca lo que ya tiene valor: un parámetro guardado
es una decisión del usuario y pisarla con el defecto sería peor que la falta.

## Errores y avisos

| Situación                                   | Nivel  | Efecto                       |
| ------------------------------------------- | ------ | ---------------------------- |
| Falta el material de una línea de tornillo  | error  | Esa línea queda fuera        |
| Separación entre tornillos ≤ 0              | error  | Esa línea queda fuera        |
| Tornillos por encuentro en 0                | info   | Esa línea no se cubica       |
| No hubo perfilería que cubicar              | error  | La punta fina queda fuera    |

Cada línea avisa por su cuenta: que falte el tornillo de plancha no puede sacar
del listado al tornillo metal-metal.

## Pruebas

Sobre el recinto de referencia que el archivo de pruebas ya usa —4,00 × 2,60 m,
ejes cada 40 cm en X, omega de 3 m, plancha de 1,20 × 2,40 m—:

- **Punta fina:** 7 corridas × 4,00 m = 28,00 ml ÷ 0,20 m → **140 un**.
- **Punta broca:** 7 × 2 = 14 encuentros × 2 un = 28, más 16 colgantes → **44 un**.
- **Colgantes:** 10,40 m² × 1,5 = 15,60 → **16 un**, sin cambio respecto de hoy.
- Abrir la separación entre ejes de 40 a 60 cm **baja** la punta fina. Es la
  prueba que fija la razón de ser del cambio.
- Sin perfilería cubicable, la punta fina no aparece y hay un aviso de error que
  la nombra.
- La punta broca cuenta el colgante con el mismo número que publica la línea de
  colgantes.
- Un material de otro uso al que apunte un proyecto guardado se trata como
  ausente: el cálculo no confía en que la interfaz ya filtró.
- `normalizarMaterial` manda a `'general'` una pieza sin `uso` y una con un `uso`
  desconocido, y el antiguo `consumo` se ignora sin romper la lectura.
- Un recinto guardado con los parámetros viejos recupera las dos líneas de
  tornillo al abrirse, sin que se pise ninguna decisión ya guardada.

## Fuera de alcance

- Distinguir tornillo de borde y tornillo de campo con separaciones distintas.
- Cubicar el anclaje del perimetral al muro (tarugo y tornillo de muro).
- Tocar el conteo de planchas, que tiene su propio pendiente abierto.
