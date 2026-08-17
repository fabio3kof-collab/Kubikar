/**
 * Kubikar · biblioteca precargada
 * -----------------------------------------------------------------------------
 * Materiales de uso corriente en obra chilena para cielo falso. Se siembran una
 * sola vez, cuando la biblioteca está vacía (ver `repo.inicializar`).
 *
 * NINGUNO trae precio: `precioUnitario` va en null a propósito. El precio es
 * dato de cada obra y de cada proveedor, y la interfaz muestra la celda vacía
 * en vez de inventar un $ 0. Cuando la biblioteca se sincronice con el maestro
 * de materiales de Karbec, el precio y el `codigoMaterial` llegarán de allá.
 *
 * Las medidas están en milímetros, la unidad base del producto.
 */

import { nuevoMaterial } from './schema.js'

/**
 * Definiciones estables de la semilla. Se mantienen sin `id` ni fechas: cada
 * siembra construye materiales frescos con `nuevoMaterial`.
 * @type {Array<Object>}
 */
export const DEFINICIONES_SEMILLA = [
  {
    tipo: 'plancha',
    nombre: 'Plancha yeso-cartón 1200 × 3000 mm',
    anchoMm: 1200,
    largoMm: 3000,
    espesorMm: 15,
    traslapoMm: 0,
    desperdicioPct: 5,
  },
  {
    tipo: 'plancha',
    nombre: 'Plancha yeso-cartón 1200 × 2400 mm',
    anchoMm: 1200,
    largoMm: 2400,
    espesorMm: 15,
    traslapoMm: 0,
    desperdicioPct: 5,
  },
  {
    tipo: 'plancha',
    nombre: 'Volcanita RH 1200 × 2400 mm',
    anchoMm: 1200,
    largoMm: 2400,
    espesorMm: 15,
    traslapoMm: 0,
    desperdicioPct: 5,
  },
  {
    tipo: 'barra',
    nombre: 'Perfil Omega 38 × 3000 mm, acero galvanizado',
    largoBarraMm: 3000,
    designacion: 'Omega 38x0,85 mm',
    desperdicioPct: 5,
  },
  {
    tipo: 'barra',
    nombre: 'Perfil Omega 38 × 6000 mm, acero galvanizado',
    largoBarraMm: 6000,
    designacion: 'Omega 38x0,85 mm',
    desperdicioPct: 5,
  },
  {
    tipo: 'barra',
    nombre: 'Ángulo perimetral 25 × 25 × 3000 mm',
    largoBarraMm: 3000,
    designacion: 'Ángulo 25x25x0,5 mm',
    desperdicioPct: 5,
  },
  {
    tipo: 'pieza',
    nombre: 'Tornillo autoperforante punta broca',
    consumo: 'por_m2',
  },
  {
    tipo: 'pieza',
    nombre: 'Alambre galvanizado #14',
    consumo: 'por_m2',
  },
]

/**
 * Construye una biblioteca nueva con ids y fechas frescas.
 * @returns {Array<Object>} materiales listos para guardar
 */
export function materialesSemilla() {
  return DEFINICIONES_SEMILLA.map((definicion) => {
    const material = nuevoMaterial(definicion.tipo)
    return {
      ...material,
      ...definicion,
      // El precio siempre queda vacío en la semilla.
      precioUnitario: null,
      // Previstos para Karbec, vacíos en esta versión.
      codigoMaterial: null,
      partida: null,
    }
  })
}
