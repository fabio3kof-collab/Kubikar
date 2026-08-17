/* =============================================================================
   Kubikar · sistema de interfaz
   -----------------------------------------------------------------------------
   Puerta única de las primitivas. Los componentes de producto importan desde
   acá (`import { Boton, Tabla } from '../ui/index.js'`) y no desde cada archivo
   suelto: así el sistema se puede reorganizar por dentro sin tocar una sola
   vista.

   Estas piezas no saben nada del dominio. No conocen recintos, ni materiales,
   ni módulos de cálculo: solo estados, rótulos y cifras. Toda regla de negocio
   vive en `core/`, `modules/` y `state/`.
   ============================================================================ */

export { Boton } from './Boton.jsx'
export { CampoNumero } from './CampoNumero.jsx'
export { CampoTexto, TAMANOS_CAMPO, contornoCampo } from './CampoTexto.jsx'
export { Selector } from './Selector.jsx'
export { Interruptor } from './Interruptor.jsx'
export {
  Tabla,
  TablaCabecera,
  TablaCuerpo,
  TablaPie,
  TablaFila,
  TablaTitulo,
  TablaCelda,
} from './Tabla.jsx'
export { Rotulo } from './Rotulo.jsx'
export { Regla } from './Regla.jsx'
export { Detente } from './Detente.jsx'
export { Aviso } from './Aviso.jsx'
export { EstadoVacio } from './EstadoVacio.jsx'
export { Dialogo } from './Dialogo.jsx'
export { Cruz } from './Cruz.jsx'
