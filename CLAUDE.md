# Kubikar — instrucciones de trabajo

Cubicación de obra sobre planta dibujada. Producto de Karbec.

Lee `PRODUCT.md` para el alcance y `DESIGN.md` para el sistema de diseño. Ambos
son normativos: si un cambio los contradice, se actualiza el documento en el
mismo commit, no después.

## Respaldo en git: OBLIGATORIO después de cada cambio de código

El trabajo se continúa desde varios computadores. Un cambio que quedó solo en el
disco de una máquina es un cambio perdido. Por eso, **cada vez que se termina un
cambio de código, hay que dejarlo commiteado y empujado a GitHub antes de dar la
tarea por cerrada.** No se acumulan cambios "para después".

El ciclo completo, sin saltarse pasos:

```sh
git pull --ff-only     # ANTES de tocar nada: traer lo del otro computador
npm run build          # tiene que pasar
npm test               # tiene que salir en verde
npm run design:check   # tiene que salir []  (arreglo vacío = sin infracciones)
git add -A
git commit -m "mensaje en español, en imperativo, explicando el porqué"
git push
npm run publicar -- <salto>   # si el cambio toca el entregable · ver más abajo
```

Reglas del respaldo:

- **Se trae ANTES de empezar, no al final.** Empezar sin traer produce dos
  historias que divergen, y entonces el push se rechaza cuando el trabajo ya
  está hecho y hay que rebasear a mano. `--ff-only` es a propósito: si no puede
  avanzar de frente, algo pasó y hay que mirarlo, no fusionarlo a ciegas.
- **Nunca se commitea con el build roto.** El respaldo sirve para retomar en otra
  máquina; retomar sobre un árbol que no compila no es retomar.
- **`npm test` es parte del ciclo.** Corre con `node --test`, sin dependencias.
  Cubre el núcleo de cálculo —geometría, reparto de barras y el módulo Cielo—,
  que es donde un error se paga con material comprado de menos.
- **`design:check` es parte del ciclo,** no un extra. Es el guardián del sistema
  de diseño y debe devolver `[]`.
- **Un commit por cambio con sentido propio.** Si una sesión toca dos cosas
  independientes, son dos commits.
- **El mensaje va en español** y dice el porqué, no el qué: el diff ya dice qué
  archivos cambiaron.
- **Se empuja siempre.** Un commit local no es un respaldo.
- **Y se publica.** El push respalda el código; lo que llega a faena es el
  entregable. Ver la sección siguiente.

## El entregable y la publicación

Kubikar se lleva a faena como **un solo archivo**. El repositorio vive dentro de
una carpeta contenedora, y el build deja el entregable un nivel más arriba:

```
Desktop\Kubikar\
├── Kubikar-codigo\        ← este repositorio
└── Kubikar.html           ← el entregable: lo que de verdad se abre
```

**Esa hermandad es una dependencia real del build, no una convención.**
`vite.config.js` escribe `../Kubikar.html` y `scripts/publicar.mjs` lo lee desde
ahí. Mover el repositorio de sitio rompe las dos cosas en silencio.

### Clonar en un computador nuevo

El clon va **dentro** del contenedor, no en su lugar:

```sh
mkdir Kubikar
git clone https://github.com/fabio3kof-collab/Kubikar.git Kubikar\Kubikar-codigo
cd Kubikar\Kubikar-codigo
npm install
```

Clonar directo sobre el Escritorio deja el repositorio ocupando el lugar del
contenedor. Eso no falla: el build escribe entonces `Desktop\Kubikar.html`,
suelto entre los demás archivos, y `publicar` sube ese. El error se descubre en
faena, con la versión equivocada sobre la mesa.

Por eso la ubicación **se verifica sola** —`scripts/verificar-ubicacion.mjs`— en
`npm install` y otra vez al empezar el build, antes de gastarlo. Si el clon quedó
mal, el mensaje trae los comandos para moverlo con las rutas de esa máquina ya
resueltas. No hay que acordarse de esta sección: basta con clonar y ejecutar.

El guardián exige que el nivel de arriba sea la carpeta `Kubikar`, no un nombre
para el clon: cada computador tiene el suyo y todos sirven.

El entregable es autocontenido —JS, CSS y la fuente van embebidos— para que
funcione con doble clic desde `file://`, sin servidor. El build **falla** si el
CONTRATO DE DIRECCION de `index.html` no sobrevive al inlinado: un entregable que
no se puede auditar no sirve.

`npm run publicar` hace el ciclo completo, pensado para trabajar desde varios PCs:

