/* =============================================================================
   Kubikar · pestaña Geometría
   -----------------------------------------------------------------------------
   La tabla de vértices y la de segmentos son el otro modo de dibujar: lo que se
   marca con el mouse en el lienzo se puede corregir acá con la cifra exacta, que
   es como se trabaja cuando el plano ya tiene medidas.

   Tres reglas sostienen esta pestaña:

   1. LAS COORDENADAS Y LOS LARGOS VAN EN LA UNIDAD ACTIVA; el área y el
      perímetro NO. En obra la superficie se habla en metros cuadrados y el
      metraje en metros lineales, se esté dibujando en milímetros o en metros.
      Por eso `formatearArea` y `formatearLineal` no reciben la unidad activa: no
      la necesitan y no deben poder verse afectados por ella.

   2. CADA CELDA CONFIRMA, NO TECLEA. Editar una coordenada o fijar el largo de
      un segmento es un paso de deshacer. Si el campo despachara en cada tecla,
      escribir "1250" dejaría cuatro pasos en la pila y deshacer se volvería
      inútil. `CeldaNumerica` guarda un borrador y confirma al salir del campo o
      con Enter.

   3. SELECCIONAR UNA FILA SELECCIONA EN EL LIENZO. La tabla y el dibujo miran el
      mismo estado: `dibujo.verticeSel` y `dibujo.segmentoSel`.
   ============================================================================ */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

import { useApp } from '../state/AppState.jsx'
import { useCalculo } from '../state/useCalculo.js'
import { segmentos as segmentosDe } from '../core/geometry.js'
import {
  aMilimetros,
  aUnidad,
  formatearArea,
  formatearLineal,
  obtenerUnidad,
} from '../core/units.js'
import { Aviso } from '../ui/Aviso.jsx'
import { Boton } from '../ui/Boton.jsx'
import { CampoNumero } from '../ui/CampoNumero.jsx'
import { EstadoVacio } from '../ui/EstadoVacio.jsx'
import { Rotulo } from '../ui/Rotulo.jsx'
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaFila,
  TablaTitulo,
} from '../ui/Tabla.jsx'

/**
 * Correlativo impreso de un vértice o de un segmento: dos dígitos, igual que la
 * clave numerada del margen izquierdo.
 * @param {number} n
 * @returns {string}
 */
function correlativo(n) {
  return String(n).padStart(2, '0')
}

/**
 * Redondea a los decimales con que se muestra la unidad, para que el campo no
 * arrastre el ruido de coma flotante de la conversión desde milímetros.
 * @param {number} valor
 * @param {number} decimales
 * @returns {number}
 */
function redondear(valor, decimales) {
  const factor = 10 ** decimales
  return Math.round(valor * factor) / factor
}

/**
 * @typedef {Object} PropsCeldaNumerica
 * @property {number|null} valor          valor confirmado, en la unidad activa
 * @property {(valor:number) => void} onConfirmar
 * @property {number} [decimales]
 * @property {number} [paso]
 * @property {number} [min]
 * @property {string} [mensajeMin]
 * @property {string} [etiqueta]          nombre accesible del campo
 */

/**
 * Celda editable de una cifra de geometría.
 *
 * Mantiene un borrador propio y solo despacha al confirmar. El envoltorio
 * escucha `onBlur` —que en React viaja por `focusout` y sí burbujea— y Enter,
 * porque `CampoNumero` usa sus propios manejadores para normalizar el texto y no
 * se le pueden reemplazar desde afuera.
 *
 * @param {PropsCeldaNumerica} props
 */
