#!/usr/bin/env node
/* Verifica que el repositorio esté dentro de su carpeta contenedora.
 *
 *   node scripts/verificar-ubicacion.mjs   → falla con instrucciones si está mal
 *
 * El build escribe el entregable en `..\Kubikar.html` y `scripts/publicar.mjs`
 * lo lee desde ahí. Esa hermandad es una dependencia real, no una convención:
 *
 *   Kubikar\                 ← la carpeta contenedora
 *   ├── Kubikar-codigo\      ← este repositorio
 *   └── Kubikar.html         ← el entregable, el que de verdad se abre
 *
 * Un clon hecho directo sobre el Escritorio deja el repositorio un nivel más
 * arriba de donde va. Nada se rompe con estruendo: el build escribe entonces
 * `Desktop\Kubikar.html`, suelto entre los demás archivos, y `publicar` sube ese
 * archivo. El error se descubre tarde, en faena y con la versión equivocada.
 *
 * Por eso esto corre solo, en `postinstall` —lo primero que se hace tras clonar—
 * y otra vez en el build, antes de escribir nada. Ver `CLAUDE.md`.
 */
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** La carpeta contenedora se llama así en todos los computadores. */
const CONTENEDOR = 'Kubikar'

/** Nombre con el que se clona el repositorio dentro del contenedor. */
const NOMBRE_CLON = 'Kubikar-codigo'

/**
 * Explica dónde está el repositorio y cómo moverlo, con las rutas de esta
 * máquina ya resueltas. Un mensaje que obliga a traducir un diagrama a comandos
 * es un mensaje que se ignora.
 *
 * @param {string} dir Directorio del repositorio.
 * @returns {string}
 */
function comoArreglarlo(dir) {
  const padre = dirname(dir)

  // Caso corriente: se clonó `Kubikar` directo sobre el Escritorio, así que la
  // carpeta que iba a ser el contenedor quedó ocupada por el repositorio. El
  // arreglo no es mover el clon a otra parte, sino hundirlo un nivel.
  if (basename(dir).toLowerCase() === CONTENEDOR.toLowerCase()) {
    return [
      `El repositorio ocupa la carpeta contenedora. Muévelo un nivel adentro:`,
      ``,
      `  cd "${dir}"`,
      `  mkdir ${NOMBRE_CLON}`,
      `  Get-ChildItem -Force | Where-Object Name -ne '${NOMBRE_CLON}' |`,
      `    Move-Item -Destination ${NOMBRE_CLON}`,
      ``,
      `El repositorio queda en ${resolve(dir, NOMBRE_CLON)}`,
    ].join('\n')
  }

  return [
    `Mueve el repositorio dentro de una carpeta '${CONTENEDOR}':`,
    ``,
    `  cd "${padre}"`,
    `  mkdir ${CONTENEDOR}`,
    `  Move-Item "${basename(dir)}" ${CONTENEDOR}`,
    ``,
    `El repositorio queda en ${resolve(padre, CONTENEDOR, basename(dir))}`,
  ].join('\n')
}

/**
 * Falla si el repositorio no cuelga de la carpeta contenedora.
 *
 * No exige un nombre para el clon —cada máquina lo tiene distinto— sino que el
 * nivel de arriba sea el contenedor, que es lo que el build necesita de verdad.
 *
 * @param {string} [dir] Directorio del repositorio.
 * @throws {Error} Si el entregable no tendría dónde caer.
 */
export function verificarUbicacion(dir = raiz) {
  const padre = dirname(dir)
  if (basename(padre).toLowerCase() === CONTENEDOR.toLowerCase()) return

  throw new Error(
    [
      `El repositorio está fuera de su carpeta contenedora '${CONTENEDOR}'.`,
      ``,
      `  Está en:  ${dir}`,
      `  El build escribiría el entregable en: ${resolve(padre, 'Kubikar.html')}`,
      ``,
      comoArreglarlo(dir),
    ].join('\n'),
  )
}

// Ejecutado directo (postinstall): el mensaje va a consola, no una traza.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    verificarUbicacion()
  } catch (e) {
    console.error(`\n  ✕ ${e.message}\n`)
    process.exit(1)
  }
}
