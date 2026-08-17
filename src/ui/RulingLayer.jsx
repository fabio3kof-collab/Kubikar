/* =============================================================================
   Kubikar · motor de reglado
   -----------------------------------------------------------------------------
   La palanca técnica de esta edición. Una capa SVG en posición absoluta que mide
   las cajas REALES de las filas del bloque y de sus notas del margen, y traza el
   corchete y el filete que las unen. No hay una sola posición supuesta: todo
   sale de `getBoundingClientRect`, y todo se vuelve a resolver cuando algo se
   mueve.

   Tres decisiones sostienen este archivo:

   1. MIDE, NO CALCULA. Las notas viven en el flujo normal del margen y la tabla
      en el suyo. La capa no reposiciona nada: solo lee dónde quedó cada caja y
      dibuja encima. Por eso nunca hay realimentación entre lo que dibuja y lo
      que mide, que es el modo en que este tipo de capa suele entrar en bucle.

   2. ALINEA AL PÍXEL DEL DISPOSITIVO. Un filete de un píxel trazado en una
      coordenada fraccionaria sale gris y borroso. `alinear` lleva cada
      coordenada al centro de un píxel físico:
        Math.round(v * dpr) / dpr + 0.5 / dpr
      Con dpr 1 eso es el clásico `+0.5`; con dpr 2 o 3 es lo mismo un escalón
      más fino. El trazo sale negro y de un píxel exacto en cualquier pantalla.

   3. SE APAGA ANTES DE MENTIR. Si entre la fila y su nota no queda canal
      suficiente (el margen se estrechó, la nota cayó bajo la fila), esa unión
      no se dibuja. La capa nunca inventa un corchete que cruza texto.

   La capa es `aria-hidden` y no recibe puntero: es tinta, no interfaz. Lo que
   une ya está unido semánticamente por el orden del documento.
   ============================================================================ */

import { useLayoutEffect, useRef, useState } from 'react'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/** Atributo con que una fila del bloque declara su identificador. */
export const ATRIBUTO_FILA = 'data-aparato-fila'

/** Atributo con que una nota del margen declara a qué fila pertenece. */
export const ATRIBUTO_NOTA = 'data-aparato-nota'

/** Largo del brazo del corchete y de la marca de registro, en píxeles CSS. */
const BRAZO = 5

/** Canal mínimo entre el borde de la fila y el borde de la nota, en píxeles. */
const CANAL_MINIMO = 16

/**
 * Lleva una coordenada al centro de un píxel del dispositivo, para que un trazo
 * de un píxel caiga entero sobre una sola fila de píxeles físicos.
 * @param {number} valor
 * @param {number} dpr
 * @returns {number}
 */
function alinear(valor, dpr) {
  const d = Number.isFinite(dpr) && dpr > 0 ? dpr : 1
  const v = Number.isFinite(valor) ? valor : 0
  return Math.round(v * d) / d + 0.5 / d
}

/**
 * @typedef {Object} TrazoReglado
 * @property {string} id
 * @property {string} marca     tick de registro en el borde de la fila
 * @property {string} conector  filete que cruza el canal hasta la nota
 * @property {string} corchete  corchete que abraza el alto de la nota
 */

/**
 * @typedef {Object} PropsRulingLayer
 * @property {{current: HTMLElement|null}} contenedorRef  caja con `position:relative`
 * @property {boolean} [activo]      con false la capa no mide ni dibuja
 * @property {string}  [revision]    cambia cuando cambian los datos: fuerza medición
 * @property {string|null} [destacada]  id de la unión que va en rúbrica
 * @property {string}  [atributoFila]
 * @property {string}  [atributoNota]
 * @property {string}  [className]
 */

/**
 * Capa de reglado entre un bloque de medida y su margen de anotación.
 * @param {PropsRulingLayer} props
 */
