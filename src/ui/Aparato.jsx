/* =============================================================================
   Kubikar · Aparato
   -----------------------------------------------------------------------------
   Dos columnas: a la izquierda el BLOQUE DE MEDIDA, que es la carga útil y manda
   el ancho; a la derecha el MARGEN DE ANOTACIÓN, donde cuelga la memoria de
   cálculo. Entre los dos queda el canal por el que `RulingLayer` traza el filete
   y el corchete que unen cada nota con su fila.

   La regla que gobierna este componente: EL BLOQUE MANDA. El margen es una
   comodidad de lectura, y desaparece antes de estrujar la tabla. Cuando el ancho
   disponible no alcanza para las dos columnas, el margen se apaga, la capa de
   reglado se apaga con él y las notas vuelven al flujo, bajo su propia fila.
   Quien consume el componente decide cómo se ven ahí: recibe `margenActivo` y
   dibuja la nota donde corresponda.

   El emparejamiento entre fila y nota no viaja por refs sino por un atributo de
   datos, `data-aparato-fila` / `data-aparato-nota`. Así una fila puede ser un
   `<tr>` dentro de una tabla, un `<li>` o un `<div>` sin que este componente
   tenga que atravesar la estructura de nadie.
   ============================================================================ */

import { useEffect, useRef, useState } from 'react'
import { Regla } from './Regla.jsx'
import { Rotulo } from './Rotulo.jsx'
import { ATRIBUTO_FILA, ATRIBUTO_NOTA, RulingLayer } from './RulingLayer.jsx'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/**
 * Atributos que marcan una fila del bloque como anclaje de una nota. Se
 * esparcen sobre el elemento de la fila: `<TablaFila {...propsFila('plancha')}>`.
 * @param {string} id
 * @returns {Object}
 */
export function propsFila(id) {
  return { [ATRIBUTO_FILA]: id }
}

/**
 * @typedef {Object} NotaAparato
 * @property {string} id                              debe coincidir con el de su fila
 * @property {string} [titulo]                        rótulo de la nota
 * @property {import('react').ReactNode} contenido    la memoria de cálculo
 */

/**
 * @typedef {Object} PropsAparato
 * @property {import('react').ReactNode | ((estado:{margenActivo:boolean,propsFila:(id:string)=>Object}) => import('react').ReactNode)} children
 * @property {NotaAparato[]} [notas]
 * @property {string}  [rotuloMargen]
 * @property {string|null} [destacada]   id de la unión que va en rúbrica
 * @property {number}  [minimoBloque]    ancho mínimo del bloque, en píxeles
 * @property {number}  [minimoMargen]    ancho mínimo del margen, en píxeles
 * @property {string}  [className]
 */

/**
 * Bloque de medida con margen de anotación reglado.
 * @param {PropsAparato} props
 */
export function Aparato({
  children,
  notas = [],
  rotuloMargen = 'Aparato',
  destacada = null,
  minimoBloque = 320,
  minimoMargen = 240,
  className,
}) {
  const contenedorRef = useRef(/** @type {HTMLDivElement|null} */ (null))
  const [ancho, setAncho] = useState(0)

  // El margen se decide por el ancho REAL de esta caja, no por el de la ventana:
  // el aparato puede vivir dentro del panel angosto o a lo ancho del consolidado
  // y debe resolverlo igual en los dos casos.
  useEffect(() => {
    const elemento = contenedorRef.current
    if (!elemento || typeof ResizeObserver === 'undefined') return undefined

    setAncho(elemento.getBoundingClientRect().width)
    const observador = new ResizeObserver((entradas) => {
      for (const entrada of entradas) setAncho(entrada.contentRect.width)
    })
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])

  const lista = Array.isArray(notas) ? notas.filter((nota) => nota && nota.id) : []
  const margenActivo = lista.length > 0 && ancho >= minimoBloque + minimoMargen

  // Cambio de datos: el motor de reglado vuelve a medir cuando cambia el juego
  // de notas. Los cambios de alto de una nota ya los toma su ResizeObserver.
  const revision = `${margenActivo ? '1' : '0'}:${lista.map((nota) => nota.id).join('|')}`

  const contenido =
    typeof children === 'function' ? children({ margenActivo, propsFila }) : children

  return (
    <div ref={contenedorRef} className={cx('relative w-full', className)}>
      <div className={cx('flex w-full items-start', margenActivo && 'gap-6')}>
        <div className="min-w-0 flex-1">{contenido}</div>

        {margenActivo ? (
          <aside className="w-60 shrink-0" aria-label={rotuloMargen}>
            <Rotulo tinta="fuerte" como="h3">
              {rotuloMargen}
            </Rotulo>
            <Regla className="mt-1 mb-3" />

            <div className="flex flex-col gap-6">
              {lista.map((nota) => (
                <div
                  key={nota.id}
                  {...{ [ATRIBUTO_NOTA]: nota.id }}
                  className="flex flex-col gap-1 pl-3"
                >
                  {nota.titulo ? (
                    <Rotulo tinta={nota.id === destacada ? 'rubrica' : 'normal'}>
                      {nota.titulo}
                    </Rotulo>
                  ) : null}
                  <div className="kb-prose">{nota.contenido}</div>
                </div>
              ))}
            </div>
          </aside>
        ) : null}
      </div>

      <RulingLayer
        contenedorRef={contenedorRef}
        activo={margenActivo}
        revision={revision}
        destacada={destacada}
      />
    </div>
  )
}

export default Aparato
