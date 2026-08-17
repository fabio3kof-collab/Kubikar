/* =============================================================================
   Kubikar · barra de herramientas del lienzo
   -----------------------------------------------------------------------------
   Vive dentro de la zona central, arriba a la izquierda del lienzo, y no sabe
   dibujar: recibe el estado del trazado y devuelve intenciones. Todo el manejo
   del puntero, del zoom y del encuadre queda en `Lienzo.jsx`.

   Dos gramáticas conviven acá y son distintas a propósito:

     · Los DETENTES son las herramientas del dibujo. Imán y ortogonal son
       interruptores sostenidos y llevan `data-state`; ajustar vista, deshacer,
       rehacer y limpiar son pulsaciones que no quedan encendidas.
     · El BOTÓN PRIMARIO es la única acción que cierra el trabajo: "Cerrar
       polígono". Cuando está deshabilitado la razón se imprime al lado, no en
       un globo que hay que descubrir con el puntero.

   LA BARRA NO FLOTA SOBRE EL PAPEL. Tiene su propia franja, con filete abajo,
   arriba del lienzo. Apilada encima, con seis detentes, tres reglas, un campo y
   el botón primario, se envolvía en dos o tres filas y tapaba una banda de 120
   píxeles de la esquina superior izquierda del dibujo: los clics de esa zona no
   marcaban vértices, que es lo único que el lienzo tiene que hacer.

   El grupo primario va con `ml-auto`, así que es lo ÚLTIMO que se envuelve
   cuando falta ancho. En puntero grueso se retira de la franja y baja al pie
   del lienzo (`AccionCerrar`, montada por `Lienzo.jsx`), al alcance del pulgar.

   El paso de grilla se escribe en la UNIDAD ACTIVA y se publica en milímetros:
   la grilla es una distancia física del recinto, no una medida de pantalla.
   ============================================================================ */

import { useId } from 'react'
import {
  CornerUpRight,
  Eraser,
  Grid2x2,
  Magnet,
  Maximize,
  Pentagon,
  Redo2,
  Undo2,
} from 'lucide-react'

import { aMilimetros, aUnidad, obtenerUnidad } from '../core/units.js'
import { Boton, CampoNumero, Detente, Regla, Rotulo } from '../ui/index.js'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/**
 * @typedef {Object} PropsLienzoControles
 * @property {boolean}  imanGrilla
 * @property {(valor:boolean) => void} onImanGrilla
 * @property {boolean}  ortogonal
 * @property {(valor:boolean) => void} onOrtogonal
 * @property {boolean}  verDespiece
 * @property {(valor:boolean) => void} onVerDespiece
 * @property {boolean}  [hayDespiece]     el módulo del recinto tiene algo que dibujar
 * @property {() => void} onAjustarVista
 * @property {boolean}  puedeDeshacer
 * @property {() => void} onDeshacer
 * @property {boolean}  puedeRehacer
 * @property {() => void} onRehacer
 * @property {boolean}  puedeLimpiar
 * @property {() => void} onLimpiar
 * @property {number}   pasoGrillaMm      paso de grilla en milímetros
 * @property {(pasoMm:number) => void} onPasoGrilla
 * @property {string}   unidadActiva      'mm' | 'cm' | 'm'
 * @property {number}   totalVertices
 * @property {boolean}  cerrado
 * @property {() => void} onCerrarPoligono
 * @property {boolean}  [deshabilitado]   sin recinto activo no hay nada que dibujar
 * @property {string}   [className]
 */

/**
 * Razón por la que "Cerrar polígono" no se puede accionar todavía. Cadena vacía
 * cuando sí se puede.
 * @param {{cerrado:boolean, totalVertices:number}} estado
 * @returns {string}
 */
export function razonDeCierre({ cerrado, totalVertices }) {
  if (cerrado) return 'El polígono ya está cerrado.'
  if (totalVertices < 3) return 'Necesitas al menos 3 vértices.'
  return ''
}

/**
 * @typedef {Object} PropsAccionCerrar
 * @property {number}  totalVertices
 * @property {boolean} cerrado
 * @property {() => void} onCerrarPoligono
 * @property {boolean} [deshabilitado]
 * @property {string}  [className]
 */

/**
 * La acción que cierra el trabajo, con su razón impresa al lado. Vive en dos
 * sitios según el puntero —en la franja de herramientas con mouse, al pie del
 * lienzo con el dedo— y es la misma pieza en los dos, para que no se puedan
 * separar el botón y el motivo por el que está apagado.
 *
 * @param {PropsAccionCerrar} props
 */
export function AccionCerrar({
  totalVertices,
  cerrado,
  onCerrarPoligono,
  deshabilitado = false,
  className,
}) {
  const puedeCerrar = !deshabilitado && !cerrado && totalVertices >= 3
  const razon = razonDeCierre({ cerrado, totalVertices })

  return (
    <div className={cx('flex items-center gap-2', className)}>
      <Boton
        variante="primaria"
        tamano="sm"
        icono={Pentagon}
        deshabilitado={!puedeCerrar}
        onClick={onCerrarPoligono}
      >
        Cerrar polígono
      </Boton>
      {razon && !deshabilitado ? <span className="text-sm text-ink-3">{razon}</span> : null}
    </div>
  )
}

/**
 * Barra de herramientas del lienzo.
 * @param {PropsLienzoControles & Record<string, any>} props
 */
