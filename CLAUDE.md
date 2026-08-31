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
