/**
 * Kubikar · driver de almacenamiento local
 * -----------------------------------------------------------------------------
 * ESTE ES EL ÚNICO ARCHIVO DE TODO EL CÓDIGO QUE MENCIONA `localStorage`.
 *
 * Ni un componente, ni un hook, ni un módulo de cálculo lo importa: hablan con
 * `src/data/repo.js`, que es la única puerta de persistencia. Cuando Kubikar
 * pase a guardar contra la API de la plataforma Karbec, se reemplaza este
 * driver (o se cambia el que usa `repo.js`) y no se toca nada más.
 *
 * Este driver es SÍNCRONO a propósito: `repo.js` es quien pone la frontera
 * asíncrona, de manera que la interfaz ya está escrita contra promesas.
 */

/**
 * Claves del almacenamiento. Llevan versión en el nombre para poder migrar sin
 * pisar los datos de una versión anterior.
 * @type {{proyectos:string, biblioteca:string, preferencias:string}}
 */
export const CLAVES = {
  proyectos: 'kubikar.v1.proyectos',
  biblioteca: 'kubikar.v1.biblioteca',
  preferencias: 'kubikar.v1.preferencias',
}

/**
 * Falla de almacenamiento con causa clasificada, para que la interfaz pueda
 * decir qué pasó y ofrecer la salida (exportar el proyecto a JSON).
 */
export class ErrorAlmacenamiento extends Error {
  /**
   * @param {'cuota'|'lectura'|'escritura'} tipo
   * @param {string} mensaje
   * @param {*} [causa]
   */
  constructor(tipo, mensaje, causa) {
    super(mensaje)
    this.name = 'ErrorAlmacenamiento'
    /** @type {'cuota'|'lectura'|'escritura'} */
    this.tipo = tipo
    /** @type {string} */
    this.mensaje = mensaje
    /** @type {*} */
    this.causa = causa ?? null
  }
}

/**
 * Devuelve el almacén del navegador o lanza si no hay ninguno accesible.
 * En modo privado de algunos navegadores el objeto existe pero cualquier
 * operación lanza; por eso el acceso va siempre dentro de try.
 * @returns {Storage}
 */
function almacen() {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new ErrorAlmacenamiento(
      'lectura',
      'El navegador no permite guardar datos en este equipo. Exporta el proyecto a JSON para conservar el trabajo.',
    )
  }
  return window.localStorage
}

/**
 * Reconoce la falta de espacio: `QuotaExceededError` estándar, el nombre
 * heredado de Firefox y los códigos numéricos 22 y 1014. También cuenta como
 * cuota el caso de Safari en navegación privada, que lanza al escribir con
 * cuota cero.
 * @param {*} error
 * @returns {boolean}
 */
function esErrorDeCuota(error) {
  if (!error || typeof error !== 'object') return false
  const nombre = typeof error.name === 'string' ? error.name : ''
  const codigo = typeof error.code === 'number' ? error.code : null
  const mensaje = typeof error.message === 'string' ? error.message.toLowerCase() : ''
  return (
    nombre === 'QuotaExceededError' ||
    nombre === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    codigo === 22 ||
    codigo === 1014 ||
    mensaje.includes('quota') ||
    mensaje.includes('cuota')
  )
}

/**
 * Lee y deserializa una clave.
 * @param {string} clave
 * @param {*} [porDefecto] valor devuelto cuando la clave no existe
 * @returns {*}
 * @throws {ErrorAlmacenamiento} tipo 'lectura'
 */
export function leer(clave, porDefecto = null) {
  let crudo
  try {
    crudo = almacen().getItem(clave)
  } catch (error) {
    if (error instanceof ErrorAlmacenamiento) throw error
    throw new ErrorAlmacenamiento(
      'lectura',
      'No se pudieron leer los datos guardados en este navegador. Revisa los permisos de almacenamiento del sitio.',
      error,
    )
  }

  if (crudo === null || crudo === undefined) return porDefecto

  try {
    return JSON.parse(crudo)
  } catch (error) {
    throw new ErrorAlmacenamiento(
      'lectura',
      'Los datos guardados en este navegador están dañados y no se pudieron leer. Importa un respaldo en JSON para recuperarlos.',
      error,
    )
  }
}

/**
 * Serializa y escribe una clave.
 * @param {string} clave
 * @param {*} valor
 * @returns {void}
 * @throws {ErrorAlmacenamiento} tipo 'cuota' o 'escritura'
 */
export function escribir(clave, valor) {
  let texto
  try {
    texto = JSON.stringify(valor)
  } catch (error) {
    throw new ErrorAlmacenamiento(
      'escritura',
      'No se pudo preparar la información para guardarla. Exporta el proyecto a JSON para conservar el trabajo.',
      error,
    )
  }

  try {
    almacen().setItem(clave, texto)
  } catch (error) {
    if (error instanceof ErrorAlmacenamiento) throw error
    if (esErrorDeCuota(error)) {
      throw new ErrorAlmacenamiento(
        'cuota',
        'Se acabó el espacio de almacenamiento del navegador. Exporta el proyecto a JSON y elimina proyectos antiguos para seguir guardando.',
        error,
      )
    }
    // Navegación privada o almacenamiento bloqueado por política del sitio.
    throw new ErrorAlmacenamiento(
      'escritura',
      'El navegador rechazó guardar los datos, puede estar en modo privado o con el almacenamiento bloqueado. Exporta el proyecto a JSON para no perder el trabajo.',
      error,
    )
  }
}

/**
 * Borra una clave.
 * @param {string} clave
 * @returns {void}
 * @throws {ErrorAlmacenamiento} tipo 'escritura'
 */
export function borrar(clave) {
  try {
    almacen().removeItem(clave)
  } catch (error) {
    if (error instanceof ErrorAlmacenamiento) throw error
    throw new ErrorAlmacenamiento(
      'escritura',
      'No se pudo borrar la información guardada en este navegador.',
      error,
    )
  }
}

/**
 * Prueba de escritura real: la única manera confiable de saber si se puede
 * guardar es intentarlo, porque en modo privado el objeto existe igual.
 * @returns {boolean}
 */
export function almacenamientoDisponible() {
  const sonda = 'kubikar.v1.sonda'
  try {
    const s = almacen()
    s.setItem(sonda, '1')
    s.removeItem(sonda)
    return true
  } catch {
    return false
  }
}
