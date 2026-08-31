import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { copyFileSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = dirname(fileURLToPath(import.meta.url))

// La version del entregable sale de package.json y se hornea dentro del HTML:
// es lo unico que le permite a una copia en faena saber si esta vieja. Ver
// src/data/actualizaciones.js y `npm run publicar`.
const pkg = JSON.parse(readFileSync(resolve(raiz, 'package.json'), 'utf8'))
const fechaBuild = new Date().toISOString().slice(0, 10)

// Marca que tiene que sobrevivir al build. El contrato de direccion vive como
// comentario HTML en index.html y debe poder auditarse en produccion; buscarlo
// por esta linea es mas barato que confiar en que nadie lo pise.
const MARCA_CONTRATO = 'CONTRATO DE DIRECCION'

/**
 * Deja el entregable listo para doble clic UN NIVEL MAS ARRIBA, en la carpeta
 * que contiene este repositorio. Asi, al abrir `Desktop\Kubikar` se ve un unico
 * `Kubikar.html`: el que de verdad se usa.
 *
 * No puede llamarse `index.html`: ese nombre lo ocupa la plantilla de entrada de
 * Vite, la que carga `/src/main.jsx` en dev.
 *
 * La hermandad de las dos rutas es una dependencia real del build, no una
 * convencion; `scripts/publicar.mjs` lee el entregable desde ahi.
 *
 * @returns {import('vite').Plugin}
 */
function entregableEnEspacioDeTrabajo() {
  return {
    name: 'kubikar:entregable-en-espacio-de-trabajo',
    apply: 'build',
    closeBundle() {
      const origen = resolve(raiz, 'dist/index.html')
      const html = readFileSync(origen, 'utf8')

      // El minificador solo toca JS y CSS, pero el inlinado del entregable
      // reescribe el HTML entero: si el contrato desaparecio, el build falla
      // aca y no en una auditoria seis meses despues.
      if (!html.includes(MARCA_CONTRATO)) {
        throw new Error(
          `El build perdio el ${MARCA_CONTRATO} de index.html. ` +
            'El entregable tiene que poder auditarse; revisa el inlinado antes de publicar.',
        )
      }

      const destino = resolve(raiz, '..', 'Kubikar.html')
      copyFileSync(origen, destino)
      const kb = (statSync(destino).size / 1024).toFixed(0)
      console.log(`\n  Entregable listo (${kb} kB) - doble clic en:\n    ${destino}\n`)
    },
  }
}

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(fechaBuild),
  },
  plugins: [react(), tailwindcss(), viteSingleFile(), entregableEnEspacioDeTrabajo()],
  build: {
    // El contrato de direccion vive como comentario HTML en index.html y debe
    // sobrevivir el build de produccion para poder auditarse.
    //
    // Vite 8 transpila y minifica con oxc: esbuild ya no viene incluido y
    // pedirlo por nombre rompe el build con "Cannot find package 'esbuild'".
    // El minificador solo toca JS y CSS; los comentarios de index.html pasan
    // intactos, que es lo que este ajuste tiene que garantizar.
    minify: 'oxc',
    // El entregable se abre con doble clic desde file://, sin servidor: todo
    // -JS, CSS y las fuentes- viaja dentro del HTML.
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
  },
})
