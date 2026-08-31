/* =============================================================================
   Kubikar · consolidado de proyecto
   -----------------------------------------------------------------------------
   Recorre los recintos del proyecto, corre el módulo de cada uno y junta las
   líneas de material en una sola lista de compra.

   Dos decisiones de fondo, ambas exigidas por el contrato:

   1. Se agrupa por `materialId`. Cuando la línea no apunta a un material de la
      biblioteca se cae a `clave` + `nombre`, que es estable dentro del módulo.
      Así dos recintos que usan la misma plancha suman, y dos líneas distintas
      del mismo módulo nunca se confunden entre sí.

   2. Los recintos que no se pueden cubicar se DECLARAN en `omitidos`, con su
      razón. El consolidado nunca muestra cero por un recinto que quedó fuera:
      un cero silencioso en una cubicación es un error que se paga en terreno.

   Las cantidades finales se suman ya redondeadas por recinto. Es deliberado: en
   obra cada recinto se corta aparte, así que el sobrante de uno no cubre al
   siguiente. Se suma lo que hay que comprar, no lo que teóricamente alcanzaría.

   Sobre esa suma, y solo acá, se aplica el ESCALÓN DE COMPRA que la línea haya
   declarado. Es la excepción a lo anterior y por la misma razón que lo anterior:
   un retazo de barra no viaja al recinto siguiente, pero un tornillo sí, así que
   la ferretería se visita una vez para toda la obra. Tres recintos de 20
   tornillos son 60 tornillos que se piden como 100, no 150. Ver
   `src/core/compra.js`.
   ========================================================================== */

import { useMemo } from 'react'
import { aplicarEscalon, normalizarEscalon } from '../core/compra.js'
import { calcularRecinto } from './useCalculo.js'

/**
 * @typedef {Object} AporteDeRecinto
 * @property {string} recintoId
 * @property {string} recintoNombre
 * @property {number} cantidadTeorica
 * @property {number} cantidadFinal
 * @property {number|null} subtotal
 * @property {string} nota            memoria de cálculo de esa línea
 */

/**
 * @typedef {Object} GrupoConsolidado
 * @property {string} id              clave de agrupación (materialId o clave+nombre)
 * @property {string|null} materialId
 * @property {string} clave           clave de línea del módulo, p. ej. 'cielo.plancha'
 * @property {string} nombre
 * @property {string} unidad
 * @property {number} cantidadTeorica suma de las teóricas, sin redondear
 * @property {number} cantidadSumada  suma de las finales ya redondeadas por recinto
 * @property {number} cantidadFinal   lo que se compra: `cantidadSumada` subida al
 *                                    escalón, o la misma cifra si no hay escalón
 * @property {{minimo:number,paso:number}|null} compra  escalón declarado por las líneas
 * @property {number|null} precioUnitario
 * @property {number|null} subtotal   null cuando ninguna línea del grupo tiene precio
 * @property {boolean} conPrecio
 * @property {AporteDeRecinto[]} detalle  para el desplegable de cada fila
 */

/**
 * @typedef {Object} RecintoOmitido
 * @property {string} recintoId
 * @property {string} nombre
 * @property {string} razon
 */

/**
 * @typedef {Object} Consolidado
 * @property {GrupoConsolidado[]} grupos
 * @property {number} totalConPrecio   suma de subtotales; solo líneas con precio
 * @property {number} lineasSinPrecio  cuántas líneas del consolidado quedaron sin precio
 * @property {RecintoOmitido[]} omitidos
 * @property {number} incluidos        recintos que aportaron material
 * @property {number} totalRecintos    recintos del proyecto
 */

/** Consolidado vacío. Misma forma siempre, para que la vista no defienda nada. */
const VACIO = {
  grupos: [],
  totalConPrecio: 0,
  lineasSinPrecio: 0,
  omitidos: [],
  incluidos: 0,
  totalRecintos: 0,
}

/**
 * @param {*} valor
 * @returns {number}
 */
function numero(valor) {
  const n = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(n) ? n : 0
}

/**
 * Razón por la que un recinto queda fuera. Se prefiere el aviso de error del
 * módulo, que ya viene redactado y nombra el problema y la salida.
 *
 * @param {{avisos:{nivel:string,mensaje:string}[]}} resultado
 * @returns {string}
 */
function razonDeOmision(resultado) {
  const avisos = Array.isArray(resultado.avisos) ? resultado.avisos : []
  const error = avisos.find((aviso) => aviso && aviso.nivel === 'error')
  if (error) return error.mensaje
  const cualquiera = avisos.find((aviso) => aviso && typeof aviso.mensaje === 'string')
  if (cualquiera) return cualquiera.mensaje
  return 'El módulo no entregó materiales para este recinto.'
}

/**
 * Clave de agrupación de una línea.
 * @param {{materialId:string|null,clave:string,nombre:string}} linea
 * @returns {string}
 */