export function RulingLayer({
  contenedorRef,
  activo = true,
  revision = '',
  destacada = null,
  atributoFila = ATRIBUTO_FILA,
  atributoNota = ATRIBUTO_NOTA,
  className,
}) {
  const [mapa, setMapa] = useState(
    /** @type {{ancho:number,alto:number,trazos:TrazoReglado[]}} */ ({
      ancho: 0,
      alto: 0,
      trazos: [],
    }),
  )
  // Firma de la última medición: evita renders idénticos cuando el observador
  // dispara por un cambio que no movió ninguna caja.
  const firmaRef = useRef('')

  useLayoutEffect(() => {
    const contenedor = contenedorRef && contenedorRef.current ? contenedorRef.current : null

    if (!activo || !contenedor || typeof ResizeObserver === 'undefined') {
      if (firmaRef.current !== '') {
        firmaRef.current = ''
        setMapa({ ancho: 0, alto: 0, trazos: [] })
      }
      return undefined
    }

    let vivo = true
    let cuadro = 0

    /** Agenda una medición para el próximo cuadro; nunca mide dos veces seguidas. */
    function programar() {
      if (!vivo || cuadro) return
      cuadro = window.requestAnimationFrame(() => {
        cuadro = 0
        medir()
      })
    }

    const observador = new ResizeObserver(programar)
    observador.observe(contenedor)

    // Registro propio de lo observado. `observe()` sobre un elemento ya
    // observado NO es una operación nula según la especificación: primero deja
    // de observarlo y crea una observación nueva con el último tamaño reportado
    // en (0,0), o sea vuelve a marcarlo como activo y dispara otra
    // notificación. Que hoy no entre en bucle depende de un retorno anticipado
    // que Blink y Gecko agregaron por su cuenta, no de una garantía. Con este
    // Set se observa cada caja una sola vez y se suelta la que desapareció.
    /** @type {Set<Element>} */
    const observados = new Set()

    /** @param {Element} elemento */
    function observarUnaVez(elemento) {
      if (observados.has(elemento)) return
      observador.observe(elemento)
      observados.add(elemento)
    }

    function soltarLoQueSeFue() {
      for (const elemento of observados) {
        if (elemento.isConnected) continue
        observador.unobserve(elemento)
        observados.delete(elemento)
      }
    }

    function medir() {
      if (!vivo) return
      const caja = contenedor.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1

      soltarLoQueSeFue()

      /** @type {Map<string, Element>} */
      const filas = new Map()
      contenedor.querySelectorAll(`[${atributoFila}]`).forEach((elemento) => {
        observarUnaVez(elemento)
        const id = elemento.getAttribute(atributoFila)
        if (id) filas.set(id, elemento)
      })

      /** @type {TrazoReglado[]} */
      const trazos = []
      contenedor.querySelectorAll(`[${atributoNota}]`).forEach((nota) => {
        observarUnaVez(nota)
        const id = nota.getAttribute(atributoNota)
        if (!id) return
        const fila = filas.get(id)
        if (!fila) return

        const rf = fila.getBoundingClientRect()
        const rn = nota.getBoundingClientRect()
        // Caja sin superficie: el elemento está oculto o todavía no se pintó.
        if (rf.width <= 0 || rf.height <= 0 || rn.width <= 0 || rn.height <= 0) return
        // Sin canal no hay corchete posible: la nota volvió al flujo o el margen
        // se estrechó. Se omite esta unión antes que trazar sobre el texto.
        if (rn.left - rf.right < CANAL_MINIMO) return

        const x1 = alinear(rf.right - caja.left, dpr)
        const x2 = alinear(rn.left - caja.left, dpr)
        const xm = alinear(rf.right + (rn.left - rf.right) / 2 - caja.left, dpr)
        const yFila = alinear(rf.top + rf.height / 2 - caja.top, dpr)
        const yAlto = alinear(rn.top - caja.top, dpr)
        const yBajo = alinear(rn.bottom - caja.top, dpr)
        const yNota = alinear(rn.top + rn.height / 2 - caja.top, dpr)

        trazos.push({
          id,
          marca: `M ${x1} ${yFila - BRAZO} V ${yFila + BRAZO}`,
          conector: `M ${x1} ${yFila} H ${xm} V ${yNota} H ${x2}`,
          corchete: `M ${x2 + BRAZO} ${yAlto} H ${x2} V ${yBajo} H ${x2 + BRAZO}`,
        })
      })

      const siguiente = {
        ancho: Math.round(caja.width),
        alto: Math.round(caja.height),
        trazos,
      }
      const firma = JSON.stringify(siguiente)
      if (firma === firmaRef.current) return
      firmaRef.current = firma
      setMapa(siguiente)
    }

    medir()

    window.addEventListener('resize', programar)
    // En captura: así llegan también los desplazamientos de los contenedores
    // interiores, que es donde vive esta tabla, y no solo el de la ventana.
    // Pasivo, porque este oyente cubre TODA la aplicación y no puede quedarse
    // con la posibilidad de cancelar un desplazamiento que no le pertenece.
    window.addEventListener('scroll', programar, { capture: true, passive: true })

    // La fuente variable llega después del primer pintado y mueve cada caja.
    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
      document.fonts.ready.then(programar, () => {})
    }

    return () => {
      vivo = false
      if (cuadro) window.cancelAnimationFrame(cuadro)
      observador.disconnect()
      observados.clear()
      window.removeEventListener('resize', programar)
      window.removeEventListener('scroll', programar, { capture: true })
    }
  }, [contenedorRef, activo, revision, atributoFila, atributoNota])

  if (!activo || mapa.trazos.length === 0 || mapa.ancho <= 0 || mapa.alto <= 0) return null

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={mapa.ancho}
      height={mapa.alto}
      viewBox={`0 0 ${mapa.ancho} ${mapa.alto}`}
      className={cx('pointer-events-none absolute top-0 left-0 overflow-visible', className)}
    >
      {mapa.trazos.map((trazo) => {
        const rubrica = trazo.id === destacada
        return (
          <g key={trazo.id} fill="none" strokeWidth="1" vectorEffect="non-scaling-stroke">
            <path
              d={trazo.marca}
              stroke="currentColor"
              className={rubrica ? 'text-accent' : 'text-rule-strong'}
            />
            <path
              d={trazo.conector}
              stroke="currentColor"
              className={rubrica ? 'text-accent' : 'text-rule'}
            />
            <path
              d={trazo.corchete}
              stroke="currentColor"
              className={rubrica ? 'text-accent' : 'text-rule-strong'}
            />
          </g>
        )
      })}
    </svg>
  )
}

export default RulingLayer