function CeldaNumerica({ valor, onConfirmar, decimales, paso, min, mensajeMin, etiqueta }) {
  const [borrador, setBorrador] = useState(valor)
  const confirmadoRef = useRef(valor)

  // El valor puede cambiar por fuera: deshacer, arrastre en el lienzo, cambio de
  // unidad. El borrador sigue al modelo cuando eso pasa.
  useEffect(() => {
    confirmadoRef.current = valor
    setBorrador(valor)
  }, [valor])

  function confirmar() {
    const propuesta = borrador
    if (propuesta === null || propuesta === undefined || !Number.isFinite(propuesta)) {
      setBorrador(confirmadoRef.current)
      return
    }
    if (propuesta === confirmadoRef.current) return
    confirmadoRef.current = propuesta
    onConfirmar(propuesta)
  }

  return (
    <div
      onBlur={confirmar}
      onKeyDown={(evento) => {
        if (evento.key !== 'Enter') return
        evento.preventDefault()
        confirmar()
      }}
    >
      <CampoNumero
        tamano="sm"
        valor={borrador}
        onChange={setBorrador}
        decimales={decimales}
        paso={paso}
        min={min}
        mensajeMin={mensajeMin}
        aria-label={etiqueta}
      />
    </div>
  )
}

/**
 * Tabla de vértices, tabla de segmentos y las dos cifras que se leen en vivo.
 */
