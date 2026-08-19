/* =============================================================================
   Kubikar · registro de módulos
   -----------------------------------------------------------------------------
   ESTE ES EL ÚNICO LUGAR DONDE SE REGISTRA UN MÓDULO.

   Se importa una sola vez, por efecto lateral, al arrancar la aplicación
   (`import './modules/index.js'` en main.jsx). A partir de ahí toda la interfaz
   consulta el registro con listarModulos / obtenerModulo y nunca menciona un
   módulo por nombre.

   Para sumar un módulo nuevo: crear su archivo en esta carpeta y agregar acá su
   llamada a registrarModulo, en el orden en que debe aparecer en el selector.
   Dentro del selector los disponibles van primero; los anunciados quedan
   deshabilitados con la leyenda "Próximamente".
   ========================================================================== */

import { registrarModulo } from './registry.js'
import { cielo } from './cielo.js'
import { modulosProximamente } from './proximamente.js'

registrarModulo(cielo)
for (const modulo of modulosProximamente) {
  registrarModulo(modulo)
}

// Se reexporta el contrato para que el resto de la aplicación tenga una sola
// puerta de entrada: `import { listarModulos } from '../modules/index.js'`.
export {
  registrarModulo,
  obtenerModulo,
  listarModulos,
  parametrosPorDefecto,
  completarParametros,
  esquemaVisible,
  materialesDe,
} from './registry.js'

export { cielo } from './cielo.js'
export { modulosProximamente } from './proximamente.js'

/** Id del módulo que se asigna a un recinto nuevo. */
export const MODULO_POR_DEFECTO = 'cielo'