1. **Trae de GitHub antes de compilar** (`fetch` + `merge --ff-only`). Si se
   publicó desde el otro computador, este clon está atrasado y el push del final
   sería rechazado con el build ya gastado. Falla temprano y con mensaje
   accionable.
2. Corre `npm test` y `npm run design:check`.
3. Sube el número en `package.json`, compila, y deja `Kubikar.html` +
   `version.json` en la raíz del repositorio.
4. Commitea **solo esos tres archivos** y empuja, previa confirmación. El resto
   del árbol queda intacto: publicar no barre con trabajo a medio hacer.

Ese `version.json` es lo que consulta cada copia al abrirse
(`src/data/actualizaciones.js`). El repositorio es **público** a propósito: es lo
que permite el chequeo sin token, y un token horneado en el entregable sería un
token publicado.

Kubikar no se actualiza solo, y no lo promete: una página web no escribe sobre el
archivo que la abrió. El aviso baja el HTML nuevo a Descargas y dice que el viejo
se reemplaza a mano.

### Publicar con número nuevo: OBLIGATORIO en cada cambio que toca el entregable

**Todo cambio de código que llegue al entregable se publica con un número de
versión nuevo, en la misma sesión en que se hizo.** No se acumulan cambios "para
publicar todos juntos después".

La razón no es ceremonia de versionado. El entregable se copia a mano de un
computador a otro, y el número que se ve en la barra superior es **lo único que
distingue dos copias sobre la misma mesa**. Un cambio commiteado y no publicado
deja a la faena cubicando con el código anterior mientras el repositorio dice
otra cosa; y peor, si se publican dos entregables distintos bajo el mismo número,
el mecanismo entero de aviso deja de servir para siempre: nadie puede volver a
confiar en que 0.2.0 signifique una sola cosa.

Qué salto corresponde:

- **`patch`** (0.2.0 → 0.2.1): corrección que no cambia lo que el usuario ve ni
  cómo se opera. Un cálculo que estaba mal, un texto, un borde.
- **`minor`** (0.2.0 → 0.3.0): función nueva, control nuevo, o cualquier cambio
  visible en la interfaz. Es el caso corriente.
- **`major`** (0.2.0 → 1.0.0): cambia la manera de trabajar, o el formato de
  archivo deja de leerse hacia atrás.

Cómo se invoca. **El script pregunta las notas y la confirmación por consola**,
así que desde un agente o un shell sin interactividad hay que pasarle las dos
banderas o se queda colgado esperando:

```sh
npm run publicar -- minor --si --notas "Una linea, la que el usuario lee en el aviso"
```

Las notas van **sin acentos ni comillas dobles**: viajan al mensaje de commit a
través del shell de Windows y ahí se estropean. El resto del producto sí lleva
acentos; esta línea es la excepción, y es por el transporte.

Lo que NO se publica: un cambio que no llega al entregable —`CLAUDE.md`,
`PRODUCT.md`, `DESIGN.md`, una prueba— se commitea y se empuja como cualquier
otro, pero no gasta número. Publicar un HTML idéntico al anterior con número
nuevo le muestra a todas las copias una banda de actualización que no trae nada:
es gritar lobo, y la próxima banda —la que sí importa— se descarta sin leer.

Si el cambio de documento acompaña a uno de código, viajan juntos y se publica
una sola vez.

## Arquitectura: las dos reglas que no se rompen

1. **La geometría vive en milímetros.** Es la unidad base y la única que se
   guarda. La unidad activa (mm/cm/m) es una lente de lectura: entra solo al
   formatear un número en pantalla y jamás toca un cálculo.

2. **La interfaz no conoce ningún módulo por nombre.** No hay una sola condición
   sobre `moduloId` en los componentes. Todo lo que la interfaz sabe de un
   módulo sale del contrato de `src/modules/registry.js`:

   - `esquema` → el panel de parámetros se dibuja solo
   - `calcular(ctx)` → las líneas de material y los avisos
   - `trazar(ctx)` → las capas de despiece que el lienzo pinta dentro del
     polígono, en milímetros y declarando un **rol de dibujo** (`pieza` / `eje`),
     nunca una tinta ni un grosor: el sistema de diseño es del lienzo.

   Agregar un módulo nuevo es crear su archivo y registrarlo en
   `src/modules/index.js`. No hay paso 3.

`calcular` y `trazar` son funciones puras: no leen `localStorage`, no tocan el
DOM, no dependen de la unidad activa y nunca lanzan.
