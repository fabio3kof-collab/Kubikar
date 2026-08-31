#!/usr/bin/env node
/* Publica una versión nueva de Kubikar.
 *
 *   npm run publicar                        → sube el último número (0.1.0 → 0.1.1)
 *   npm run publicar -- minor               → 0.1.1 → 0.2.0
 *   npm run publicar -- 1.0.0               → versión explícita
 *   npm run publicar -- --notas "Arregla X" → nota que verá el usuario en el aviso
 *   npm run publicar -- --si                → no preguntar antes del push
 *
 * Deja `Kubikar.html` y `version.json` en la raíz del repositorio, commiteados y
 * subidos. Ese par es lo que consultan todas las copias al abrirse; ver
 * `src/data/actualizaciones.js`.
 *
 * KUBIKAR PUBLICA EN SU PROPIO REPOSITORIO, y eso es toda la diferencia con
 * AeroPlan, que necesita un repo público aparte porque su código es privado. Acá
 * el repositorio ya es público: un clon, un fetch, un commit, un push.
 *
 * Está pensado para trabajar desde varios PCs. Por eso el primer paso —antes que
 * cualquier otra cosa— es traer de GitHub lo que se haya publicado desde la otra
 * máquina. Sin eso, el push del final se rechaza cuando el build ya se gastó.
 */
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const REPO_PUBLICACION = 'fabio3kof-collab/Kubikar'
const URL_DESCARGA = `https://raw.githubusercontent.com/${REPO_PUBLICACION}/main/Kubikar.html`

/** Lo que la publicación reescribe siempre, y por eso puede descartar. */
const ENTREGABLES = ['Kubikar.html', 'version.json']

const salir = (msg) => {
  console.error(`\n  ✕ ${msg}\n`)
  process.exit(1)
}

/** Corre un comando y aborta si falla. */
function correr(cmd, args, cwd = raiz) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true })
  if (r.status !== 0) salir(`Falló: ${cmd} ${args.join(' ')}`)
}

/** Corre un comando y devuelve lo que imprimió, sin ruido. */
function capturar(cmd, args, cwd = raiz) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: true })
  return (r.stdout || '').trim()
}

/** Como `correr`, pero sin abortar: devuelve el código y lo que imprimió. */
function correrSuave(cmd, args, cwd = raiz) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: true })
  return { ok: r.status === 0, codigo: r.status, salida: `${r.stdout || ''}${r.stderr || ''}`.trim() }
}

/** Archivos con cambios sin guardar. */
function archivosSucios(cwd = raiz) {
  return capturar('git', ['status', '--porcelain'], cwd)
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(3).trim())
}

/* ── Argumentos ─────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2)
const sinPreguntar = argv.includes('--si')
const iNotas = argv.indexOf('--notas')
let notas = iNotas >= 0 ? argv[iNotas + 1] || '' : ''
const posicional = argv.filter((a, i) => !a.startsWith('--') && (iNotas < 0 || i !== iNotas + 1))[0] || 'patch'

/* ── Versión nueva ──────────────────────────────────────────────────────────── */

const rutaPkg = resolve(raiz, 'package.json')
const pkg = JSON.parse(readFileSync(rutaPkg, 'utf8'))
const versionAnterior = pkg.version

function calcularVersion(actual, salto) {
  if (/^\d+\.\d+\.\d+$/.test(salto)) return salto
  const [may, men, par] = actual.split('.').map((n) => parseInt(n, 10) || 0)
  if (salto === 'major') return `${may + 1}.0.0`
  if (salto === 'minor') return `${may}.${men + 1}.0`
  if (salto === 'patch') return `${may}.${men}.${par + 1}`
  return salir(`No entiendo "${salto}". Usa patch, minor, major o una versión tipo 1.2.3.`)
}

const versionNueva = calcularVersion(versionAnterior, posicional)

/* ── 1 · Traer lo de GitHub, ANTES de compilar ───────────────────────────────
 * Si se publicó desde el otro PC, este clon está atrasado y el push de más abajo
 * sería rechazado. Se sincroniza primero para no gastar el build en vano y para
 * fallar temprano si no hay conexión. */

function sincronizar() {
  const rama = capturar('git', ['rev-parse', '--abbrev-ref', 'HEAD']) || 'main'

  const traer = correrSuave('git', ['fetch', 'origin', '--quiet'])
  if (!traer.ok) {
    salir(
      `No pude conectar con GitHub para sincronizar.\n    ${traer.salida}\n\n` +
        `  Revisa la conexión y vuelve a intentar.`,
    )
  }

  const atrasado = parseInt(capturar('git', ['rev-list', '--count', `HEAD..origin/${rama}`]), 10) || 0
  if (!atrasado) return

  console.log(`\n→ El repositorio va ${atrasado} commit(s) atrás; trayendo lo de GitHub…`)

  // Sobras de una publicación cancelada. Se descartan SOLO estos dos archivos,
  // que la publicación reescribe igual: el resto del árbol es trabajo del
  // usuario y no se toca ni para desbloquear un merge.
  //
  // Y solo si ya están versionados: en la primera publicación son archivos
  // nuevos, y `git checkout HEAD --` sobre algo que HEAD no conoce falla.
  const sobras = archivosSucios()
    .filter((f) => ENTREGABLES.includes(f))
    .filter((f) => capturar('git', ['ls-files', '--', f]))
  if (sobras.length) correr('git', ['checkout', 'HEAD', '--', ...sobras])

  const avanzar = correrSuave('git', ['merge', '--ff-only', `origin/${rama}`])
  if (!avanzar.ok) {
    salir(
      `No pude adelantar este clon hasta GitHub:\n    ${avanzar.salida}\n\n` +
        `  Suele ser una de dos: hay cambios sin commitear que el merge pisaría, o este\n` +
        `  clon tiene commits propios que divergieron. Revisa con "git status" y "git log".`,
    )
  }
  console.log('  ✓ Al día con GitHub.\n')
}

