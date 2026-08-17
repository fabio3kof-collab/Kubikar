/* =============================================================================
   Kubikar · aviso de almacenamiento
   -----------------------------------------------------------------------------
   Banda persistente que aparece cuando el navegador no pudo guardar o no pudo
   leer. Es el único lugar del producto donde se habla del almacenamiento, y
   existe por una razón concreta: una falla de guardado no puede convertirse en
   trabajo perdido.

   Por eso el aviso hace dos cosas y no una. Nombra el problema según su tipo
   (cuota agotada, falla de escritura, falla de lectura) y ofrece la salida que
   sí funciona aunque el almacenamiento esté caído: exportar el proyecto a JSON.
   El estado en memoria queda intacto, así que lo que está en pantalla se puede
   sacar completo en un archivo.

   Va con `role="alert"`: lo pone el nivel `error` de `Aviso`, que es el único
   nivel que interrumpe al lector de pantalla. Acá esa interrupción está
   justificada, porque el usuario puede estar a punto de cerrar la pestaña.

   La banda es PERSISTENTE y no lleva cierre: se retira sola cuando el trabajo
   ya quedó en disco, que es al exportar. Ese es el punto entero del aviso.
   ============================================================================ */

import { FileJson } from 'lucide-react'

import { descargarJsonDeProyecto } from '../export/descargar.js'
import { useApp } from '../state/AppState.jsx'
import { Aviso, Boton } from '../ui/index.js'

/**
 * Nombre del problema por tipo de falla.
 * @type {Record<string,string>}
 */
const TITULOS = {
  cuota: 'Cuota de almacenamiento agotada',
  escritura: 'Falla al guardar en este navegador',
  lectura: 'Falla al leer los datos guardados',
}

/**
 * Banda de falla de almacenamiento.
 */
export function AvisoAlmacenamiento() {
  const { estado, acciones } = useApp()

  const aviso = estado.avisoAlmacenamiento
  if (!aviso) return null

  const titulo = TITULOS[aviso.tipo] || TITULOS.escritura

  function exportar() {
    const listo = acciones.proyectoConResultados()
    if (!listo) return
    descargarJsonDeProyecto(listo, estado.biblioteca)
    // Con el archivo ya en el disco el trabajo está a salvo: la banda se
    // retira. Si vuelve a fallar el guardado, vuelve a aparecer.
    acciones.descartarAviso()
  }

  return (
    <Aviso
      nivel="error"
      titulo={titulo}
      // Sin cierre a mano. Una banda que se puede descartar sin exportar deja
      // al usuario trabajando en la creencia de que se está guardando, que es
      // exactamente la pérdida de trabajo que este aviso existe para evitar.
      // La única salida de la banda es sacar el JSON.
      className="border-b"
      acciones={
        estado.proyecto ? (
          <Boton variante="primaria" tamano="sm" icono={FileJson} onClick={exportar}>
            Exportar proyecto a JSON
          </Boton>
        ) : null
      }
    >
      {aviso.mensaje}
    </Aviso>
  )
}

export default AvisoAlmacenamiento
