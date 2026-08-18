/* =============================================================================
   Kubikar · hoja de impresión
   -----------------------------------------------------------------------------
   El documento que sale por la impresora. Es un árbol propio, invisible en
   pantalla, que en impresión reemplaza a la aplicación entera: la razón está en
   `src/styles/impresion.css`, y es que la rejilla de la aplicación apoya su alto
   en contenedores con desplazamiento propio que en papel recortan el documento a
   una sola página.

   Dos diferencias deliberadas con la pantalla, las dos por la misma causa —en
   papel no hay margen de aparato medido ni motor de reglado—:

   1. La memoria de cálculo y la composición por recinto BAJAN AL FLUJO, bajo su
      fila. En pantalla cuelgan al costado encorchetadas; acá van debajo, que es
      donde una lámina de terreno las espera.
   2. No hay controles. Ningún botón, ningún desplegable, ninguna fila elegible:
      todo lo que en pantalla se abre, en papel ya está abierto.

   El resto del registro es el mismo: la cifra que se compra va en 17px con
   cifras tabulares, la cabecera de tabla en azul marino, el filete de un píxel.
   ============================================================================ */

import { formatearArea, formatearCLP, formatearLineal } from '../core/units.js'
import { useApp } from '../state/AppState.jsx'
import { useCalculo } from '../state/useCalculo.js'
import { useConsolidado } from '../state/useConsolidado.js'
import { obtenerModulo } from '../modules/registry.js'
import { PlantaImpresa } from './PlantaImpresa.jsx'
import { cantidadLegible, composicionDeGrupo, frasesDeOmision } from './VistaConsolidado.jsx'

/**
 * Fecha de impresión en formato chileno. Se lee del reloj al renderizar: la hoja
 * solo existe mientras se imprime, así que no hay estado que envejecer.
 * @returns {string}
 */
function fechaDeHoy() {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())
}

/**
 * Cabecera común de las dos hojas: quién firma el documento y de cuándo es.
 *
 * @param {Object} props
 * @param {string} props.proyecto
 * @param {string} props.titulo
 * @param {string} [props.detalle]
 */
function CabeceraHoja({ proyecto, titulo, detalle }) {
  return (
    <header className="kb-hoja-bloque mb-4 border-b border-rule-strong pb-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="kb-label kb-label-strong">Kubikar · Karbec</span>
        <span className="kb-label">{fechaDeHoy()}</span>
      </div>
      <h1 className="mt-1 text-xl text-ink">{titulo}</h1>
      <p className="text-base text-ink-2">
        {proyecto}
        {detalle ? ` · ${detalle}` : ''}
      </p>
    </header>
  )
}

/**
 * Cifra de dinero, o la raya del dato ausente. En papel no hay `title` que
 * consultar, así que la razón de la ausencia va una sola vez, en la nota al pie.
 * @param {{valor:number|null}} props
 */
function Peso({ valor }) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return <span className="text-ink-3">—</span>
  }
  return <>{formatearCLP(valor)}</>
}

/* -----------------------------------------------------------------------------
   Consolidado
   -------------------------------------------------------------------------- */

/**
 * Lista de compra del proyecto.
 * @param {{proyecto:Object, biblioteca:Array}} props
 */