sincronizar()

/* ── 2 · Las verificaciones del ciclo ────────────────────────────────────────
 * Publicar un entregable que no pasa los tests contradice el CLAUDE.md, y el
 * entregable es justo lo que se lleva a faena. */

function verificar() {
  console.log('→ Corriendo las pruebas…\n')
  const pruebas = correrSuave('npm', ['test'])
  if (!pruebas.ok) {
    salir(`Las pruebas no pasan; no se publica.\n\n${pruebas.salida}`)
  }
  console.log('  ✓ Pruebas en verde.')

  const diseno = correrSuave('npm', ['run', 'design:check'])
  if (diseno.codigo === 2) {
    // El detector se distribuye con la skill de Impeccable, no con este repo:
    // en un PC sin ella no se puede verificar, pero tampoco es razón para no
    // publicar una corrección de cálculo.
    console.log('  ⚠ El detector de diseño no está instalado en este PC; se publica sin esa verificación.')
  } else if (!diseno.ok) {
    salir(`El guardián del sistema de diseño encontró infracciones.\n\n${diseno.salida}`)
  } else {
    console.log('  ✓ Sistema de diseño sin infracciones.')
  }
}

verificar()

/* ── 3 · Publicar ───────────────────────────────────────────────────────────── */

const rl = createInterface({ input: process.stdin, output: process.stdout })
const preguntar = async (q) => (sinPreguntar ? 'si' : (await rl.question(q)).trim().toLowerCase())

try {
  if (!notas && !sinPreguntar) {
    notas = (await rl.question(`\n¿Qué cambió en la ${versionNueva}? (una línea, se muestra en el aviso)\n> `)).trim()
  }
  notas = notas.replace(/"/g, "'") // las comillas rompen el commit en cmd.exe

  console.log(`\n  Versión:  ${versionAnterior} → ${versionNueva}`)
  console.log(`  Notas:    ${notas || '(sin notas)'}`)

  // Aviso, no bloqueo: el build sale del código tal como está en el disco.
  const codigoSucio = archivosSucios().filter((f) => f !== 'package.json' && !ENTREGABLES.includes(f))
  if (codigoSucio.length) {
    console.log(`  Ojo:      ${codigoSucio.length} archivo(s) sin commitear; el build los incluye.`)
  }
  console.log('')

  /* El número se hornea en el HTML, así que sube ANTES de compilar. */
  pkg.version = versionNueva
  writeFileSync(rutaPkg, JSON.stringify(pkg, null, 2) + '\n')

  console.log('→ Compilando…\n')
  const build = spawnSync('npm', ['run', 'build'], { cwd: raiz, stdio: 'inherit', shell: true })
  if (build.status !== 0) {
    pkg.version = versionAnterior // package.json queda como estaba
    writeFileSync(rutaPkg, JSON.stringify(pkg, null, 2) + '\n')
    salir('El build falló. package.json quedó en la versión anterior.')
  }

  // El build deja el entregable un nivel más arriba, en la carpeta que contiene
  // este repositorio (ver entregableEnEspacioDeTrabajo en vite.config.js).
  const entregable = resolve(raiz, '..', 'Kubikar.html')
  if (!existsSync(entregable)) salir(`El build terminó pero no encuentro ${entregable}.`)

  copyFileSync(entregable, resolve(raiz, 'Kubikar.html'))
  const manifiesto = {
    version: versionNueva,
    fecha: new Date().toISOString().slice(0, 10),
    notas,
    url: URL_DESCARGA,
  }
  writeFileSync(resolve(raiz, 'version.json'), JSON.stringify(manifiesto, null, 2) + '\n')

  const kb = (statSync(entregable).size / 1024).toFixed(0)
  console.log(`\n  ✓ Kubikar.html (${kb} kB) + version.json listos para publicar.`)

  /* Solo los tres archivos de la publicación. Cualquier otro cambio del código
   * queda tal como estaba: publicar no debe barrer con trabajo a medio hacer. */
  correr('git', ['add', 'package.json', ...ENTREGABLES])
  if (!capturar('git', ['diff', '--cached', '--name-only'])) {
    console.log('\n  Nada que publicar: el entregable es idéntico al ya publicado.\n')
    process.exit(0)
  }

  const r = await preguntar(`\n¿Publicar la ${versionNueva} en github.com/${REPO_PUBLICACION}? [s/N] `)
  if (r !== 's' && r !== 'si' && r !== 'sí') {
    console.log('\n  Cancelado. Los archivos quedaron preparados y en staging, sin commit.')
    console.log(`  package.json quedó en la ${versionNueva} sin commitear: revísalo antes de volver a publicar.\n`)
    process.exit(0)
  }

  const mensaje = notas ? `Kubikar ${versionNueva} — ${notas}` : `Kubikar ${versionNueva}`
  correr('git', ['commit', '-m', JSON.stringify(mensaje), '--', 'package.json', ...ENTREGABLES])

  const push = correrSuave('git', ['push'])
  console.log(
    push.ok
      ? `\n  ✓ Publicada la ${versionNueva}. Las demás copias avisarán al abrirse.\n`
      : `\n  ✓ Versión ${versionNueva} commiteada.\n` +
          `  ⚠ El push falló:\n    ${push.salida}\n    Súbelo a mano con: git push\n`,
  )
} finally {
  rl.close()
}
