/* =============================================================================
   Kubikar · pestaña Resultados
   -----------------------------------------------------------------------------
   Acá termina el trabajo: la tabla de materiales en el bloque de medida y la
   memoria de cálculo colgando en el margen, encorchetada a su línea por el motor
   de reglado. Una cubicación que no se puede auditar no sirve para presentar a
   nadie, así que el número y la cuenta que lo produjo se leen juntos.

   Tres cosas que este archivo no hace, y no hacerlas es la decisión:

   1. NO INVENTA PRECIOS. Un material sin precio unitario deja las dos celdas de
      dinero VACÍAS, no en cero. Un cero es un precio; un vacío es un dato que
      falta, y son cosas distintas frente a un mandante.

   2. NO SUMA LO QUE NO TIENE PRECIO. El total junta únicamente las líneas con
      precio cargado, y al pie declara cuántas quedaron fuera. Un total que
      esconde tres líneas sin precio es un total falso.

   3. NO MUESTRA UNA TABLA VACÍA. Si el recinto no se puede cubicar, en lugar de
      la tabla va el motivo concreto —el que devolvió el módulo o el motor de
      cálculo— y la salida para resolverlo.

   El total del pie es el del RECINTO, y así está rotulado. El total del proyecto
   vive en el consolidado, que es el único lugar donde suma todos los recintos.

   DÓNDE SE MONTA. Esta pestaña no cabe en el margen derecho: el bloque de
   medida más el margen de anotación piden 560 píxeles y esa columna da 352. En
   el diseño amplio se monta en la zona central (ver `App.jsx`), que es la única
   pista con ancho para las siete columnas sin desplazamiento horizontal y para
   que el motor de reglado tenga canal donde trazar el corchete.

   LA CIFRA QUE SE COMPRA TIENE REGISTRO PROPIO. La columna Final va a 17px con
   su rótulo en rúbrica y un filete vertical que la separa: es el entregable del
   producto y no puede pesar lo mismo que la columna de desperdicio.
   ============================================================================ */

import { Fragment, useMemo } from 'react'
import { Library } from 'lucide-react'

import { useApp } from '../state/AppState.jsx'
import { useCalculo } from '../state/useCalculo.js'
import { formatearCLP, formatearCantidad, formatearNumero } from '../core/units.js'
import { Aparato } from '../ui/Aparato.jsx'
import { Aviso } from '../ui/Aviso.jsx'
import { Boton } from '../ui/Boton.jsx'
import { EstadoVacio } from '../ui/EstadoVacio.jsx'
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaFila,
  TablaPie,
  TablaTitulo,
} from '../ui/Tabla.jsx'

/** Columnas de la tabla de materiales, para el colspan del pie y de la nota. */
const COLUMNAS = 7

/**
 * Filete vertical que separa la cifra de cierre del resto de la fila. La cifra
 * que se compra tiene un registro propio en todo el producto: 17px con cifras
 * tabulares, rótulo en rúbrica y este filete a la izquierda.
 */
const CIERRE_DE_FILA = 'border-l border-rule-strong'

/**
 * Porcentaje de desperdicio con los decimales justos: 5 se lee "5", 2,5 se lee
 * "2,5". Rellenar con ceros una cifra que no los tiene ensucia la columna.
 * @param {number} pct
 * @returns {string}
 */
function porcentaje(pct) {
  const n = Number(pct)
  if (!Number.isFinite(n) || n === 0) return '0'
  const redondeado = Math.round(n * 100) / 100
  const fraccion = String(redondeado).split('.')[1] || ''
  return formatearNumero(redondeado, Math.min(2, fraccion.length))
}

/**
 * Celda de dinero. Vacía cuando no hay precio, con la razón disponible para
 * quien lee con lector de pantalla y sin nada impreso para quien lee la columna.
 *
 * Es la ÚNICA convención de dato ausente en dinero del producto, y por eso la
 * usa también el consolidado: un vacío que en una pantalla se imprime y en la
 * otra no obliga al usuario a reaprender la convención al cambiar de vista. La
 * declaración explícita se hace una sola vez, en la nota al pie.
 *
 * @param {{valor:number|null|undefined, razon?:string}} props
 */
