/* =============================================================================
   Kubikar · panel derecho
   -----------------------------------------------------------------------------
   El riel y su aparato. Una franja de un filete con tres detentes cuadrados, y
   al lado el contenido de la pestaña activa.

   El riel es una lista de pestañas de verdad, no tres botones que cambian una
   variable: `role="tablist"` con `role="tab"`, `aria-selected`, `aria-controls`
   y foco itinerante. Se recorre con las cuatro flechas y con Inicio y Fin, y una
   sola pestaña queda en el orden de tabulación, que es lo que espera cualquiera
   que navegue sin mouse.

   El corte del riel: geometría y módulo son ENTRADA, resultados es SALIDA. Ahí
   cambia el pie de la lectura y ahí va la regla que separa los detentes.

   El rótulo de la pestaña activa no cabe en 40 píxeles de riel, así que vive
   arriba del contenido: el detente lleva el icono y su nombre accesible, y el
   encabezado del panel dice en qué pestaña se está parado.

   DÓNDE SE MONTA EL CUERPO. Geometría y Módulo son ENTRADA y acompañan al
   dibujo: viven en el margen de aparato, pegados al lienzo. Resultados es la
   SALIDA y necesita ancho de verdad —el bloque de medida más su margen de
   anotación no caben en 384 píxeles—, así que en el diseño amplio su cuerpo se
   monta en la zona central y acá queda solo el riel (`sinCuerpo`). El riel no
   se mueve nunca: es la navegación permanente del aparato, y por eso la wiring
   de `aria-controls` se resuelve con una marca compartida en vez de un `useId`
   privado.

   EL DETENTE DE RESULTADOS DECLARA SU ESTADO. Si el módulo devolvió avisos de
   error con el polígono ya cerrado —falta un material, la separación quedó en
   cero—, el detente lo dice con una escuadra de registro en su esquina y con el
   conteo en su nombre accesible. Sin eso, quien está ajustando parámetros en
   Módulo no tiene ninguna señal de que su cubicación está incompleta.
   ============================================================================ */

import { Fragment, useRef } from 'react'
import { Calculator, Plus, Ruler, SlidersHorizontal } from 'lucide-react'

import { useApp } from '../state/AppState.jsx'
import { useCalculo } from '../state/useCalculo.js'
import { Boton } from '../ui/Boton.jsx'
import { Detente } from '../ui/Detente.jsx'
import { EstadoVacio } from '../ui/EstadoVacio.jsx'
import { Regla } from '../ui/Regla.jsx'
import { Rotulo } from '../ui/Rotulo.jsx'
import { PestanaGeometria } from './PestanaGeometria.jsx'
import { PestanaModulo } from './PestanaModulo.jsx'
import { PestanaResultados } from './PestanaResultados.jsx'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/**
 * Marca compartida de los identificadores del aparato. Solo se monta un riel a
 * la vez —o la columna, o la lámina inferior—, así que la marca puede ser una
 * constante y el cuerpo montado en otra zona puede componer el mismo id.
 */
const MARCA_APARATO = 'aparato'

/** @param {string} pestanaId @returns {string} */
export function idPestana(pestanaId) {
  return `pestana-${pestanaId}-${MARCA_APARATO}`
}

/** @param {string} pestanaId @returns {string} */
export function idPanel(pestanaId) {
  return `panel-${pestanaId}-${MARCA_APARATO}`
}

/**
 * Las tres pestañas del aparato. `corteAntes` marca dónde se parte el riel:
 * entre lo que se ingresa y lo que se obtiene.
 * @type {{id:'geometria'|'modulo'|'resultados', nombre:string, icono:*, corteAntes?:boolean}[]}
 */
const PESTANAS = [
  { id: 'geometria', nombre: 'Geometría', icono: Ruler },
  { id: 'modulo', nombre: 'Módulo', icono: SlidersHorizontal },
  { id: 'resultados', nombre: 'Resultados', icono: Calculator, corteAntes: true },
]

