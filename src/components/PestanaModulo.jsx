/* =============================================================================
   Kubikar · pestaña Módulo
   -----------------------------------------------------------------------------
   El selector de módulo y el panel de parámetros. Este archivo NO contiene una
   sola condición sobre `moduloId` ni sobre ninguna clave de parámetro, y esa
   ausencia es la característica del producto: cuando entren Tabiquería, Pisos,
   Pintura o Cerámicos, este panel los dibuja solo.

   Lo que hace, de arriba abajo:
     · llena el selector con `listarModulos()`, que ya devuelve los disponibles
       primero; los anunciados quedan visibles y deshabilitados con la leyenda
       "Próximamente", porque esconder un módulo que existe es peor que mostrarlo
       apagado: el usuario necesita saber que viene;
     · recorre `esquemaVisible(modulo, parametros)`, que resuelve las cadenas de
       `dependeDe`, de modo que apagar un interruptor esconde lo que colgaba de
       él sin que este archivo sepa qué colgaba;
     · agrupa por la propiedad `grupo`, en el orden en que el módulo la declara,
       y entrega cada entrada a `ParametroCampo`.
   ============================================================================ */

import { useMemo } from 'react'

import { useApp } from '../state/AppState.jsx'
import { esquemaVisible, listarModulos, obtenerModulo } from '../modules/index.js'
import { Aviso } from '../ui/Aviso.jsx'
import { Regla } from '../ui/Regla.jsx'
import { Rotulo } from '../ui/Rotulo.jsx'
import { Selector } from '../ui/Selector.jsx'
import { ParametroCampo } from './ParametroCampo.jsx'

/** Leyenda de un módulo anunciado pero todavía no implementado. */
const LEYENDA_PROXIMAMENTE = 'Próximamente'

/**
 * Agrupa el esquema por la propiedad `grupo` conservando el orden de
 * declaración. Los parámetros sin grupo abren el panel, sin título.
 * @param {import('../modules/registry.js').EsquemaParametro[]} esquema
 * @returns {{nombre:string, parametros:Array}[]}
 */
function agruparEsquema(esquema) {
  /** @type {string[]} */
  const orden = []
  /** @type {Map<string, Array>} */
  const grupos = new Map()

  for (const parametro of esquema) {
    const nombre = typeof parametro.grupo === 'string' ? parametro.grupo.trim() : ''
    if (!grupos.has(nombre)) {
      grupos.set(nombre, [])
      orden.push(nombre)
    }
    grupos.get(nombre).push(parametro)
  }

  return orden.map((nombre) => ({ nombre, parametros: grupos.get(nombre) }))
}

/**
 * Selector de módulo y panel de parámetros genérico del recinto activo.
 */
export function PestanaModulo() {
  const { estado, acciones, recinto } = useApp()

  const modulos = useMemo(() => listarModulos(), [])
  const moduloId = recinto ? recinto.moduloId : null
  const modulo = moduloId ? obtenerModulo(moduloId) : null
  const parametros = recinto && recinto.parametros ? recinto.parametros : {}

  const grupos = useMemo(
    () => (modulo ? agruparEsquema(esquemaVisible(modulo, parametros)) : []),
    [modulo, parametros],
  )

  if (!recinto) return null

  const opciones = modulos.map((entrada) => ({
    valor: entrada.id,
    etiqueta: entrada.disponible ? entrada.nombre : `${entrada.nombre} · ${LEYENDA_PROXIMAMENTE}`,
    deshabilitada: !entrada.disponible,
  }))

  return (
    <div className="flex flex-col gap-6">
      <Selector
        etiqueta="Módulo de cálculo"
        valor={modulo ? modulo.id : null}
        opciones={opciones}
        placeholder="Selecciona un módulo"
        ayuda={modulo ? modulo.descripcion : undefined}
        onChange={(id) => acciones.cambiarModulo(id)}
      />

      {!modulo ? (
        <Aviso nivel="error" titulo="Módulo no disponible">
          {`Este recinto quedó apuntando al módulo "${String(moduloId)}", que no existe en esta versión. Elige uno de la lista para poder cubicarlo.`}
        </Aviso>
      ) : null}

      {modulo && !modulo.disponible ? (
        <Aviso nivel="info" titulo={LEYENDA_PROXIMAMENTE}>
          {`El módulo ${modulo.nombre} está anunciado y todavía no cubica. Mientras tanto puedes dibujar el recinto y cambiarlo al módulo Cielo para obtener materiales.`}
        </Aviso>
      ) : null}

      {grupos.map((grupo) => (
        <section key={grupo.nombre || '__general'} className="flex flex-col gap-3">
          {grupo.nombre ? (
            <div className="flex flex-col gap-1">
              <Rotulo tinta="fuerte" como="h3">
                {grupo.nombre}
              </Rotulo>
              <Regla />
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            {grupo.parametros.map((parametro) => (
              <ParametroCampo
                key={parametro.clave}
                parametro={parametro}
                valor={parametros[parametro.clave]}
                biblioteca={estado.biblioteca}
                onChange={(valor) => acciones.cambiarParametro(parametro.clave, valor)}
                onAbrirBiblioteca={() => acciones.cambiarVista('biblioteca')}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default PestanaModulo