export function LienzoControles({
  imanGrilla,
  onImanGrilla,
  ortogonal,
  onOrtogonal,
  verDespiece,
  onVerDespiece,
  hayDespiece = false,
  onAjustarVista,
  puedeDeshacer,
  onDeshacer,
  puedeRehacer,
  onRehacer,
  puedeLimpiar,
  onLimpiar,
  pasoGrillaMm,
  onPasoGrilla,
  unidadActiva,
  totalVertices,
  cerrado,
  onCerrarPoligono,
  deshabilitado = false,
  className,
  ...resto
}) {
  const idAuto = useId()
  const idPaso = `paso-grilla-${idAuto}`

  const unidad = obtenerUnidad(unidadActiva)
  const pasoEnUnidad = aUnidad(pasoGrillaMm, unidad.id)
  // El salto de las flechas es una décima del paso por defecto de la unidad:
  // 10 mm, 1 cm, 0,1 m. Sale de la tabla de unidades, no de un número suelto.
  const saltoTeclado = unidad.pasoGrilla / 10
  const minimoEnUnidad = aUnidad(1, unidad.id)

  /**
   * @param {number|null} valor  paso escrito en la unidad activa
   */
  function alCambiarPaso(valor) {
    if (valor === null || !Number.isFinite(valor) || valor <= 0) return
    onPasoGrilla(aMilimetros(valor, unidad.id))
  }

  return (
    <div
      role="toolbar"
      aria-label="Herramientas del lienzo"
      aria-orientation="horizontal"
      className={cx(
        'flex w-full max-w-full flex-wrap items-center gap-1 border-b border-rule-strong bg-margin px-2 py-1',
        className,
      )}
      {...resto}
    >
      <Detente
        tamano="sm"
        icono={Magnet}
        activo={imanGrilla}
        deshabilitado={deshabilitado}
        onClick={() => onImanGrilla(!imanGrilla)}
        etiquetaAccesible="Imán a la grilla"
        title="Imán a la grilla"
      />
      <Detente
        tamano="sm"
        icono={CornerUpRight}
        activo={ortogonal}
        deshabilitado={deshabilitado}
        onClick={() => onOrtogonal(!ortogonal)}
        etiquetaAccesible="Modo ortogonal"
        title="Modo ortogonal: solo trazos horizontales y verticales"
      />

      <Regla orientacion="vertical" className="mx-1" />

      <Detente
        tamano="sm"
        icono={Maximize}
        onClick={onAjustarVista}
        etiquetaAccesible="Ajustar vista a la figura"
        title="Ajustar vista a la figura (tecla F)"
      />
      {/* Va con "ajustar vista" y no con imán y ortogonal: aquéllos cambian
          CÓMO SE DIBUJA, éste cambia QUÉ SE VE. Nunca se deshabilita cuando no
          hay nada que mostrar —parpadearía al cerrar y abrir el polígono, y un
          detente apagado sin motivo visible es un misterio—: el motivo se dice
          en el título y el interruptor sigue accionable. */}
      <Detente
        tamano="sm"
        icono={Grid2x2}
        activo={verDespiece}
        deshabilitado={deshabilitado}
        onClick={() => onVerDespiece(!verDespiece)}
        etiquetaAccesible="Ver el despiece en la planta"
        title={
          hayDespiece
            ? 'Ver el despiece: dibuja el reparto de material dentro de la planta'
            : 'Ver el despiece. Este recinto todavía no tiene nada que repartir: cierra el polígono y elige los materiales del módulo.'
        }
      />

      <Regla orientacion="vertical" className="mx-1" />

      {/* Deshacer, rehacer y limpiar viajan juntos: son un solo grupo de
          historial y se envuelven como uno, no de a uno. */}
      <div role="group" aria-label="Historial del dibujo" className="flex items-center gap-1">
        <Detente
          tamano="sm"
          icono={Undo2}
          deshabilitado={deshabilitado || !puedeDeshacer}
          onClick={onDeshacer}
          etiquetaAccesible="Deshacer"
          title="Deshacer (Ctrl+Z)"
        />
        <Detente
          tamano="sm"
          icono={Redo2}
          deshabilitado={deshabilitado || !puedeRehacer}
          onClick={onRehacer}
          etiquetaAccesible="Rehacer"
          title="Rehacer (Ctrl+Shift+Z)"
        />
        <Detente
          tamano="sm"
          icono={Eraser}
          deshabilitado={deshabilitado || !puedeLimpiar}
          onClick={onLimpiar}
          etiquetaAccesible="Limpiar dibujo"
          title="Limpiar dibujo"
        />
      </div>

      <Regla orientacion="vertical" className="mx-1" />

      <div className="flex items-center gap-2">
        <Rotulo htmlFor={idPaso} className="shrink-0">
          Grilla
        </Rotulo>
        <CampoNumero
          id={idPaso}
          tamano="sm"
          className="w-28"
          valor={pasoEnUnidad}
          onChange={alCambiarPaso}
          min={minimoEnUnidad}
          paso={saltoTeclado}
          decimales={unidad.decimales}
          sufijo={unidad.label}
          deshabilitado={deshabilitado}
          mensajeMin="El paso de grilla tiene que ser mayor que cero."
        />
      </div>

      {/* `ml-auto`: el grupo primario se pega a la derecha y es lo último que
          cede ancho. Con el dedo desaparece de acá y aparece al pie del lienzo. */}
      <AccionCerrar
        className="ml-auto pl-2 pointer-coarse:hidden"
        totalVertices={totalVertices}
        cerrado={cerrado}
        deshabilitado={deshabilitado}
        onCerrarPoligono={onCerrarPoligono}
      />
    </div>
  )
}

export default LienzoControles
