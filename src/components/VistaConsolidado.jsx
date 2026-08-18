/* =============================================================================
   Kubikar · consolidado del proyecto
   -----------------------------------------------------------------------------
   La lista de compra de la obra: todas las líneas de material de todos los
   recintos, agrupadas por material.

   La regla que manda esta vista: NUNCA MOSTRAR CERO POR UN RECINTO QUE QUEDÓ
   FUERA. Un recinto sin polígono cerrado no aporta cero metros de material, no
   aporta nada, y eso hay que decirlo con nombre y apellido antes de la tabla:
   "2 recintos quedaron fuera del consolidado por no tener el polígono cerrado:
   Dormitorio 1, Baño." Un cero silencioso en una cubicación se paga en terreno.

   El total del pie suma solo las líneas con precio cargado, y se declara cuántas
   quedaron sin precio. Un total que mezcla materiales cotizados con materiales
   sin cotizar no es un presupuesto, es una cifra falsa.

   Las cantidades finales se suman ya redondeadas por recinto: en obra cada
   recinto se corta aparte y el sobrante de uno no cubre al siguiente. Eso lo
   resuelve `useConsolidado`; acá solo se imprime.

   EL APARATO. Esta vista tiene ancho de sobra, así que la composición de cada
   grupo —qué recinto aportó cuánto— cuelga en el margen de anotación,
   encorchetada a su fila por el motor de reglado, igual que la memoria de
   cálculo de un recinto. Cuando el margen no alcanza, esa misma composición
   vuelve al flujo como detalle desplegable: la información no se pierde, cambia
   de sitio. Nunca están las dos formas a la vez.

   La cifra que se compra —la columna Cantidad— lleva el mismo registro que la
   columna Final de la pestaña Resultados: 17px, rótulo en rúbrica y filete
   vertical. Es la misma cifra en dos pantallas y tiene que pesar lo mismo.
   ============================================================================ */

import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Printer } from 'lucide-react'

import { formatearCLP, formatearCantidad } from '../core/units.js'
import { useApp } from '../state/AppState.jsx'
import { useConsolidado } from '../state/useConsolidado.js'
import { Aparato } from '../ui/Aparato.jsx'
import { Dinero } from './PestanaResultados.jsx'
import {
  Aviso,
  Boton,
  EstadoVacio,
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaFila,
  TablaPie,
  TablaTitulo,
} from '../ui/index.js'

/**
 * Filete vertical que separa la cifra de cierre del resto de la fila. Mismo
 * registro que en `PestanaResultados`.
 */
const CIERRE_DE_FILA = 'border-l border-rule-strong'

/**
 * Motivos conocidos, traducidos a la frase con que se declara la omisión. Los
 * mensajes vienen redactados por el motor de cálculo; acá solo se resumen para
 * poder juntar varios recintos en una sola línea.
 * @type {Record<string,string>}
 */
const MOTIVOS = {
  'Cierra el polígono para cubicar.': 'por no tener el polígono cerrado',
  'Este recinto todavía no tiene polígono. Marca los vértices en el lienzo para cubicar.':
    'por no tener polígono dibujado',
  'El polígono necesita al menos 3 vértices para cerrarse y poder cubicar.':
    'por tener menos de 3 vértices',
}

/**
 * Junta los recintos omitidos por motivo y arma una frase por grupo.
 * @param {{recintoId:string,nombre:string,razon:string}[]} omitidos
 * @returns {string[]}
 */
export function frasesDeOmision(omitidos) {
  /** @type {Map<string,string[]>} conserva el orden de aparición */
  const porRazon = new Map()
  for (const omitido of omitidos) {
    const razon = typeof omitido.razon === 'string' ? omitido.razon : ''
    const nombres = porRazon.get(razon) || []
    nombres.push(omitido.nombre)
    porRazon.set(razon, nombres)
  }

  const frases = []
  for (const [razon, nombres] of porRazon) {
    const sujeto = nombres.length === 1 ? '1 recinto quedó' : `${nombres.length} recintos quedaron`
    const lista = nombres.join(', ')
    const motivo = MOTIVOS[razon]
    frases.push(
      motivo
        ? `${sujeto} fuera del consolidado ${motivo}: ${lista}.`
        : `${sujeto} fuera del consolidado: ${lista}. ${razon}`,
    )
  }
  return frases
}

/**
 * Identificador de grupo apto para un atributo `id` del documento: la clave de
 * agrupación puede ser `clave::nombre` y traer espacios.
 * @param {string} id
 * @returns {string}
 */
