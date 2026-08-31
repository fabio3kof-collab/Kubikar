/* =============================================================================
   Kubikar · aviso de versión nueva
   -----------------------------------------------------------------------------
   Banda que aparece cuando en GitHub hay un Kubikar posterior al de esta copia.

   Existe por una razón de obra: el entregable es un `Kubikar.html` suelto que se
   copia a mano de un PC a otro, así que una copia vieja puede seguir cubicando
   con un cálculo corregido hace meses. Sin este aviso, eso se descubre cuando
   falta material en faena.

   ESTA BANDA SÍ SE CIERRA, al revés que `AvisoAlmacenamiento`. Aquella no lleva
   cierre porque descartarla sería seguir trabajando creyendo que se guarda, y
   eso es trabajo perdido. Una versión nueva no es una urgencia: se puede
   posponer, y posponerla no cuesta nada. El cierre guarda el número visto, así
   que la versión siguiente vuelve a avisar.

   EL AVISO NO PROMETE MÁS DE LO QUE PUEDE. Una página web no escribe sobre el
   archivo que la abrió, así que Kubikar no se actualiza solo. Lo dice con todas
   sus letras: baja el archivo nuevo a Descargas y el viejo se reemplaza a mano.
   Prometer una actualización automática que no ocurre es peor que no ofrecerla.
   ============================================================================ */

import { Download } from 'lucide-react'

import { VERSION_ACTUAL } from '../data/actualizaciones.js'
import { useActualizacion } from '../state/useActualizacion.js'
import { Aviso, Boton } from '../ui/index.js'

/**
 * Texto del botón según cómo va la descarga. El porcentaje solo aparece cuando
 * GitHub informó el tamaño; cross-origin no siempre viaja el `content-length`,
 * y un "0 %" congelado se lee como una descarga trabada.
 *
 * @param {'quieto'|'bajando'|'listo'|'falla'} descarga
 * @param {number|null} progreso
 * @returns {string}
 */
function textoDelBoton(descarga, progreso) {
  if (descarga === 'bajando') {
    return Number.isFinite(progreso) ? `Bajando ${progreso} %` : 'Bajando'
  }
  if (descarga === 'listo') return 'Descargado'
  if (descarga === 'falla') return 'Reintentar la descarga'
  return 'Descargar la versión nueva'
}

/**
 * Banda de versión nueva disponible.
 */
export function AvisoActualizacion() {
  const { manifiesto, descarga, progreso, descartar, descargar } = useActualizacion()

  if (!manifiesto) return null

  const listo = descarga === 'listo'

  return (
    <Aviso
      nivel="info"
      titulo={`Kubikar ${manifiesto.version} ya está publicado`}
      className="border-b"
      onCerrar={descartar}
      acciones={
        <Boton
          variante="primaria"
          tamano="sm"
          icono={Download}
          deshabilitado={descarga === 'bajando'}
          onClick={descargar}
        >
          {textoDelBoton(descarga, progreso)}
        </Boton>
      }
    >
      {listo ? (
        // Con el archivo ya en Descargas el aviso deja de hablar de la versión
        // y pasa a decir el único paso que queda, que lo da el usuario.
        <>
          Quedó en tu carpeta de Descargas. Cierra Kubikar y reemplaza con él el Kubikar.html que
          abres normalmente.
        </>
      ) : (
        <>
          {manifiesto.notas ? `${manifiesto.notas}. ` : null}
          Esta copia es la {VERSION_ACTUAL}. Kubikar no puede reemplazarse solo: baja el archivo
          nuevo y reemplaza con él el que abres.
          {descarga === 'falla' ? ' La descarga falló; revisa la conexión.' : null}
        </>
      )}
    </Aviso>
  )
}

export default AvisoActualizacion