/** Contenido de cada pestaña. Ninguna otra parte del panel las conoce por nombre. */
const CONTENIDOS = {
  geometria: PestanaGeometria,
  modulo: PestanaModulo,
  resultados: PestanaResultados,
}

/**
 * Definición de una pestaña por id, con respaldo en la primera.
 * @param {string} id
 * @returns {{id:string,nombre:string,icono:*,corteAntes?:boolean}}
 */
function definicionDe(id) {
  return PESTANAS.find((pestana) => pestana.id === id) || PESTANAS[0]
}

/**
 * Cuerpo del aparato: el encabezado que dice dónde se está parado y el
 * contenido de la pestaña, o el estado vacío cuando no hay recinto activo.
 *
 * Se exporta porque el cuerpo de Resultados no siempre se monta acá: en el
 * diseño amplio vive en la zona central, y las dos presentaciones tienen que
 * ser exactamente la misma pieza.
 *
 * @param {{pestana:string, className?:string}} props
 */
export function CuerpoAparato({ pestana, className }) {
  const { estado, acciones, recinto } = useApp()
  const definicion = definicionDe(pestana)
  const Contenido = CONTENIDOS[definicion.id]

  return (
    <div className={cx('flex min-h-0 min-w-0 flex-1 flex-col', className)}>
      <div className="flex shrink-0 flex-col gap-1 px-4 pt-4">
        <Rotulo tinta="fuerte" como="h2">
          {definicion.nombre}
        </Rotulo>
        <Regla tono="fuerte" />
      </div>

      <div className="flex-1 px-4 pt-4 pb-8">
        {recinto ? (
          <Contenido />
        ) : (
          <EstadoVacio
            titulo="No hay un recinto activo."
            descripcion={
              estado.proyecto
                ? 'Selecciona un recinto en la clave del margen izquierdo, o agrega uno nuevo para dibujar su polígono y cubicarlo.'
                : 'Abre o crea un proyecto para empezar a cubicar recintos.'
            }
            acciones={
              estado.proyecto ? (
                <Boton variante="primaria" icono={Plus} onClick={() => acciones.agregarRecinto()}>
                  Agregar recinto
                </Boton>
              ) : null
            }
          />
        )}
      </div>
    </div>
  )
}

/**
 * @typedef {Object} PropsPanelDerecho
 * @property {'vertical'|'horizontal'} [orientacion]  el riel pasa a tira horizontal
 *                                                    en la lámina inferior angosta
 * @property {boolean} [sinCuerpo]   el cuerpo de la pestaña activa se monta fuera
 * @property {string} [className]
 */

/**
 * Riel de pestañas y aparato del recinto activo.
 * @param {PropsPanelDerecho} props
 */
