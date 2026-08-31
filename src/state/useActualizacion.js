/* =============================================================================
   Kubikar · estado del aviso de versión
   -----------------------------------------------------------------------------
   Este gancho vive aparte de `AppState` a propósito. La versión publicada no es
   dato del proyecto: no se guarda con él, no entra en ningún cálculo y no
   sobrevive a la recarga. Meterla en el reductor la ataría al ciclo de
   persistencia del proyecto sin ganar nada.

   Lo único que sí persiste es el descarte, y persiste por la puerta de siempre
   (`repo`), nunca contra `localStorage`.

   Tres reglas que este archivo tiene que respetar:

   1. NADA DE ESTO PUEDE ROMPER EL ARRANQUE. `buscarActualizacion` no lanza, y
      la lectura y la escritura de la preferencia van envueltas: si el navegador
      no deja guardar, el aviso simplemente vuelve a aparecer la próxima vez.
      Kubikar arranca aunque GitHub no exista.

   2. SE DESCARTA UNA VERSIÓN, NO EL AVISO. Se guarda el número visto. Descartar
      la 0.2.0 no silencia la 0.3.0, que es el error que convierte un aviso de
      versión en un aviso que nadie vuelve a ver.

   3. EL CHEQUEO CORRE UNA VEZ, AL MONTAR. No hay reintento ni sondeo: la
      aplicación se abre muchas veces al día y el próximo arranque es el próximo
      chequeo.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  buscarActualizacion,
  descargarActualizacion,
  URL_DESCARGA,
} from '../data/actualizaciones.js'
import { repo } from '../data/repo.js'

/**
 * @typedef {Object} EstadoActualizacion
 * @property {import('../data/actualizaciones.js').Manifiesto|null} manifiesto
 *           la versión publicada cuando hay una posterior y sin descartar
 * @property {'quieto'|'bajando'|'listo'|'falla'} descarga
 * @property {number|null} progreso  0–100, o null si el servidor no informa tamaño
 * @property {() => void} descartar
 * @property {() => void} descargar
 */

/**
 * Chequea al montar si hay una versión publicada posterior a esta copia.
 *
 * @returns {EstadoActualizacion}
 */
export function useActualizacion() {
  const [manifiesto, setManifiesto] = useState(null)
  const [descarga, setDescarga] = useState('quieto')
  const [progreso, setProgreso] = useState(null)

  // El componente puede desmontarse mientras GitHub responde.
  const vivoRef = useRef(true)

  useEffect(() => {
    vivoRef.current = true

    async function chequear() {
      const resultado = await buscarActualizacion()
      if (!vivoRef.current || resultado.estado !== 'hay-nueva') return

      let descartada = null
      try {
        const preferencias = await repo.obtenerPreferencias()
        descartada = preferencias.versionDescartada
      } catch {
        // Sin preferencias legibles se avisa igual: mostrar de más es un aviso
        // repetido; mostrar de menos es una copia vieja que nadie corrige.
      }

      if (!vivoRef.current) return
      if (descartada && descartada === resultado.manifiesto.version) return
      setManifiesto(resultado.manifiesto)
    }

    chequear()
    return () => {
      vivoRef.current = false
    }
  }, [])

  const descartar = useCallback(() => {
    const version = manifiesto ? manifiesto.version : null
    setManifiesto(null)
    if (!version) return
    // Se retira de la pantalla enseguida y la escritura va sola: que el
    // almacenamiento esté caído no puede dejar una banda que no se cierra.
    repo.guardarPreferencias({ versionDescartada: version }).catch(() => {})
  }, [manifiesto])

  const descargar = useCallback(async () => {
    setDescarga('bajando')
    setProgreso(null)
    try {
      const url = manifiesto && manifiesto.url ? manifiesto.url : URL_DESCARGA
      await descargarActualizacion(url, (porcentaje) => {
        if (vivoRef.current) setProgreso(porcentaje)
      })
      if (vivoRef.current) setDescarga('listo')
    } catch {
      if (vivoRef.current) setDescarga('falla')
    }
  }, [manifiesto])

  return { manifiesto, descarga, progreso, descartar, descargar }
}

export default useActualizacion
