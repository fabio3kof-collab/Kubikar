/**
 * Kubikar · chequeo de versión contra GitHub
 * -----------------------------------------------------------------------------
 * ESTE ES EL ÚNICO ARCHIVO DE TODO EL CÓDIGO QUE HABLA POR LA RED.
 *
 * El entregable es un `Kubikar.html` suelto que se copia a mano a cada PC de
 * obra. Sin esto, una copia vieja sigue cubicando con un cálculo corregido hace
 * meses y nadie se entera hasta que falta material en faena.
 *
 * Kubikar se abre con doble clic desde `file://`, sin servidor. Aun así una
 * página abierta desde `file://` puede pedir recursos https siempre que el
 * servidor responda con `Access-Control-Allow-Origin: *`, que es justo lo que
 * hace `raw.githubusercontent.com`. De ahí sale todo este módulo.
 *
 * Lo que NO se puede hacer, y por eso ni se intenta: reemplazar el propio
 * `Kubikar.html` en el disco. Una página web no escribe sobre el archivo que la
 * abrió. El alcance máximo es dejar el HTML nuevo en la carpeta Descargas y
 * pedirle al usuario que reemplace el viejo a mano.
 *
 * El repositorio es PÚBLICO, y eso es lo que hace posible el chequeo sin token:
 * un token de lectura horneado en el entregable sería un token publicado.
 */

/** Repositorio desde donde se publica el entregable y su manifiesto. */
export const REPO_PUBLICACION = 'fabio3kof-collab/Kubikar'

const BASE_RAW = `https://raw.githubusercontent.com/${REPO_PUBLICACION}/main`

export const URL_MANIFIESTO = `${BASE_RAW}/version.json`
export const URL_DESCARGA = `${BASE_RAW}/Kubikar.html`
export const URL_REPO = `https://github.com/${REPO_PUBLICACION}`

/* Horneadas en el build por `define` (ver vite.config.js). La guarda `typeof`
 * deja el módulo importable fuera de un bundle de Vite, que es lo que necesitan
 * los tests de `node --test`. */

/** Versión de esta copia. @type {string} */
export const VERSION_ACTUAL = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'

/** Fecha de compilación de esta copia, `AAAA-MM-DD`. @type {string} */
export const FECHA_BUILD = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : ''

/**
 * @typedef {Object} Manifiesto
 * @property {string} version
 * @property {string} [fecha]   fecha de publicación, AAAA-MM-DD
 * @property {string} [notas]   una línea: qué cambió
 * @property {string} [url]     de dónde se baja el entregable
 */

/**
 * @typedef {{estado:'al-dia', version:string}
 *          |{estado:'hay-nueva', manifiesto:Manifiesto}
 *          |{estado:'sin-conexion'}} ResultadoChequeo
 */

/**
 * Compara dos versiones tipo `1.2.3` por partes numéricas.
 *
 * Compararlas como texto daría `"1.10.0" < "1.9.0"`, que es justo al revés y es
 * el error que aparece recién en la décima versión menor, cuando ya nadie está
 * mirando.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} negativo si `a` es anterior a `b`, 0 si equivalen, positivo si es posterior
 */
export function compararVersiones(a, b) {
  const partes = (v) =>
    String(v ?? '')
      .trim()
      .split('.')
      .map((t) => parseInt(t, 10) || 0)

  const pa = partes(a)
  const pb = partes(b)
  const largo = Math.max(pa.length, pb.length)

  for (let i = 0; i < largo; i++) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

/**
 * Lee el manifiesto publicado y lo compara con la versión de esta copia.
 *
 * NUNCA LANZA. Sin internet, con GitHub caído, con un 404 o con un JSON roto
 * devuelve `sin-conexion`. Kubikar es una herramienta de terreno: estar offline
 * es el caso normal, no una falla que haya que reportarle al usuario.
 *
 * @param {number} [timeoutMs]
 * @returns {Promise<ResultadoChequeo>}
 */
export async function buscarActualizacion(timeoutMs = 5000) {
  try {
    const control = new AbortController()
    const temporizador = setTimeout(() => control.abort(), timeoutMs)

    let respuesta
    try {
      // El sufijo saltea la caché del navegador. El CDN de GitHub igual guarda
      // el manifiesto unos minutos, lo que para este uso da lo mismo.
      respuesta = await fetch(`${URL_MANIFIESTO}?t=${Date.now()}`, {
        signal: control.signal,
        cache: 'no-store',
      })
    } finally {
      clearTimeout(temporizador)
    }

    if (!respuesta || !respuesta.ok) return { estado: 'sin-conexion' }

    const manifiesto = await respuesta.json()
    if (!manifiesto || typeof manifiesto.version !== 'string') return { estado: 'sin-conexion' }

    return compararVersiones(manifiesto.version, VERSION_ACTUAL) > 0
      ? { estado: 'hay-nueva', manifiesto }
      : { estado: 'al-dia', version: VERSION_ACTUAL }
  } catch {
    return { estado: 'sin-conexion' }
  }
}

/**
 * Baja el `Kubikar.html` nuevo a la carpeta Descargas.
 *
 * Va por `fetch` → `Blob` → `<a download>` y no por un enlace directo porque el
 * atributo `download` se ignora en enlaces cross-origin: apuntar a
 * `raw.githubusercontent.com` abriría el HTML como texto en vez de bajarlo.
 *
 * LANZA si la descarga falla; quien llama decide qué mostrar. Es la excepción a
 * la regla de este módulo, y es deliberada: acá el usuario pidió la acción y una
 * falla silenciosa lo dejaría esperando un archivo que no va a llegar.
 *
 * @param {string} [url]
 * @param {(porcentaje:number|null)=>void} [onProgreso] recibe 0–100, o null si no hay tamaño
 * @returns {Promise<void>}
 */
export async function descargarActualizacion(url = URL_DESCARGA, onProgreso) {
  const respuesta = await fetch(url, { cache: 'no-store' })
  if (!respuesta.ok) throw new Error(`GitHub respondió ${respuesta.status}`)

  const total = Number(respuesta.headers.get('content-length')) || 0
  let blob

  if (respuesta.body && total > 0) {
    const lector = respuesta.body.getReader()
    const trozos = []
    let leido = 0
    for (;;) {
      const { done, value } = await lector.read()
      if (done) break
      trozos.push(value)
      leido += value.length
      if (onProgreso) onProgreso(Math.min(100, Math.round((leido / total) * 100)))
    }
    blob = new Blob(trozos, { type: 'text/html' })
  } else {
    // `content-length` no siempre viaja cross-origin: se baja sin progreso.
    if (onProgreso) onProgreso(null)
    blob = await respuesta.blob()
  }

  const href = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = href
  enlace.download = 'Kubikar.html'
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(href), 60000)
}
