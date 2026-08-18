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
npm run build          # tiene que pasar
npm test               # tiene que salir en verde
npm run design:check   # tiene que salir []  (arreglo vacío = sin infracciones)
git add -A
git commit -m "mensaje en español, en imperativo, explicando el porqué"
git push
```

Reglas del respaldo:

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