function idHtml(id) {
  return `consolidado-${String(id).replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

/**
 * Cantidad con los decimales justos: las unidades enteras no llevan coma.
 * @param {number} cantidad
 * @returns {string}
 */
export function cantidadLegible(cantidad) {
  return formatearCantidad(cantidad, Number.isInteger(cantidad) ? 0 : 2)
}

/**
 * Composición de un grupo: qué recinto aportó cuánto y con qué precio se
 * multiplicó. Es la memoria de cálculo del consolidado, la cuenta que permite
 * reconstruir a mano la cifra de la fila.
 *
 * @param {Object} grupo
 * @returns {string}
 */
export function composicionDeGrupo(grupo) {
  const aportes = grupo.detalle
    .map((aporte) => `${aporte.recintoNombre} ${cantidadLegible(aporte.cantidadFinal)}`)
    .join(' + ')
  const suma = `${aportes} = ${cantidadLegible(grupo.cantidadFinal)} ${grupo.unidad}`
  if (!grupo.conPrecio) return suma
  return `${suma} · ${formatearCLP(grupo.precioUnitario)} por ${grupo.unidad} = ${formatearCLP(grupo.subtotal)}`
}

/**
 * Consolidado de materiales del proyecto.
 */
export function VistaConsolidado() {
  const { estado, acciones } = useApp()
  const consolidado = useConsolidado(estado.proyecto, estado.biblioteca)
  const [desplegados, setDesplegados] = useState(() => new Set())

  const notas = useMemo(
    () =>
      consolidado.grupos.map((grupo) => ({
        id: grupo.id,
        titulo: grupo.nombre,
        contenido: composicionDeGrupo(grupo),
      })),
    [consolidado.grupos],
  )

  /** @param {string} id */
  function alternarDetalle(id) {
    setDesplegados((previos) => {
      const siguiente = new Set(previos)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  }

  if (!estado.proyecto) {
    return (
      <section className="mx-auto flex w-full max-w-[64rem] flex-col gap-4 px-4 py-6">
        <EstadoVacio
          encuadrado
          titulo="No hay un proyecto abierto."
          descripcion="Abre un proyecto para ver el consolidado de sus recintos."
          acciones={
            <Boton variante="primaria" onClick={() => acciones.cambiarVista('proyectos')}>
              Ver proyectos
            </Boton>
          }
        />
      </section>
    )
  }

  const { grupos, omitidos, incluidos, totalRecintos, totalConPrecio, lineasSinPrecio } =
    consolidado
  const frases = frasesDeOmision(omitidos)
  const hayPrecio = grupos.some((grupo) => grupo.conPrecio)

  return (
    <section className="mx-auto flex w-full max-w-[64rem] flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl text-ink">Consolidado de materiales</h2>
          <p className="text-base text-ink-2">
            {estado.proyecto.nombre} · <span className="kb-num">{incluidos}</span> de{' '}
            <span className="kb-num">{totalRecintos}</span>{' '}
            {totalRecintos === 1 ? 'recinto cubicado' : 'recintos cubicados'}
          </p>
        </div>
        {/* La lista de compra se lleva en papel: al proveedor, a la faena o al
            archivador del presupuesto. El botón imprime la hoja dedicada de
            `HojaImpresion`, no esta pantalla. */}
        <Boton icono={Printer} onClick={() => window.print()}>
          Imprimir
        </Boton>
      </header>

      {/* La declaración de lo que quedó fuera va ARRIBA de la tabla: se lee antes
          de mirar una sola cifra. */}
      {frases.length > 0 ? (
        <Aviso nivel="advertencia" titulo="Recintos fuera del consolidado">
          <ul className="flex flex-col gap-1">
            {frases.map((frase) => (
              <li key={frase}>{frase}</li>
            ))}
          </ul>
        </Aviso>
      ) : null}

      {grupos.length === 0 ? (
        <EstadoVacio
          encuadrado
          titulo={
            totalRecintos === 0
              ? 'Este proyecto no tiene recintos.'
              : 'Ningún recinto se pudo cubicar.'
          }
          descripcion={
            totalRecintos === 0
              ? 'Agrega un recinto y dibuja su planta para que el consolidado tenga qué sumar.'
              : 'Ninguno de los recintos del proyecto entregó material. Arriba está el motivo de cada uno.'
          }
          acciones={
            totalRecintos === 0 ? (
              <Boton variante="primaria" icono={Plus} onClick={() => acciones.agregarRecinto()}>
                Agregar recinto
              </Boton>
            ) : (
              <Boton onClick={() => acciones.cambiarVista('recinto')}>Volver al recinto</Boton>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          <Aparato notas={notas} rotuloMargen="Composición">
            {({ margenActivo, propsFila }) => {
              // Con el margen activo la composición cuelga al costado; sin él
              // vuelve al flujo y hace falta la columna del desplegable.
              const columnas = margenActivo ? 5 : 6

              return (
                <Tabla
                  titulo="Materiales del proyecto"
                  tituloOculto
                  className="border border-rule bg-block"
                >
                  <TablaCabecera>
                    <tr>
                      {!margenActivo ? (
                        <TablaTitulo>
                          <span className="sr-only">Detalle por recinto</span>
                        </TablaTitulo>
                      ) : null}
                      <TablaTitulo>Material</TablaTitulo>
                      <TablaTitulo>Unidad</TablaTitulo>
                      <TablaTitulo numerica className={CIERRE_DE_FILA}>
                        <span className="kb-label-rubric">Cantidad</span>
                      </TablaTitulo>
                      <TablaTitulo numerica>Precio unit.</TablaTitulo>
                      <TablaTitulo numerica>Subtotal</TablaTitulo>
                    </tr>
                  </TablaCabecera>

                  <TablaCuerpo>
                    {grupos.map((grupo) => {
                      const abierto = desplegados.has(grupo.id)
                      const idDetalle = idHtml(grupo.id)

                      return (
                        <Fragment key={grupo.id}>
                          <TablaFila {...propsFila(grupo.id)}>
                            {!margenActivo ? (
                              <TablaCelda alineacion="medio" className="w-10">
                                <Boton
                                  variante="fantasma"
                                  tamano="sm"
                                  soloIcono
                                  icono={abierto ? ChevronDown : ChevronRight}
                                  etiquetaAccesible={
                                    abierto
                                      ? `Ocultar el aporte de cada recinto en ${grupo.nombre}`
                                      : `Ver el aporte de cada recinto en ${grupo.nombre}`
                                  }
                                  aria-expanded={abierto ? 'true' : 'false'}
                                  aria-controls={idDetalle}
                                  onClick={() => alternarDetalle(grupo.id)}
                                />
                              </TablaCelda>
                            ) : null}

                            {/* Fila alineada por la línea de base: la cantidad
                                va en otro registro y tiene que leerse sobre la
                                misma línea que el resto. */}
                            <TablaCelda alineacion="base" className="min-w-32">
                              {grupo.nombre}
                            </TablaCelda>
                            <TablaCelda alineacion="base" className="whitespace-nowrap text-ink-2">
                              {grupo.unidad}
                            </TablaCelda>
                            <TablaCelda
                              numerica
                              alineacion="base"
                              registro="cifra"
                              className={`${CIERRE_DE_FILA} text-ink`}
                            >
                              {cantidadLegible(grupo.cantidadFinal)}
                            </TablaCelda>
                            <TablaCelda numerica alineacion="base" className="text-ink-2">
                              <Dinero valor={grupo.precioUnitario} />
                            </TablaCelda>
                            <TablaCelda numerica alineacion="base">
                              <Dinero valor={grupo.conPrecio ? grupo.subtotal : null} />
                            </TablaCelda>
                          </TablaFila>

                          {!margenActivo && abierto ? (
                            <tr id={idDetalle}>
                              <td
                                colSpan={columnas}
                                className="border-b border-rule bg-margin px-3 py-2"
                              >
                                <ul className="flex flex-col gap-2">
                                  {grupo.detalle.map((aporte) => (
                                    <li
                                      key={`${grupo.id}-${aporte.recintoId}`}
                                      className="flex flex-col gap-0.5"
                                    >
                                      <span className="flex flex-wrap items-baseline justify-between gap-3">
                                        <span className="text-base text-ink">
                                          {aporte.recintoNombre}
                                        </span>
                                        <span className="kb-num whitespace-nowrap text-base text-ink">
                                          {cantidadLegible(aporte.cantidadFinal)} {grupo.unidad}
                                          {aporte.subtotal === null
                                            ? ''
                                            : ` · ${formatearCLP(aporte.subtotal)}`}
                                        </span>
                                      </span>
                                      {aporte.nota ? (
                                        <span className="text-sm text-ink-2">{aporte.nota}</span>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      )
                    })}
                  </TablaCuerpo>

                  <TablaPie>
                    <tr>
                      {/* Sin `numerica`: el rótulo del total va a la izquierda,
                          igual que en la pestaña Resultados. Es la misma fila y
                          el mismo rol en las dos pantallas. */}
                      <TablaCelda
                        colSpan={columnas - 1}
                        alineacion="base"
                        className="border-t border-rule-strong bg-margin"
                      >
                        <span className="kb-label kb-label-strong">Total del proyecto</span>
                      </TablaCelda>
                      <TablaCelda
                        numerica
                        alineacion="base"
                        registro="cifra"
                        className="border-t border-rule-strong bg-margin text-ink"
                      >
                        <Dinero
                          valor={hayPrecio ? totalConPrecio : null}
                          razon="Ningún material tiene precio cargado"
                        />
                      </TablaCelda>
                    </tr>
                  </TablaPie>
                </Tabla>
              )
            }}
          </Aparato>

          {lineasSinPrecio > 0 ? (
            <p className="text-sm text-ink-2">
              {lineasSinPrecio === 1
                ? '1 material quedó sin precio: el total considera solo las líneas con precio cargado. Carga el precio en la Biblioteca para incluirlo.'
                : `${lineasSinPrecio} materiales quedaron sin precio: el total considera solo las líneas con precio cargado. Carga los precios en la Biblioteca para incluirlos.`}
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}

export default VistaConsolidado
