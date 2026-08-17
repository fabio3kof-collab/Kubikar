/* =============================================================================
   Kubikar · módulos anunciados
   -----------------------------------------------------------------------------
   Estos módulos ya existen en el registro para que el selector muestre el
   camino del producto, pero todavía no cubican: van con disponible:false y la
   interfaz los dibuja deshabilitados con la leyenda "Próximamente".

   Cuando a uno le llegue su turno, se le escribe su esquema y su calcular en su
   propio archivo, se sube disponible a true y no hay que tocar ni un componente
   de interfaz: el contrato de src/modules/registry.js hace el resto.
   ========================================================================== */

/** @typedef {import('./registry.js').ModuloCalculo} ModuloCalculo */
/** @typedef {import('./registry.js').ResultadoCalculo} ResultadoCalculo */

/**
 * Respuesta de todo módulo que aún no cubica.
 * @returns {ResultadoCalculo}
 */
function sinCalculo() {
  return { lineas: [], avisos: [], calculable: false }
}

/**
 * Crea el módulo anunciado con la forma completa del contrato.
 *
 * @param {string} id
 * @param {string} nombre
 * @param {string} descripcion
 * @returns {ModuloCalculo}
 */
function moduloAnunciado(id, nombre, descripcion) {
  return {
    id,
    nombre,
    descripcion,
    disponible: false,
    esquema: [],
    calcular: sinCalculo,
  }
}

/** @type {ModuloCalculo} */
export const tabiqueria = moduloAnunciado(
  'tabiqueria',
  'Tabiquería',
  'Tabiques de volcanita: planchas por cara, montantes, soleras y tornillos.',
)

/** @type {ModuloCalculo} */
export const pisos = moduloAnunciado(
  'pisos',
  'Pisos',
  'Pisos y radier: palmetas, piso flotante, adhesivo y guardapolvo.',
)

/** @type {ModuloCalculo} */
export const pintura = moduloAnunciado(
  'pintura',
  'Pintura',
  'Pintura de cielo y muros: manos, rendimiento por galón y superficie neta.',
)

/** @type {ModuloCalculo} */
export const ceramicos = moduloAnunciado(
  'ceramicos',
  'Cerámicos',
  'Revestimiento cerámico: palmetas, adhesivo, fragüe y perfiles de canto.',
)

/**
 * Los cuatro módulos anunciados, en el orden en que se muestran.
 * @type {ModuloCalculo[]}
 */
export const modulosProximamente = [tabiqueria, pisos, pintura, ceramicos]

export default modulosProximamente