function claveDeGrupo(linea) {
  if (typeof linea.materialId === 'string' && linea.materialId) return linea.materialId
  return `${linea.clave || 'linea'}::${linea.nombre || ''}`
}

/**
 * Arma el consolidado. Función pura, para poder usarla fuera de React.
 *
 * @param {Object|null|undefined} proyecto
 * @param {Array} [biblioteca]
 * @returns {Consolidado}
 */
export function consolidarProyecto(proyecto, biblioteca) {
  const recintos =
    proyecto && Array.isArray(proyecto.recintos) ? proyecto.recintos : []
  if (recintos.length === 0) return VACIO

  const materiales = Array.isArray(biblioteca) ? biblioteca : []

  /** @type {Map<string,GrupoConsolidado>} conserva el orden de primera aparición */
  const grupos = new Map()
  /** @type {RecintoOmitido[]} */
  const omitidos = []
  let incluidos = 0

  for (const recinto of recintos) {
    const { resultado } = calcularRecinto(recinto, materiales)

    if (!resultado.calculable || resultado.lineas.length === 0) {
      omitidos.push({
        recintoId: recinto.id,
        nombre: recinto.nombre,
        razon: razonDeOmision(resultado),
      })
      continue
    }

    incluidos += 1

    for (const linea of resultado.lineas) {
      const id = claveDeGrupo(linea)
      let grupo = grupos.get(id)
      if (!grupo) {
        grupo = {
          id,
          materialId: typeof linea.materialId === 'string' ? linea.materialId : null,
          clave: linea.clave,
          nombre: linea.nombre,
          unidad: linea.unidad,
          cantidadTeorica: 0,
          cantidadSumada: 0,
          cantidadFinal: 0,
          compra: null,
          precioUnitario: null,
          subtotal: null,
          conPrecio: false,
          detalle: [],
        }
        grupos.set(id, grupo)
      }

      grupo.cantidadTeorica += numero(linea.cantidadTeorica)
      grupo.cantidadSumada += numero(linea.cantidadFinal)

      // El escalón es del material, así que todas las líneas del grupo declaran
      // el mismo. Se toma el primero válido y no se comparan entre sí: si un día
      // difirieran, el desacuerdo sería un error del módulo y no algo que esta
      // función pueda arbitrar sin inventar una regla.
      if (grupo.compra === null) grupo.compra = normalizarEscalon(linea.compra)

      if (grupo.precioUnitario === null && typeof linea.precioUnitario === 'number') {
        grupo.precioUnitario = linea.precioUnitario
      }
      if (typeof linea.subtotal === 'number') {
        grupo.subtotal = numero(grupo.subtotal) + linea.subtotal
        grupo.conPrecio = true
      }

      grupo.detalle.push({
        recintoId: recinto.id,
        recintoNombre: recinto.nombre,
        cantidadTeorica: numero(linea.cantidadTeorica),
        cantidadFinal: numero(linea.cantidadFinal),
        subtotal: typeof linea.subtotal === 'number' ? linea.subtotal : null,
        nota: typeof linea.nota === 'string' ? linea.nota : '',
      })
    }
  }

  const lista = [...grupos.values()]
  let totalConPrecio = 0
  let lineasSinPrecio = 0
  for (const grupo of lista) {
    // El escalón entra recién acá, con todos los recintos ya sumados: es el
    // único momento del cálculo en que existe la cantidad que de verdad se va a
    // pedir en la ferretería.
    grupo.cantidadFinal = aplicarEscalon(grupo.cantidadSumada, grupo.compra)

    // Y el costo se cobra sobre lo que se compra. Sumar los subtotales de cada
    // recinto dejaría la boleta debajo de la cantidad que la fila de arriba pide,
    // que es la clase de diferencia que aparece cuando ya se pagó.
    if (grupo.conPrecio && grupo.precioUnitario !== null) {
      grupo.subtotal = grupo.precioUnitario * grupo.cantidadFinal
    }

    if (grupo.conPrecio) totalConPrecio += numero(grupo.subtotal)
    else lineasSinPrecio += 1
  }

  return {
    grupos: lista,
    totalConPrecio,
    lineasSinPrecio,
    omitidos,
    incluidos,
    totalRecintos: recintos.length,
  }
}

/**
 * Hook memoizado del consolidado del proyecto.
 *
 * La biblioteca llega por parámetro, igual que en `useCalculo`, para que este
 * archivo no dependa del contexto de la aplicación.
 *
 * @param {Object|null|undefined} proyecto
 * @param {Array} [biblioteca]
 * @returns {Consolidado}
 */
export function useConsolidado(proyecto, biblioteca) {
  return useMemo(() => consolidarProyecto(proyecto, biblioteca), [proyecto, biblioteca])
}

export default useConsolidado