export function PestanaGeometria() {
  const { estado, acciones, recinto } = useApp()
  const { geometria } = useCalculo(recinto, estado.biblioteca)

  const unidad = obtenerUnidad(estado.unidadActiva)
  const vertices = geometria.vertices
  const cerrado = geometria.cerrado

  const tramos = useMemo(() => segmentosDe(vertices, cerrado), [vertices, cerrado])

  if (!recinto) return null

  const total = vertices.length
  // El largo mínimo representable en la unidad activa: un segmento no puede
  // medir cero y el campo debe decirlo con la cifra que corresponde a la unidad.
  const largoMinimo = 10 ** -unidad.decimales

  return (
    <div className="flex flex-col gap-6">
      {geometria.autoIntersectante ? (
        <Aviso nivel="advertencia" titulo="Polígono cruzado">
          El polígono se cruza a sí mismo. El área puede ser incorrecta. Revisa el orden de los
          vértices en la tabla o mueve el que quedó cruzado.
        </Aviso>
      ) : null}

      {/* --- las dos cifras que manda el producto ---------------------------- */}
      <div className="grid grid-cols-2 border border-rule bg-block">
        <div className="flex flex-col gap-1 border-r border-rule px-3 py-2">
          <Rotulo>Área</Rotulo>
          <p className="kb-num text-2xl text-ink">
            {cerrado ? formatearArea(geometria.areaMm2) : '—'}
            <span className="kb-label ml-1">m²</span>
          </p>
        </div>
        <div className="flex flex-col gap-1 px-3 py-2">
          <Rotulo>Perímetro</Rotulo>
          <p className="kb-num text-2xl text-ink">
            {formatearLineal(geometria.perimetroMm)}
            <span className="kb-label ml-1">ml</span>
          </p>
        </div>
      </div>

      {!cerrado ? (
        <p className="text-sm text-ink-3">
          El área se calcula al cerrar el polígono. Mientras tanto el perímetro suma solo los tramos
          ya dibujados.
        </p>
      ) : null}

      {/* --- vértices -------------------------------------------------------- */}
      {total === 0 ? (
        <EstadoVacio
          titulo="Este recinto todavía no tiene vértices."
          descripcion="Haz clic en la grilla del lienzo para marcar el primer vértice. Después puedes corregir cada coordenada acá con la medida exacta."
          encuadrado
        />
      ) : (
        <div className="flex flex-col gap-2">
          <Rotulo como="h3">{`Vértices · ${unidad.nombre}`}</Rotulo>

          <Tabla
            densidad="densa"
            aria-label={`Vértices del recinto, en ${unidad.nombre}`}
            className="border border-rule bg-block"
          >
            <TablaCabecera>
              <tr>
                <TablaTitulo numerica>N</TablaTitulo>
                <TablaTitulo numerica>X</TablaTitulo>
                <TablaTitulo numerica>Y</TablaTitulo>
                <TablaTitulo>
                  <span className="sr-only">Acciones del vértice</span>
                </TablaTitulo>
              </tr>
            </TablaCabecera>

            <TablaCuerpo>
              {vertices.map((vertice, indice) => (
                <TablaFila
                  key={vertice.id}
                  seleccionada={estado.dibujo.verticeSel === vertice.id}
                  onClick={() => acciones.seleccionarVertice(vertice.id)}
                >
                  <TablaCelda numerica alineacion="medio" className="w-10 text-ink-2">
                    {correlativo(indice + 1)}
                  </TablaCelda>

                  <TablaCelda className="w-2/5">
                    <CeldaNumerica
                      valor={redondear(aUnidad(vertice.x, unidad.id), unidad.decimales)}
                      decimales={unidad.decimales}
                      paso={unidad.pasoGrilla}
                      etiqueta={`Coordenada X del vértice ${indice + 1}, en ${unidad.nombre}`}
                      onConfirmar={(valor) =>
                        acciones.editarCoordenada(vertice.id, 'x', aMilimetros(valor, unidad.id))
                      }
                    />
                  </TablaCelda>

                  <TablaCelda className="w-2/5">
                    <CeldaNumerica
                      valor={redondear(aUnidad(vertice.y, unidad.id), unidad.decimales)}
                      decimales={unidad.decimales}
                      paso={unidad.pasoGrilla}
                      etiqueta={`Coordenada Y del vértice ${indice + 1}, en ${unidad.nombre}`}
                      onConfirmar={(valor) =>
                        acciones.editarCoordenada(vertice.id, 'y', aMilimetros(valor, unidad.id))
                      }
                    />
                  </TablaCelda>

                  <TablaCelda alineacion="medio">
                    <Boton
                      variante="fantasma"
                      tamano="sm"
                      soloIcono
                      icono={Trash2}
                      etiquetaAccesible={`Eliminar el vértice ${indice + 1}`}
                      onClick={(evento) => {
                        evento.stopPropagation()
                        acciones.eliminarVertice(vertice.id)
                      }}
                    />
                  </TablaCelda>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </div>
      )}

      {/* --- segmentos ------------------------------------------------------- */}
      {tramos.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Rotulo como="h3">{`Segmentos · ${unidad.nombre}`}</Rotulo>

          <Tabla
            densidad="densa"
            aria-label={`Segmentos del recinto, en ${unidad.nombre}`}
            className="border border-rule bg-block"
          >
            <TablaCabecera>
              <tr>
                <TablaTitulo numerica>N</TablaTitulo>
                <TablaTitulo>Tramo</TablaTitulo>
                <TablaTitulo numerica>Largo</TablaTitulo>
              </tr>
            </TablaCabecera>

            <TablaCuerpo>
              {tramos.map((tramo) => {
                const desde = tramo.indice + 1
                const hasta = ((tramo.indice + 1) % total) + 1
                return (
                  <TablaFila
                    key={tramo.indice}
                    seleccionada={estado.dibujo.segmentoSel === tramo.indice}
                    onClick={() => acciones.seleccionarSegmento(tramo.indice)}
                  >
                    <TablaCelda numerica alineacion="medio" className="w-10 text-ink-2">
                      {correlativo(desde)}
                    </TablaCelda>

                    <TablaCelda alineacion="medio" className="kb-num whitespace-nowrap text-ink-2">
                      {`${correlativo(desde)} → ${correlativo(hasta)}`}
                    </TablaCelda>

                    <TablaCelda className="w-2/5">
                      <CeldaNumerica
                        valor={redondear(aUnidad(tramo.largoMm, unidad.id), unidad.decimales)}
                        decimales={unidad.decimales}
                        paso={unidad.pasoGrilla}
                        min={largoMinimo}
                        mensajeMin="El largo de un segmento tiene que ser mayor que cero."
                        etiqueta={`Largo del segmento ${desde}, en ${unidad.nombre}`}
                        onConfirmar={(valor) =>
                          acciones.fijarLargoSegmento(tramo.indice, aMilimetros(valor, unidad.id))
                        }
                      />
                    </TablaCelda>
                  </TablaFila>
                )
              })}
            </TablaCuerpo>
          </Tabla>

          <p className="text-sm text-ink-3">
            Al fijar el largo de un segmento se mantiene fijo su primer vértice y se corre el
            segundo sobre la misma dirección.
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default PestanaGeometria
