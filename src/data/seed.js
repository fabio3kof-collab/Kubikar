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
    // El omega se empalma encajando un perfil dentro del otro: ese encaje
    // consume 15 cm que no avanzan corrida.
    traslapoMm: 150,
    retazoMinimoMm: 500,
    designacion: 'Omega 38x0,85 mm',
    desperdicioPct: 5,
  },
  {
    tipo: 'barra',
    nombre: 'Perfil Omega 38 × 6000 mm, acero galvanizado',
    largoBarraMm: 6000,
    traslapoMm: 150,
    retazoMinimoMm: 500,
    designacion: 'Omega 38x0,85 mm',
    desperdicioPct: 5,
  },
  {
    tipo: 'barra',
    nombre: 'Ángulo perimetral 25 × 25 × 3000 mm',
    largoBarraMm: 3000,
    // El ángulo se une a tope contra el muro siguiente: no hay encaje que
    // descontar.
    traslapoMm: 0,
    retazoMinimoMm: 500,
    designacion: 'Ángulo 25x25x0,5 mm',
    desperdicioPct: 5,
  },
  // Los dos tornillos de un cielo no son intercambiables y por eso van separados:
  // el punta fina rasga el yeso-cartón sin reventarlo y muerde la chapa delgada
  // del omega; el punta broca perfora los dos metales del encuentro y su cabeza
  // de lenteja queda plana para que la plancha apoye encima. Comprar uno creyendo
  // que sirve para lo otro es el error que este material precargado evita.
  {
    tipo: 'pieza',
    nombre: 'Tornillo drywall punta fina 6 × 1" (25 mm)',
    uso: 'fijacion_plancha',
  },
  {
    tipo: 'pieza',
    nombre: 'Tornillo punta broca cabeza lenteja 8 × ½" (13 mm)',
    uso: 'fijacion_metal',
  },
  {
    tipo: 'pieza',
    nombre: 'Alambre galvanizado #14',
    uso: 'colgante',
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