export function PanelDerecho({ orientacion = 'vertical', sinCuerpo = false, className }) {
  const { estado, recinto, acciones } = useApp()
  const { resultado } = useCalculo(recinto, estado.biblioteca)
  const rielRef = useRef(/** @type {HTMLDivElement|null} */ (null))

  const vertical = orientacion !== 'horizontal'
  const activa = estado.pestana
  const indiceActivo = Math.max(
    0,
    PESTANAS.findIndex((pestana) => pestana.id === activa),
  )
  const definicion = PESTANAS[indiceActivo]

  // Problemas del cálculo del recinto activo. Solo cuentan los errores: una
  // advertencia de polígono cruzado no impide comprar el material.
  const problemas = recinto
    ? resultado.avisos.filter((aviso) => aviso && aviso.nivel === 'error').length
    : 0

  /**
   * Mueve el foco y activa la pestaña. La activación automática es la que
   * corresponde acá: las tres pestañas son baratas de mostrar y el usuario no
   * tiene que confirmar con Enter cada paso.
   * @param {number} indice
   */
  function irA(indice) {
    const total = PESTANAS.length
    const destino = ((indice % total) + total) % total
    acciones.cambiarPestana(PESTANAS[destino].id)
    // El foco se busca en el riel ya montado en vez de guardar una referencia
    // por detente: los tres botones existen siempre y el orden del documento es
    // el mismo que el del arreglo.
    const riel = rielRef.current
    if (!riel) return
    const botones = riel.querySelectorAll('[role="tab"]')
    const boton = botones[destino]
    if (boton && typeof boton.focus === 'function') boton.focus()
  }

  /**
   * @param {import('react').KeyboardEvent<HTMLButtonElement>} evento
   * @param {number} indice
   */
  function alTeclear(evento, indice) {
    // Las cuatro flechas recorren el riel, sea cual sea su orientación: quien
    // navega con teclado no debería tener que adivinar en qué eje está puesto.
    switch (evento.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        evento.preventDefault()
        irA(indice + 1)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        evento.preventDefault()
        irA(indice - 1)
        break
      case 'Home':
        evento.preventDefault()
        irA(0)
        break
      case 'End':
        evento.preventDefault()
        irA(PESTANAS.length - 1)
        break
      default:
        break
    }
  }

  return (
    <section
      aria-label="Aparato del recinto"
      className={cx(
        'flex h-full min-h-0 w-full bg-margin',
        vertical ? 'flex-row' : 'flex-col',
        className,
      )}
    >
      <div
        ref={rielRef}
        role="tablist"
        aria-label="Pestañas del aparato"
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        className={cx(
          // El riel es el neutro profundo del margen: es la superficie en reposo
          // sobre la que se apoya un detente.
          'flex shrink-0 items-center gap-2 border-rule bg-margin-deep px-1 py-2',
          vertical
            ? 'w-[var(--size-rail)] flex-col border-r pointer-coarse:w-[calc(var(--size-touch)_+_0.5rem)]'
            : 'h-[var(--size-rail)] w-full flex-row border-b pointer-coarse:h-[calc(var(--size-touch)_+_0.5rem)]',
        )}
      >
        {PESTANAS.map((pestana, indice) => {
          const seleccionada = pestana.id === definicion.id
          const marcada = pestana.id === 'resultados' && problemas > 0
          const cuenta = problemas === 1 ? '1 problema' : `${problemas} problemas`
          const nombre = marcada ? `${pestana.nombre}, ${cuenta}` : pestana.nombre

          return (
            <Fragment key={pestana.id}>
              {/* El corte del riel es tinta, no estructura: dentro de una lista
                  de pestañas no puede anunciarse como un elemento más. */}
              {pestana.corteAntes ? (
                <Regla
                  orientacion={vertical ? 'horizontal' : 'vertical'}
                  role="presentation"
                  aria-hidden="true"
                />
              ) : null}

              <Detente
                id={idPestana(pestana.id)}
                role="tab"
                // Solo se monta el panel activo, así que solo la pestaña activa
                // puede declarar que controla algo que existe en el documento.
                aria-controls={seleccionada ? idPanel(pestana.id) : undefined}
                tabIndex={seleccionada ? 0 : -1}
                marca="seleccion"
                tamano="sm"
                activo={seleccionada}
                icono={pestana.icono}
                etiquetaAccesible={nombre}
                title={nombre}
                aviso={marcada ? 'error' : null}
                onClick={() => acciones.cambiarPestana(pestana.id)}
                onKeyDown={(evento) => alTeclear(evento, indice)}
                className={cx('shrink-0', vertical ? 'w-full' : 'h-full')}
              />
            </Fragment>
          )
        })}
      </div>

      {sinCuerpo ? null : (
        <div
          role="tabpanel"
          id={idPanel(definicion.id)}
          aria-labelledby={idPestana(definicion.id)}
          tabIndex={0}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-margin"
        >
          <CuerpoAparato pestana={definicion.id} />
        </div>
      )}
    </section>
  )
}

export default PanelDerecho