export function Dinero({ valor, razon = 'Sin precio cargado' }) {
  const texto = formatearCLP(valor)
  if (texto === '') return <span className="sr-only">{razon}</span>
  return <>{texto}</>
}

/**
 * Tabla de materiales del recinto con su aparato de auditoría al margen.
 */
export function PestanaResultados() {
  const { estado, acciones, recinto } = useApp()
  const { resultado } = useCalculo(recinto, estado.biblioteca)

  const lineas = resultado.lineas
  const avisos = resultado.avisos

  const cuenta = useMemo(() => {
    let total = 0
    let conPrecio = 0
    let sinPrecio = 0
    for (const linea of lineas) {
      const subtotal = linea.subtotal
      if (typeof subtotal === 'number' && Number.isFinite(subtotal)) {
        total += subtotal
        conPrecio += 1
      } else {
        sinPrecio += 1
      }
    }
    return { total, conPrecio, sinPrecio }
  }, [lineas])

  const notas = useMemo(
    () =>
      lineas.map((linea) => ({
        id: linea.clave,
        titulo: linea.nombre,
        contenido: linea.nota,
      })),
    [lineas],
  )

  if (!recinto) return null

  // Cuando no hay nada que cubicar, el motivo concreto sube al estado vacío y se
  // saca de la lista de avisos: decirlo dos veces no lo hace más claro.
  const motivo = resultado.calculable
    ? null
    : avisos.find((aviso) => aviso.nivel === 'error') ||
      avisos.find((aviso) => aviso.nivel === 'info') ||
      avisos[0] ||
      null

  const avisosVisibles = motivo ? avisos.filter((aviso) => aviso !== motivo) : avisos

  return (
    <div className="flex w-full max-w-[72rem] flex-col gap-6">
      {avisosVisibles.map((aviso, indice) => (
        <Aviso key={`${aviso.nivel}-${indice}`} nivel={aviso.nivel}>
          {aviso.mensaje}
        </Aviso>
      ))}

      {!resultado.calculable ? (
        <EstadoVacio
          titulo="Este recinto todavía no se puede cubicar."
          descripcion={
            motivo
              ? motivo.mensaje
              : 'Falta información para calcular los materiales de este recinto.'
          }
          acciones={
            // Las dos salidas posibles, sin adivinar cuál es la que falta: o el
            // polígono no está listo, o el módulo y sus materiales no lo están.
            <>
              <Boton variante="primaria" onClick={() => acciones.cambiarPestana('geometria')}>
                Ir a Geometría
              </Boton>
              <Boton variante="secundaria" onClick={() => acciones.cambiarPestana('modulo')}>
                Ir a Módulo
              </Boton>
            </>
          }
          encuadrado
        />
      ) : (
        <>
          {/* El bloque pide 560 px de verdad: son siete columnas y la de Final
              lleva registro propio. Con el mínimo por defecto de 320 el margen
              se encendía igual y la tabla terminaba desplazándose en horizontal
              justo sobre la columna que se compra. Declarado el mínimo real, en
              el margen derecho la nota baja bajo su fila, y el margen lateral
              reglado aparece donde sí hay ancho: la vista de consolidado. */}
          <Aparato notas={notas} rotuloMargen="Memoria de cálculo" minimoBloque={560}>
            {({ margenActivo, propsFila }) => (
              <Tabla
                densidad="densa"
                aria-label="Materiales del recinto"
                className="border border-rule bg-block"
              >
                <TablaCabecera>
                  <tr>
                    <TablaTitulo>Material</TablaTitulo>
                    <TablaTitulo>Unidad</TablaTitulo>
                    <TablaTitulo numerica>Teórica</TablaTitulo>
                    <TablaTitulo numerica>Desp.</TablaTitulo>
                    {/* La columna que se compra: rúbrica en el rótulo y filete
                        vertical a la izquierda, para que se lea como el cierre
                        de la fila y no como una cifra intermedia más. */}
                    <TablaTitulo numerica className={CIERRE_DE_FILA}>
                      <span className="kb-label-rubric">Final</span>
                    </TablaTitulo>
                    <TablaTitulo numerica>Precio unit.</TablaTitulo>
                    <TablaTitulo numerica>Subtotal</TablaTitulo>
                  </tr>
                </TablaCabecera>

                <TablaCuerpo>
                  {lineas.map((linea) => (
                    <Fragment key={linea.clave}>
                      {/* Toda la fila se alinea por la línea de base: la cifra
                          de cierre va en otro registro y tiene que leerse sobre
                          la misma línea que las demás, no flotando más abajo. */}
                      <TablaFila {...propsFila(linea.clave)}>
                        <TablaCelda alineacion="base" className="min-w-32">
                          {linea.nombre}
                        </TablaCelda>
                        <TablaCelda alineacion="base" className="whitespace-nowrap text-ink-2">
                          {linea.unidad}
                        </TablaCelda>
                        <TablaCelda numerica alineacion="base" className="text-ink-2">
                          {formatearCantidad(linea.cantidadTeorica, 2)}
                        </TablaCelda>
                        <TablaCelda numerica alineacion="base" className="text-ink-2">
                          {porcentaje(linea.desperdicioPct)}
                          <span className="kb-label ml-1">%</span>
                        </TablaCelda>
                        <TablaCelda
                          numerica
                          alineacion="base"
                          registro="cifra"
                          className={`${CIERRE_DE_FILA} text-ink`}
                        >
                          {formatearCantidad(linea.cantidadFinal, 0)}
                        </TablaCelda>
                        <TablaCelda numerica alineacion="base" className="text-ink-2">
                          <Dinero valor={linea.precioUnitario} />
                        </TablaCelda>
                        <TablaCelda numerica alineacion="base">
                          <Dinero valor={linea.subtotal} />
                        </TablaCelda>
                      </TablaFila>

                      {/* Sin margen, la nota vuelve al flujo bajo su propia fila:
                          la memoria de cálculo no se pierde, cambia de sitio. */}
                      {!margenActivo ? (
                        <tr>
                          <TablaCelda colSpan={COLUMNAS} className="bg-margin">
                            <p className="kb-prose border-l border-rule pl-3 text-sm">
                              {linea.nota}
                            </p>
                          </TablaCelda>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </TablaCuerpo>

                <TablaPie>
                  <tr>
                    <TablaCelda
                      colSpan={COLUMNAS - 1}
                      alineacion="base"
                      className="border-t border-rule-strong bg-margin"
                    >
                      <span className="kb-label kb-label-strong">Total del recinto</span>
                    </TablaCelda>
                    {/* El filete de cierre no baja al pie: acá la fila cambia de
                        rol y el corte lo hace la regla horizontal. Lo que se
                        conserva es el registro de la cifra. */}
                    <TablaCelda
                      numerica
                      alineacion="base"
                      registro="cifra"
                      className="border-t border-rule-strong bg-margin text-ink"
                    >
                      <Dinero
                        valor={cuenta.conPrecio > 0 ? cuenta.total : null}
                        razon="Ninguna línea tiene precio cargado"
                      />
                    </TablaCelda>
                  </tr>
                </TablaPie>
              </Tabla>
            )}
          </Aparato>

          {cuenta.sinPrecio > 0 ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-ink-3">
                {cuenta.sinPrecio === 1
                  ? '1 línea quedó sin precio unitario y no entra en el total.'
                  : `${formatearNumero(cuenta.sinPrecio, 0)} líneas quedaron sin precio unitario y no entran en el total.`}
              </p>
              <Boton
                variante="secundaria"
                tamano="sm"
                icono={Library}
                onClick={() => acciones.cambiarVista('biblioteca')}
              >
                Cargar precios en la Biblioteca
              </Boton>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default PestanaResultados