function HojaConsolidado({ proyecto, biblioteca }) {
  const consolidado = useConsolidado(proyecto, biblioteca)
  const { grupos, omitidos, incluidos, totalRecintos, totalConPrecio, lineasSinPrecio } =
    consolidado
  const frases = frasesDeOmision(omitidos)
  const hayPrecio = grupos.some((grupo) => grupo.conPrecio)

  return (
    <>
      <CabeceraHoja
        proyecto={proyecto.nombre}
        titulo="Consolidado de materiales"
        detalle={`${incluidos} de ${totalRecintos} ${totalRecintos === 1 ? 'recinto cubicado' : 'recintos cubicados'}`}
      />

      {/* Lo que quedó fuera se lee ANTES de mirar una sola cifra, igual que en
          pantalla: un cero silencioso en una cubicación se paga en terreno. */}
      {frases.length > 0 ? (
        <div className="kb-hoja-bloque mb-4 border-l border-warn bg-warn-soft px-3 py-2">
          <p className="kb-label mb-1">Recintos fuera del consolidado</p>
          <ul className="flex flex-col gap-1 text-sm text-ink">
            {frases.map((frase) => (
              <li key={frase}>{frase}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {grupos.length === 0 ? (
        <p className="kb-prose">
          Ningún recinto de este proyecto entregó material. Arriba está el motivo de cada uno.
        </p>
      ) : (
        <table className="w-full border border-rule text-left">
          <thead>
            <tr className="bg-navy-soft text-navy-ink">
              <th className="kb-label border-b border-rule-strong px-2 py-1">Material</th>
              <th className="kb-label border-b border-rule-strong px-2 py-1">Unidad</th>
              <th className="kb-label border-b border-rule-strong px-2 py-1 text-right">
                Cantidad
              </th>
              <th className="kb-label border-b border-rule-strong px-2 py-1 text-right">
                Precio unit.
              </th>
              <th className="kb-label border-b border-rule-strong px-2 py-1 text-right">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((grupo) => (
              <tr key={grupo.id}>
                <td className="border-b border-rule px-2 py-1 align-top">
                  <span className="text-base text-ink">{grupo.nombre}</span>
                  {/* La composición baja al flujo: en papel no hay margen de
                      anotación que la sostenga al costado. */}
                  <span className="mt-0.5 block text-sm text-ink-2">
                    {composicionDeGrupo(grupo)}
                  </span>
                </td>
                <td className="border-b border-rule px-2 py-1 align-top text-ink-2">
                  {grupo.unidad}
                </td>
                <td className="kb-num border-b border-l border-rule-strong px-2 py-1 text-right align-top text-lg text-ink">
                  {cantidadLegible(grupo.cantidadFinal)}
                </td>
                <td className="kb-num border-b border-rule px-2 py-1 text-right align-top text-ink-2">
                  <Peso valor={grupo.precioUnitario} />
                </td>
                <td className="kb-num border-b border-rule px-2 py-1 text-right align-top">
                  <Peso valor={grupo.conPrecio ? grupo.subtotal : null} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="border-t border-rule-strong bg-margin px-2 py-1">
                <span className="kb-label kb-label-strong">Total del proyecto</span>
              </td>
              <td className="kb-num border-t border-rule-strong bg-margin px-2 py-1 text-right text-lg text-ink">
                <Peso valor={hayPrecio ? totalConPrecio : null} />
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {lineasSinPrecio > 0 ? (
        <p className="mt-2 text-sm text-ink-2">
          {lineasSinPrecio === 1
            ? '1 material quedó sin precio: el total considera solo las líneas con precio cargado.'
            : `${lineasSinPrecio} materiales quedaron sin precio: el total considera solo las líneas con precio cargado.`}
        </p>
      ) : null}
    </>
  )
}

/* -----------------------------------------------------------------------------
   Recinto
   -------------------------------------------------------------------------- */

/**
 * Planta, listado y memoria de cálculo de un recinto.
 * @param {{proyecto:Object, recinto:Object, biblioteca:Array, unidad:string}} props
 */
function HojaRecinto({ proyecto, recinto, biblioteca, unidad }) {
  const { resultado, geometria } = useCalculo(recinto, biblioteca)
  const modulo = obtenerModulo(recinto.moduloId)

  // El despiece del papel sale del mismo `trazar` que pinta el lienzo: no hay
  // una segunda versión del dibujo que pueda quedar atrasada.
  const capas =
    modulo && modulo.disponible && typeof modulo.trazar === 'function'
      ? modulo.trazar({ geometria, parametros: recinto.parametros || {}, biblioteca })
      : []

  return (
    <>
      <CabeceraHoja
        proyecto={proyecto.nombre}
        titulo={recinto.nombre}
        detalle={modulo ? modulo.nombre : recinto.moduloId}
      />

      <div className="kb-hoja-bloque mb-4 border border-rule bg-canvas-ground p-2">
        <PlantaImpresa
          vertices={geometria.vertices}
          cerrado={geometria.cerrado}
          capas={capas}
          unidad={unidad}
          etiqueta={`Planta de ${recinto.nombre}`}
        />
      </div>

      <p className="mb-3 text-base text-ink-2">
        Área <span className="kb-num text-ink">{formatearArea(geometria.areaMm2)} m²</span> ·
        Perímetro{' '}
        <span className="kb-num text-ink">{formatearLineal(geometria.perimetroMm)} ml</span>
      </p>

      {resultado.lineas.length === 0 ? (
        <p className="kb-prose">
          Este recinto no se pudo cubicar.{' '}
          {resultado.avisos.find((a) => a.nivel === 'error')?.mensaje || ''}
        </p>
      ) : (
        <table className="w-full border border-rule text-left">
          <thead>
            <tr className="bg-navy-soft text-navy-ink">
              <th className="kb-label border-b border-rule-strong px-2 py-1">Material</th>
              <th className="kb-label border-b border-rule-strong px-2 py-1">Unidad</th>
              <th className="kb-label border-b border-rule-strong px-2 py-1 text-right">
                Teórica
              </th>
              <th className="kb-label border-b border-rule-strong px-2 py-1 text-right">Desp.</th>
              <th className="kb-label border-b border-rule-strong px-2 py-1 text-right">Final</th>
            </tr>
          </thead>
          <tbody>
            {resultado.lineas.map((linea) => (
              <tr key={linea.clave}>
                <td className="border-b border-rule px-2 py-1 align-top">
                  <span className="text-base text-ink">{linea.nombre}</span>
                  {/* La memoria de cálculo es la promesa del producto: el número
                      se tiene que poder reconstruir a mano sobre el papel. */}
                  <span className="mt-0.5 block text-sm text-ink-2">{linea.nota}</span>
                </td>
                <td className="border-b border-rule px-2 py-1 align-top text-ink-2">
                  {linea.unidad}
                </td>
                <td className="kb-num border-b border-rule px-2 py-1 text-right align-top text-ink-2">
                  {cantidadLegible(linea.cantidadTeorica)}
                </td>
                <td className="kb-num border-b border-rule px-2 py-1 text-right align-top text-ink-2">
                  {linea.desperdicioPct > 0 ? `${linea.desperdicioPct} %` : '—'}
                </td>
                <td className="kb-num border-b border-l border-rule-strong px-2 py-1 text-right align-top text-lg text-ink">
                  {cantidadLegible(linea.cantidadFinal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

/* -----------------------------------------------------------------------------
   Selector
   -------------------------------------------------------------------------- */

/**
 * La hoja que corresponde a la vista abierta. Se monta siempre y no se ve nunca
 * en pantalla: `impresion.css` la enciende solo en el medio de impresión.
 */
export function HojaImpresion() {
  const { estado, recinto } = useApp()
  const proyecto = estado.proyecto

  if (!proyecto) return null

  return (
    <div className="kb-hoja">
      {estado.vista === 'consolidado' ? (
        <HojaConsolidado proyecto={proyecto} biblioteca={estado.biblioteca} />
      ) : null}
      {estado.vista === 'recinto' && recinto ? (
        <HojaRecinto
          proyecto={proyecto}
          recinto={recinto}
          biblioteca={estado.biblioteca}
          unidad={estado.unidadActiva}
        />
      ) : null}
    </div>
  )
}

export default HojaImpresion
