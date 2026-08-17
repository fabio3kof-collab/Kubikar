/* =============================================================================
   Kubikar · lienzo de dibujo
   -----------------------------------------------------------------------------
   La pieza central del producto: la planta del recinto se dibuja acá y de ese
   polígono sale toda la cubicación. Un único <svg> con un grupo transformado por
   `translate(...) scale(...)`. Nada de canvas: el dibujo tiene que ser
   inspeccionable, seleccionable y accesible por teclado.

   TRES SISTEMAS DE COORDENADAS Y UNA SOLA REGLA
   ---------------------------------------------
     mundo     milímetros, la unidad base. Es lo único que se guarda.
     pantalla  píxeles del <svg>:  pantalla = mundo · zoom + (vista.x, vista.y)
     unidad    la lente de lectura (mm, cm o m). Solo entra al formatear un
               número en pantalla; jamás toca la geometría.

   Todo lo que tiene que verse del mismo grosor a cualquier zoom se resuelve de
   dos maneras, según dónde viva:
     · dentro del grupo escalado (grilla, aristas, relleno) el trazo se divide
       por el zoom;
     · fuera del grupo escalado (vértices, cotas, corchetes) la posición se
       multiplica por el zoom y el tamaño queda constante por construcción.

   Las tolerancias de clic se declaran en PÍXELES DE PANTALLA y se convierten a
   milímetros dividiendo por el zoom: agarrar un vértice tiene que costar lo
   mismo con el plano completo a la vista que con un rincón ampliado 40 veces.

   El puntero se maneja con eventos de puntero y captura, de modo que el mouse en
   escritorio y el dedo en una tablet de obra recorren exactamente el mismo
   camino de código.
   ============================================================================ */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import {
  ajustarAGrilla,
  areaMm2 as areaDeVertices,
  boundingBox,
  centroide,
  cercaDe,
  restringirOrtogonal,
  segmentos as segmentosDe,
} from '../core/geometry.js'
import { formatearArea, formatearLongitud, obtenerUnidad } from '../core/units.js'
import { useApp } from '../state/AppState.jsx'
import { moduloTrazaDe, trazadoDeRecinto } from '../state/useCalculo.js'
import { Aviso, Cruz } from '../ui/index.js'
import { AccionCerrar, LienzoControles } from './LienzoControles.jsx'

/* =============================================================================
   Constantes de interacción
   Todas las tolerancias van en píxeles de pantalla. Ninguna es un color, un
   radio ni un tamaño de texto: son distancias de puntero, y su lugar es acá.
   ========================================================================== */

/**
 * Límites de zoom, en PÍXELES POR MILÍMETRO. Es la unidad que hace falta tener
 * clara para elegirlos: con 0,05 un metro ocupa 50 px, así que ninguna planta de
 * más de unos 16 m entra en un lienzo de 800 px, y al encoger el lienzo a franja
 * la figura ni siquiera cabe. El piso baja a 0,002 (1 m = 2 px), que deja ver un
 * galpón o una planta completa de piso, y el techo de 40 permite acercarse hasta
 * el milímetro para ajustar un vértice.
 */
const ZOOM_MIN = 0.002
const ZOOM_MAX = 40

/** Radio del área transparente de captura de un vértice, en píxeles. */
const RADIO_CAPTURA_PX = 16

/** Tolerancia para cerrar el polígono haciendo clic sobre el primer vértice. */
const TOL_CIERRE_PX = 16

/** Aire alrededor de la figura al ajustar la vista. */
const MARGEN_ENCUADRE_PX = 72

/** Ancho de mundo que se muestra cuando todavía no hay nada dibujado: 12 m. */
const MUNDO_VACIO_MM = 12000

/** Bajo este tamaño en pantalla, una cuadrícula deja de leerse y se apaga. */
const CELDA_MINIMA_PX = 6

/** Un segmento más corto que esto en pantalla no alcanza para colgarle la cota. */
const COTA_MINIMA_PX = 30

/**
 * Recorrido mínimo para que apretar un vértice cuente como arrastre y no como
 * un simple clic de selección. Sin este umbral, seleccionar un vértice que
 * venía fuera de la grilla lo movería solo por tocarlo.
 */
const UMBRAL_ARRASTRE_PX = 3

/** Cada cuántos pasos va una línea mayor de la grilla. */
const PASOS_POR_LINEA_MAYOR = 5

/** Cuántos pasos avanza el teclado con la tecla Mayúsculas apretada. */
const PASOS_TECLA_RAPIDA = 5

/* =============================================================================
   Fuentes: los rótulos del lienzo se miden con getBBox para dibujarles el
   rectángulo de papel exacto por detrás. Mientras la familia real no cargue, la
   medición corresponde a la tipografía de respaldo, así que hay que rehacerla
   una vez cuando las fuentes están listas. Es un solo suscriptor para todo el
   lienzo, no uno por rótulo.
   ========================================================================== */

let fuentesListas = false
const oyentesFuentes = new Set()

if (typeof document !== 'undefined') {
  if (document.fonts && typeof document.fonts.ready === 'object') {
    document.fonts.ready.then(() => {
      fuentesListas = true
      oyentesFuentes.forEach((avisar) => avisar())
    })
  } else {
    fuentesListas = true
  }
}

/**
 * @param {() => void} avisar
 * @returns {() => void}
 */
function suscribirFuentes(avisar) {
  oyentesFuentes.add(avisar)
  return () => oyentesFuentes.delete(avisar)
}

/** @returns {boolean} */
function leerFuentes() {
  return fuentesListas
}

/** @returns {boolean} */
function useFuentesListas() {
  return useSyncExternalStore(suscribirFuentes, leerFuentes, () => true)
}

/* =============================================================================
   Geometría auxiliar
   ========================================================================== */

/**
 * ¿El evento nació dentro de un campo de escritura? Los modificadores globales
 * del lienzo no pueden robarle una tecla a un campo donde se está escribiendo.
 * @param {*} destino
 * @returns {boolean}
 */
function esCampoEditable(destino) {
  if (!destino || typeof destino !== 'object') return false
  const etiqueta = typeof destino.tagName === 'string' ? destino.tagName.toUpperCase() : ''
  if (etiqueta === 'INPUT' || etiqueta === 'TEXTAREA' || etiqueta === 'SELECT') return true
  return destino.isContentEditable === true
}

/**
 * @param {number} zoom
 * @returns {number}
 */
function acotarZoom(zoom) {
  if (!Number.isFinite(zoom)) return 1
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
}

/**
 * Producto cruz de (b−a) × (c−a).
 * @param {{x:number,y:number}} a @param {{x:number,y:number}} b @param {{x:number,y:number}} c
 * @returns {number}
 */
function cruz(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

/**
 * ¿Se cruzan de verdad dos segmentos? Cruce propio o traslape colineal de largo
 * no nulo; el contacto en un solo punto no cuenta.
 *
 * `core/geometry.js` responde lo mismo para el polígono completo, pero devuelve
 * un booleano: para pintar en rojo SOLO los segmentos culpables hace falta el
 * detalle por par. La prueba de acá replica exactamente la semántica de
 * `esAutoIntersectante` para que el dibujo y el aviso nunca se contradigan.
 *
 * @param {{x:number,y:number}} p1 @param {{x:number,y:number}} p2
 * @param {{x:number,y:number}} p3 @param {{x:number,y:number}} p4
 * @returns {boolean}
 */
function seCruzan(p1, p2, p3, p4) {
  // La escala se mide contra un origen común, no contra el cero del mundo: con
  // coordenadas absolutas una figura chica lejos del origen produce una
  // tolerancia enorme y un cuadrado perfecto se declararía traslapado. Misma
  // corrección que en `core/geometry.js`, para que dibujo y aviso no se
  // contradigan nunca.
  const escala = Math.max(
    Math.abs(p2.x - p1.x),
    Math.abs(p2.y - p1.y),
    Math.abs(p3.x - p1.x),
    Math.abs(p3.y - p1.y),
    Math.abs(p4.x - p1.x),
    Math.abs(p4.y - p1.y),
    1,
  )
  const tol = escala * escala * 1e-9

  const d1 = cruz(p3, p4, p1)
  const d2 = cruz(p3, p4, p2)
  const d3 = cruz(p1, p2, p3)
  const d4 = cruz(p1, p2, p4)

  const s1 = Math.abs(d1) <= tol ? 0 : Math.sign(d1)
  const s2 = Math.abs(d2) <= tol ? 0 : Math.sign(d2)
  const s3 = Math.abs(d3) <= tol ? 0 : Math.sign(d3)
  const s4 = Math.abs(d4) <= tol ? 0 : Math.sign(d4)

  if (s1 !== 0 && s2 !== 0 && s3 !== 0 && s4 !== 0) return s1 !== s2 && s3 !== s4

  if (s1 === 0 && s2 === 0 && s3 === 0 && s4 === 0) {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const largo = Math.hypot(dx, dy)
    if (largo <= 1e-9) return false
    const ux = dx / largo
    const uy = dy / largo
    const a1 = p1.x * ux + p1.y * uy
    const a2 = p2.x * ux + p2.y * uy
    const b1 = p3.x * ux + p3.y * uy
    const b2 = p4.x * ux + p4.y * uy
    const inicio = Math.max(Math.min(a1, a2), Math.min(b1, b2))
    const fin = Math.min(Math.max(a1, a2), Math.max(b1, b2))
    return fin - inicio > largo * 1e-6
  }

  return false
}

/**
 * Índices de los segmentos que participan en algún cruce.
 * @param {Array<{indice:number,a:{x:number,y:number},b:{x:number,y:number}}>} segs
 * @param {boolean} cerrado
 * @returns {Set<number>}
 */
function segmentosCruzados(segs, cerrado) {
  const marcados = new Set()
  const n = segs.length
  if (n < 4) return marcados
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const adyacente = j === i + 1 || (cerrado && i === 0 && j === n - 1)
      if (adyacente) continue
      if (seCruzan(segs[i].a, segs[i].b, segs[j].a, segs[j].b)) {
        marcados.add(segs[i].indice)
        marcados.add(segs[j].indice)
      }
    }
  }
  return marcados
}

/* =============================================================================
   Piezas de dibujo
   ========================================================================== */

/** Holgura del rectángulo de papel alrededor del texto, en píxeles. */
const PAPEL_HOLGURA_X = 4
const PAPEL_HOLGURA_Y = 2

/**
 * Rótulo del lienzo con su rectángulo de papel por detrás. El rectángulo se
 * mide con `getBBox` sobre el texto ya compuesto: estimar el ancho por cantidad
 * de caracteres deja el papel corrido cada vez que cambia una cifra.
 *
 * LA MEDICIÓN NO ESCRIBE EN EL DOM. Antes, el efecto leía con `getBBox` y a
 * continuación escribía cuatro `setAttribute` sobre el rectángulo. Con una
 * instancia por cota, más el área, la guía y el cursor, el commit quedaba
 * intercalado leer-escribir-leer-escribir y cada lectura posterior forzaba un
 * reflujo sincrónico: doce reflujos por cuadro en un polígono de doce lados,
 * justo mientras se arrastra un vértice. Acá la medida entra al estado y el
 * papel se dibuja en el render siguiente, así todas las lecturas del cuadro
 * ocurren juntas y todas las escrituras después.
 *
 * Vive en la capa sin escalar, así que su cuerpo es constante en pantalla.
 *
 * @param {{x:number,y:number,texto:string,tono?:'cota'|'area'|'guia'}} props
 */
function RotuloLienzo({ x, y, texto, tono = 'cota' }) {
  const refTexto = useRef(/** @type {SVGTextElement|null} */ (null))
  const listas = useFuentesListas()
  const [papel, setPapel] = useState(
    /** @type {{x:number,y:number,ancho:number,alto:number}|null} */ (null),
  )

  useLayoutEffect(() => {
    const nodo = refTexto.current
    if (!nodo) return
    let caja
    try {
      caja = nodo.getBBox()
    } catch {
      return
    }
    const siguiente = {
      x: caja.x - PAPEL_HOLGURA_X,
      y: caja.y - PAPEL_HOLGURA_Y,
      ancho: Math.max(caja.width + PAPEL_HOLGURA_X * 2, 0),
      alto: Math.max(caja.height + PAPEL_HOLGURA_Y * 2, 0),
    }
    setPapel((previo) =>
      previo &&
      previo.x === siguiente.x &&
      previo.y === siguiente.y &&
      previo.ancho === siguiente.ancho &&
      previo.alto === siguiente.alto
        ? previo
        : siguiente,
    )
  }, [texto, listas, tono])

  const tinta =
    tono === 'area'
      ? 'var(--color-navy-ink)'
      : tono === 'guia'
        ? 'var(--color-edge-guide)'
        : 'var(--color-cota)'

  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <rect
        x={papel ? papel.x : 0}
        y={papel ? papel.y : 0}
        width={papel ? papel.ancho : 0}
        height={papel ? papel.alto : 0}
        fill="var(--color-canvas-ground)"
        stroke="none"
      />
      <text
        ref={refTexto}
        x="0"
        y="0"
        textAnchor="middle"
        dominantBaseline="central"
        fill={tinta}
        className={tono === 'area' ? 'kb-num text-sm' : 'kb-num text-2xs'}
      >
        {texto}
      </text>
    </g>
  )
}

/**
 * Los cuatro ticks de registro con que esta edición marca lo seleccionado, en
 * versión de lienzo. Es la misma figura de `.kb-ticks`, dibujada con líneas
 * porque acá no hay caja de CSS donde colgar los fondos.
 *
 * @param {{x:number,y:number,lado?:number,brazo?:number}} props
 */
function TicksVertice({ x, y, lado = 12, brazo = 4 }) {
  const esquinas = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]
  // `--color-vertex-active` y no `--color-accent`: estos ticks son el único
  // indicador de qué vértice está seleccionado, o sea un objeto gráfico
  // esencial, y el naranja de rúbrica no llega a 3:1 sobre el papel del lienzo.
  // El token del lienzo sí.
  return (
    <g pointerEvents="none" stroke="var(--color-vertex-active)" strokeWidth="1" fill="none">
      {esquinas.map(([sx, sy]) => (
        <g key={`${sx}:${sy}`}>
          <line
            x1={x + sx * lado}
            y1={y + sy * lado}
            x2={x + sx * (lado - brazo)}
            y2={y + sy * lado}
          />
          <line
            x1={x + sx * lado}
            y1={y + sy * lado}
            x2={x + sx * lado}
            y2={y + sy * (lado - brazo)}
          />
        </g>
      ))}
    </g>
  )
}

/**
 * Corchetes de segmento seleccionado. En una edición reglada un corchete es la
 * marca de "esto de acá": encierra el segmento por sus dos extremos sin taparlo.
 *
 * @param {{a:{x:number,y:number},b:{x:number,y:number}}} props  puntos en pantalla
 */
function CorchetesSegmento({ a, b }) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const largo = Math.hypot(dx, dy)
  if (largo < 1) return null

  const ux = dx / largo
  const uy = dy / largo
  const nx = -uy
  const ny = ux
  const ala = 9
  const brazo = 5

  /**
   * @param {{x:number,y:number}} p @param {number} sentido
   * @returns {string}
   */
  function trazo(p, sentido) {
    const bx = ux * brazo * sentido
    const by = uy * brazo * sentido
    return [
      `M ${p.x + nx * ala + bx} ${p.y + ny * ala + by}`,
      `L ${p.x + nx * ala} ${p.y + ny * ala}`,
      `L ${p.x - nx * ala} ${p.y - ny * ala}`,
      `L ${p.x - nx * ala + bx} ${p.y - ny * ala + by}`,
    ].join(' ')
  }

  // Mismo criterio que en los ticks: la marca de lo seleccionado sobre el papel
  // del lienzo va en el tono que alcanza contraste, no en el naranja de marca.
  return (
    <g pointerEvents="none" fill="none" stroke="var(--color-vertex-active)" strokeWidth="1.5">
      <path d={trazo(a, 1)} />
      <path d={trazo(b, -1)} />
    </g>
  )
}

/* =============================================================================
   Lienzo
   ========================================================================== */

/**
 * Lienzo de dibujo del recinto activo. Se monta sin props: toma todo del estado
 * de la aplicación y publica sus cambios por las acciones. Incluye su propia
 * barra de herramientas, porque "ajustar vista" depende del tamaño medido del
 * lienzo y ese dato no sale de este componente.
 *
 * @param {{className?: string}} [props]
 */
export function Lienzo({ className } = {}) {
  const { estado, acciones, recinto, puedeDeshacer, puedeRehacer } = useApp()
  const { dibujo, unidadActiva } = estado

  const idAuto = useId()
  const idAyuda = `lienzo-ayuda-${idAuto}`

  const contenedorRef = useRef(/** @type {HTMLDivElement|null} */ (null))
  const svgRef = useRef(/** @type {SVGSVGElement|null} */ (null))

  const [tamano, setTamano] = useState({ ancho: 0, alto: 0 })
  const [cursorMm, setCursorMm] = useState(/** @type {{x:number,y:number}|null} */ (null))
  const [espacio, setEspacio] = useState(false)
  const [desplazando, setDesplazando] = useState(false)
  const [svgEnfocado, setSvgEnfocado] = useState(false)
  const [caret, setCaret] = useState(/** @type {{x:number,y:number}|null} */ (null))
  const [verticeEnfocado, setVerticeEnfocado] = useState(/** @type {string|null} */ (null))
  // Posición en curso del vértice que se está arrastrando. Vive acá y no en el
  // reductor: despachar en cada `pointermove` reconstruye el proyecto entero,
  // cambia la identidad del contexto y vuelve a renderizar TODA la aplicación
  // a 60 Hz, con la cubicación completa del recinto de vuelta —Gauss, prueba de
  // auto-intersección, módulo Cielo con sus notas— y una remedición del motor
  // de reglado encima. El arrastre se confina al subárbol del lienzo y al
  // reductor le llega una sola operación, al soltar, que además es el paso
  // único de deshacer que este código ya buscaba.
  const [arrastrePos, setArrastrePos] = useState(
    /** @type {{id:string,x:number,y:number}|null} */ (null),
  )

  const vista = dibujo.vista
  const unidad = obtenerUnidad(unidadActiva)
  // Un paso de grilla en cero o negativo dejaría el patrón sin lado y el imán
  // sin retícula. El respaldo sale de la tabla de unidades, no de un número
  // inventado acá.
  const pasoMm =
    Number.isFinite(dibujo.pasoGrillaMm) && dibujo.pasoGrillaMm > 0
      ? dibujo.pasoGrillaMm
      : unidad.pasoGrilla * unidad.mmPorUnidad

  const vertices = recinto ? recinto.verticesMm : []
  const cerrado = Boolean(recinto && recinto.cerrado && vertices.length >= 3)
  const dibujando = Boolean(recinto) && !cerrado

  /* --- espejos para los manejadores que no se recrean cada render ---------- */

  const vistaRef = useRef(vista)
  const tamanoRef = useRef(tamano)
  const verticesRef = useRef(vertices)
  const espacioRef = useRef(false)
  const sobreRef = useRef(false)
  const arrastreRef = useRef(/** @type {Object|null} */ (null))

  useEffect(() => {
    vistaRef.current = vista
    tamanoRef.current = tamano
    verticesRef.current = vertices
  })

  /* --- medición ------------------------------------------------------------ */

  useEffect(() => {
    const nodo = contenedorRef.current
    if (!nodo) return undefined

    function medir() {
      const caja = nodo.getBoundingClientRect()
      setTamano((previo) => {
        const ancho = Math.round(caja.width)
        const alto = Math.round(caja.height)
        if (previo.ancho === ancho && previo.alto === alto) return previo
        return { ancho, alto }
      })
    }

    medir()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir)
      return () => window.removeEventListener('resize', medir)
    }
    const observador = new ResizeObserver(medir)
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [])

  /* --- transformación de vista -------------------------------------------- */

  /**
   * Publica un cambio de vista y adelanta el espejo local. El espejo es lo que
   * permite acumular varios eventos de rueda dentro del mismo cuadro: sin él,
   * el segundo evento leería el zoom viejo y el acercamiento se atascaría.
   * @param {{x?:number,y?:number,zoom?:number}} parcial
   */
  const aplicarVista = useCallback(
    (parcial) => {
      vistaRef.current = { ...vistaRef.current, ...parcial }
      acciones.ajustarVista(parcial)
    },
    [acciones],
  )

  /**
   * Zoom centrado en un punto de pantalla: el milímetro que estaba bajo ese
   * punto sigue estando ahí después del cambio.
   * @param {number} px @param {number} py @param {number} factor
   */
  const zoomHacia = useCallback(
    (px, py, factor) => {
      const v = vistaRef.current
      const nuevo = acotarZoom(v.zoom * factor)
      if (nuevo === v.zoom) return
      const mundoX = (px - v.x) / v.zoom
      const mundoY = (py - v.y) / v.zoom
      aplicarVista({ zoom: nuevo, x: px - mundoX * nuevo, y: py - mundoY * nuevo })
    },
    [aplicarVista],
  )

  /** Encuadra la figura completa, o el origen del mundo si todavía no hay nada. */
  const encuadrar = useCallback(() => {
    const { ancho, alto } = tamanoRef.current
    if (ancho <= 0 || alto <= 0) return
    const vs = verticesRef.current

    if (vs.length === 0) {
      const zoom = acotarZoom(Math.min(ancho, alto) / MUNDO_VACIO_MM)
      aplicarVista({ zoom, x: ancho / 2, y: alto / 2 })
      return
    }

    const caja = boundingBox(vs)
    const utilAncho = Math.max(ancho - MARGEN_ENCUADRE_PX * 2, 1)
    const utilAlto = Math.max(alto - MARGEN_ENCUADRE_PX * 2, 1)

    let zoom
    if (caja.ancho <= 0 && caja.alto <= 0) {
      zoom = acotarZoom(Math.min(ancho, alto) / MUNDO_VACIO_MM)
    } else {
      const porAncho = caja.ancho > 0 ? utilAncho / caja.ancho : Infinity
      const porAlto = caja.alto > 0 ? utilAlto / caja.alto : Infinity
      zoom = acotarZoom(Math.min(porAncho, porAlto))
    }

    const centroX = (caja.minX + caja.maxX) / 2
    const centroY = (caja.minY + caja.maxY) / 2
    aplicarVista({ zoom, x: ancho / 2 - centroX * zoom, y: alto / 2 - centroY * zoom })
  }, [aplicarVista])

  // Encuadre automático la primera vez que se mide el lienzo y cada vez que se
  // cambia de recinto: abrir un proyecto guardado tiene que mostrar la planta,
  // no dejarla fuera de pantalla esperando que alguien apriete un botón.
  const recintoId = recinto ? recinto.id : null
  const encuadradoRef = useRef(/** @type {string|null} */ (null))
  useEffect(() => {
    if (tamano.ancho <= 0 || tamano.alto <= 0) return
    const clave = recintoId || 'sin-recinto'
    if (encuadradoRef.current === clave) return
    encuadradoRef.current = clave
    setCaret(null)
    encuadrar()
  }, [recintoId, tamano.ancho, tamano.alto, encuadrar])

  // El lienzo cambia de forma cuando Resultados toma la zona central y lo deja
  // como franja, y cuando se cruza un corte responsivo. Con la vista intacta la
  // planta queda fuera del recuadro y se ve un fragmento sin sentido. No se
  // reencuadra en cada cambio de tamaño, porque eso le borraría el zoom a quien
  // está midiendo un detalle: se reencuadra solo cuando la figura dejó de verse.
  useEffect(() => {
    const { ancho, alto } = tamano
    if (ancho <= 0 || alto <= 0) return
    const vs = verticesRef.current
    if (vs.length < 2) return

    const v = vistaRef.current
    const caja = boundingBox(vs)
    const x1 = caja.minX * v.zoom + v.x
    const y1 = caja.minY * v.zoom + v.y
    const x2 = caja.maxX * v.zoom + v.x
    const y2 = caja.maxY * v.zoom + v.y

    const solapeX = Math.max(0, Math.min(x2, ancho) - Math.max(x1, 0))
    const solapeY = Math.max(0, Math.min(y2, alto) - Math.max(y1, 0))
    const areaFigura = Math.max((x2 - x1) * (y2 - y1), 1)
    const visible = (solapeX * solapeY) / areaFigura

    if (visible < 0.25) encuadrar()
  }, [tamano, encuadrar])

  /* --- rueda del mouse ----------------------------------------------------- */

  // React registra `wheel` como oyente pasivo en la raíz, así que preventDefault
  // desde onWheel no surte efecto y la página termina desplazándose bajo el
  // dibujo. El oyente se instala a mano, no pasivo, sobre el propio <svg>.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return undefined

    /** @param {WheelEvent} evento */
    function alRodar(evento) {
      evento.preventDefault()
      const caja = svg.getBoundingClientRect()
      const bruto =
        evento.deltaMode === 1
          ? evento.deltaY * 16
          : evento.deltaMode === 2
            ? evento.deltaY * caja.height
            : evento.deltaY
      const acotado = Math.max(-240, Math.min(240, bruto))
      zoomHacia(evento.clientX - caja.left, evento.clientY - caja.top, Math.exp(-acotado * 0.0018))
    }

    svg.addEventListener('wheel', alRodar, { passive: false })
    return () => svg.removeEventListener('wheel', alRodar)
  }, [zoomHacia])

  /* --- barra espaciadora como modificador de desplazamiento ---------------- */

  useEffect(() => {
    /** @param {KeyboardEvent} evento */
    function abajo(evento) {
      if (evento.code !== 'Space' || evento.repeat) return
      // Dentro de un campo la barra escribe un espacio y no es de nadie más.
      if (esCampoEditable(evento.target)) return
      const activo = document.activeElement
      const enfocadoAca = activo === svgRef.current
      if (!sobreRef.current && !enfocadoAca) return
      // Solo se roba la barra cuando el foco está en el propio lienzo: sobre un
      // botón, la barra sigue siendo la tecla que lo acciona.
      if (enfocadoAca) evento.preventDefault()
      espacioRef.current = true
      setEspacio(true)
    }

    /** @param {KeyboardEvent} evento */
    function arriba(evento) {
      if (evento.code !== 'Space') return
      espacioRef.current = false
      setEspacio(false)
    }

    function soltar() {
      espacioRef.current = false
      setEspacio(false)
    }

    window.addEventListener('keydown', abajo)
    window.addEventListener('keyup', arriba)
    window.addEventListener('blur', soltar)
    return () => {
      window.removeEventListener('keydown', abajo)
      window.removeEventListener('keyup', arriba)
      window.removeEventListener('blur', soltar)
    }
  }, [])

  /* --- conversión de coordenadas ------------------------------------------ */

  /**
   * @param {number} clientX @param {number} clientY
   * @returns {{x:number,y:number}} punto en milímetros
   */
  const aMundo = useCallback((clientX, clientY) => {
    const svg = svgRef.current
    const v = vistaRef.current
    if (!svg) return { x: 0, y: 0 }
    const caja = svg.getBoundingClientRect()
    return { x: (clientX - caja.left - v.x) / v.zoom, y: (clientY - caja.top - v.y) / v.zoom }
  }, [])

  /**
   * Vista previa del imán y del modo ortogonal. Las mismas funciones que aplica
   * el estado al confirmar, así que la línea guía muestra exactamente el punto
   * que va a quedar marcado.
   * @param {{x:number,y:number}} punto
   * @param {{x:number,y:number}|null} desde
   * @returns {{x:number,y:number}}
   */
  const previsualizar = useCallback(
    (punto, desde) => {
      let q = punto
      if (dibujo.imanGrilla) {
        q = { x: ajustarAGrilla(q.x, pasoMm), y: ajustarAGrilla(q.y, pasoMm) }
      }
      if (dibujo.ortogonal && desde) q = restringirOrtogonal(desde, q)
      return q
    },
    [dibujo.imanGrilla, dibujo.ortogonal, pasoMm],
  )

  /* --- puntero ------------------------------------------------------------- */

  /** @param {import('react').PointerEvent<SVGSVGElement>} evento */
  function alBajarPuntero(evento) {
    const svg = svgRef.current
    if (!svg || arrastreRef.current) return

    const desplazar = evento.button === 1 || (evento.button === 0 && espacioRef.current)
    if (desplazar) {
      evento.preventDefault()
      svg.setPointerCapture(evento.pointerId)
      arrastreRef.current = {
        tipo: 'desplazar',
        pointerId: evento.pointerId,
        clienteX: evento.clientX,
        clienteY: evento.clientY,
        vistaX: vistaRef.current.x,
        vistaY: vistaRef.current.y,
      }
      setDesplazando(true)
      return
    }

    if (evento.button !== 0 || !recinto) return

    if (cerrado) {
      acciones.seleccionarVertice(null)
      acciones.seleccionarSegmento(null)
      return
    }

    const punto = aMundo(evento.clientX, evento.clientY)

    // Cierre por proximidad al primer vértice: además del clic sobre su propia
    // área de captura, se acepta caer cerca. La tolerancia es de pantalla.
    if (
      vertices.length >= 3 &&
      cercaDe(vertices[0], punto, TOL_CIERRE_PX / vistaRef.current.zoom)
    ) {
      acciones.cerrarPoligono()
      setCursorMm(null)
      return
    }

    acciones.agregarVertice(punto.x, punto.y)
    setCaret(null)
  }

  /** @param {import('react').PointerEvent<SVGSVGElement>} evento */
  function alMoverPuntero(evento) {
    const arrastre = arrastreRef.current

    if (arrastre && arrastre.tipo === 'desplazar') {
      aplicarVista({
        x: arrastre.vistaX + (evento.clientX - arrastre.clienteX),
        y: arrastre.vistaY + (evento.clientY - arrastre.clienteY),
      })
      return
    }

    if (arrastre && arrastre.tipo === 'vertice') {
      if (!arrastre.movido) {
        const recorrido = Math.hypot(
          evento.clientX - arrastre.clienteX,
          evento.clientY - arrastre.clienteY,
        )
        if (recorrido < UMBRAL_ARRASTRE_PX) return
        arrastre.movido = true
      }
      const punto = aMundo(evento.clientX, evento.clientY)
      // El imán se aplica acá, con la misma regla que aplicará el reductor al
      // soltar: si la vista previa no estuviera pegada a la grilla, el vértice
      // saltaría al levantar el dedo.
      const bruto = { x: punto.x + arrastre.dx, y: punto.y + arrastre.dy }
      const destino = dibujo.imanGrilla
        ? { x: ajustarAGrilla(bruto.x, pasoMm), y: ajustarAGrilla(bruto.y, pasoMm) }
        : bruto
      // Solo estado local: el reductor se entera al soltar.
      setArrastrePos({ id: arrastre.id, x: destino.x, y: destino.y })
      return
    }

    if (dibujando) setCursorMm(aMundo(evento.clientX, evento.clientY))
  }

  /** @param {import('react').PointerEvent<SVGSVGElement>} evento */
  function alSubirPuntero(evento) {
    const svg = svgRef.current
    const arrastre = arrastreRef.current
    if (!arrastre || arrastre.pointerId !== evento.pointerId) return
    arrastreRef.current = null

    if (svg && svg.hasPointerCapture(evento.pointerId)) {
      svg.releasePointerCapture(evento.pointerId)
    }

    if (arrastre.tipo === 'desplazar') {
      setDesplazando(false)
      return
    }

    // Un clic que no llegó a mover nada fue una selección, no un arrastre.
    if (arrastre.tipo === 'vertice' && arrastre.movido) {
      const punto = aMundo(evento.clientX, evento.clientY)
      // Una sola operación deshacible con el destino final. La geometría no se
      // tocó durante el arrastre, así que no hay nada que revertir antes.
      acciones.moverVertice(arrastre.id, punto.x + arrastre.dx, punto.y + arrastre.dy)
    }
    setArrastrePos(null)
  }

  /**
   * @param {import('react').PointerEvent<SVGCircleElement>} evento
   * @param {{id:string,x:number,y:number}} vertice
   * @param {number} indice
   */
  function alBajarSobreVertice(evento, vertice, indice) {
    if (evento.button !== 0 || espacioRef.current) return
    evento.stopPropagation()

    // Sobre el primer vértice, con tres o más marcados, el clic cierra: es el
    // gesto que todo el mundo espera de un polígono.
    if (dibujando && indice === 0 && vertices.length >= 3) {
      acciones.cerrarPoligono()
      setCursorMm(null)
      return
    }

    const svg = svgRef.current
    if (!svg) return
    const punto = aMundo(evento.clientX, evento.clientY)
    // La guía elástica se apaga mientras dura el arrastre: durante el arrastre el
    // cursor no la alimenta y quedaría colgada de una posición vieja.
    setCursorMm(null)
    svg.setPointerCapture(evento.pointerId)
    arrastreRef.current = {
      tipo: 'vertice',
      pointerId: evento.pointerId,
      id: vertice.id,
      origenX: vertice.x,
      origenY: vertice.y,
      clienteX: evento.clientX,
      clienteY: evento.clientY,
      movido: false,
      // Se conserva el desfase del agarre para que el vértice no salte bajo el
      // dedo al empezar a moverlo.
      dx: vertice.x - punto.x,
      dy: vertice.y - punto.y,
    }
    acciones.seleccionarVertice(vertice.id)
  }

  /* --- teclado ------------------------------------------------------------- */

  const ultimoVertice = vertices.length > 0 ? vertices[vertices.length - 1] : null

  /** Punto donde el teclado marcaría el próximo vértice. */
  const caretBase = useMemo(() => {
    if (ultimoVertice) return { x: ultimoVertice.x + pasoMm, y: ultimoVertice.y }
    const v = vista
    const centroX = (tamano.ancho / 2 - v.x) / v.zoom
    const centroY = (tamano.alto / 2 - v.y) / v.zoom
    return { x: ajustarAGrilla(centroX, pasoMm), y: ajustarAGrilla(centroY, pasoMm) }
  }, [ultimoVertice, pasoMm, vista, tamano.ancho, tamano.alto])

  const caretPunto = caret || caretBase

  /** @param {import('react').KeyboardEvent<SVGSVGElement>} evento */
  function alTeclearLienzo(evento) {
    // Ctrl+Z, Ctrl+Y y compañía son atajos globales de la aplicación.
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return
    const tecla = evento.key
    const salto = evento.shiftKey ? pasoMm * PASOS_TECLA_RAPIDA : pasoMm

    if (tecla === 'f' || tecla === 'F') {
      evento.preventDefault()
      encuadrar()
      return
    }
    if (tecla === '+' || tecla === '=') {
      evento.preventDefault()
      zoomHacia(tamano.ancho / 2, tamano.alto / 2, 1.25)
      return
    }
    if (tecla === '-' || tecla === '_') {
      evento.preventDefault()
      zoomHacia(tamano.ancho / 2, tamano.alto / 2, 0.8)
      return
    }

    if (!dibujando) return

    if (tecla === 'a' || tecla === 'A') {
      evento.preventDefault()
      acciones.agregarVertice(caretPunto.x, caretPunto.y)
      setCaret(null)
      return
    }

    const paso = {
      ArrowLeft: [-salto, 0],
      ArrowRight: [salto, 0],
      ArrowUp: [0, -salto],
      ArrowDown: [0, salto],
    }[tecla]
    if (!paso) return
    evento.preventDefault()
    setCaret({ x: caretPunto.x + paso[0], y: caretPunto.y + paso[1] })
  }

  /**
   * @param {import('react').KeyboardEvent<SVGCircleElement>} evento
   * @param {{id:string,x:number,y:number}} vertice
   */
  function alTeclearVertice(evento, vertice) {
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return
    const tecla = evento.key

    if (tecla === 'Delete' || tecla === 'Backspace') {
      evento.preventDefault()
      evento.stopPropagation()
      acciones.eliminarVertice(vertice.id)
      return
    }

    // Enter alterna la selección del vértice. Es la activación explícita que un
    // manipulador necesita, y no compite con la barra espaciadora, que en el
    // lienzo es el modificador de desplazamiento.
    if (tecla === 'Enter') {
      evento.preventDefault()
      evento.stopPropagation()
      acciones.seleccionarVertice(dibujo.verticeSel === vertice.id ? null : vertice.id)
      return
    }

    const salto = evento.shiftKey ? pasoMm * PASOS_TECLA_RAPIDA : pasoMm
    const paso = {
      ArrowLeft: [-salto, 0],
      ArrowRight: [salto, 0],
      ArrowUp: [0, -salto],
      ArrowDown: [0, salto],
    }[tecla]
    if (!paso) return
    evento.preventDefault()
    evento.stopPropagation()
    acciones.moverVertice(vertice.id, vertice.x + paso[0], vertice.y + paso[1])
  }

  /* --- datos derivados del dibujo ------------------------------------------ */

  // Los vértices que se DIBUJAN: los del recinto, con el que se está
  // arrastrando corrido a su posición en curso. El modelo no cambia hasta que
  // se suelta; el dibujo, la cota y el área sí siguen al dedo.
  const verticesVista = useMemo(() => {
    if (!arrastrePos) return vertices
    let tocado = false
    const salida = vertices.map((vertice) => {
      if (vertice.id !== arrastrePos.id) return vertice
      tocado = true
      return { ...vertice, x: arrastrePos.x, y: arrastrePos.y }
    })
    return tocado ? salida : vertices
  }, [vertices, arrastrePos])

  const segmentos = useMemo(() => segmentosDe(verticesVista, cerrado), [verticesVista, cerrado])
  const cruzados = useMemo(() => segmentosCruzados(segmentos, cerrado), [segmentos, cerrado])
  // `segmentosCruzados` ya recorre TODOS los pares no adyacentes con la misma
  // semántica que `esAutoIntersectante`: la segunda pasada no puede encontrar
  // nada que la primera no haya encontrado, y en el caso corriente —el polígono
  // sin cruces— el `||` no cortaba y se pagaba un segundo barrido cuadrático
  // completo en cada recálculo.
  const hayCruce = cruzados.size > 0
  const area = useMemo(
    () => (cerrado ? areaDeVertices(verticesVista) : 0),
    [verticesVista, cerrado],
  )
  const centro = useMemo(
    () => (cerrado ? centroide(verticesVista) : null),
    [verticesVista, cerrado],
  )

  /* --- despiece del módulo -------------------------------------------------- */

  // El lienzo NO sabe qué es una plancha ni un perfil. Le pide al módulo del
  // recinto sus capas de despiece —geometría en milímetros y un rol de dibujo—
  // y las pinta con las tintas del sistema. Un módulo sin `trazar` devuelve
  // una lista vacía y acá no cambia nada.
  //
  // Los interruptores NO entran en este memo: se sigue calculando el trazado
  // con el despiece apagado, y a propósito. Es lo que permite que el título del
  // detente distinga "apagado" de "no hay nada que repartir", y encender vuelve
  // a mostrar la retícula sin recalcular hasta mil quinientas piezas justo en
  // el cuadro del clic. El costo es un memo que ya solo corre cuando cambia el
  // recinto o la biblioteca.
  const trazado = useMemo(
    () => (cerrado ? trazadoDeRecinto(recinto, estado.biblioteca) : []),
    [cerrado, recinto, estado.biblioteca],
  )

  // LOS EJES VAN PRIMERO Y LAS PIEZAS ENCIMA. No es una preferencia estética:
  // el largo útil de una plancha suele ser múltiplo exacto de la separación
  // entre ejes —2400 con 40 cm, 3000 con 60 cm—, así que TODA junta del lado
  // largo cae justo sobre un eje. Con las capas al revés el ámbar del eje se
  // pintaba encima y la plancha parecía dividida solo a lo ancho, sin ninguna
  // línea de largo. Arriba queda la junta, que es por donde se corta.
  const trazadoVisible = useMemo(
    () =>
      trazado
        .filter((capa) => (capa.rol === 'eje' ? dibujo.verEjes : dibujo.verPiezas))
        .sort((a, b) => Number(a.rol === 'pieza') - Number(b.rol === 'pieza')),
    [trazado, dibujo.verPiezas, dibujo.verEjes],
  )

  // ¿El módulo de este recinto dibuja despiece? Se pregunta sin ejecutar
  // `trazar`, así que la respuesta no depende de si el polígono está cerrado ni
  // de si hay materiales elegidos. Un módulo que no dibuja no aporta ningún
  // interruptor a la barra.
  const moduloTraza = useMemo(() => moduloTrazaDe(recinto), [recinto])

  // Una entrada por rol de dibujo. `hay` distingue "lo apagaste" de "todavía no
  // hay nada que repartir", y el título del detente dice cuál de las dos es.
  //
  // Los interruptores existen ANTES de que haya algo que mostrar: si aparecieran
  // recién al cerrar el polígono, la barra cambiaría de forma bajo el cursor y
  // el usuario perdería una herramienta que ya había ubicado con la vista. El
  // rótulo lo pone el módulo cuando ya trazó; mientras tanto va el genérico del
  // vocabulario de dibujo.
  const capasTrazado = useMemo(() => {
    if (!moduloTraza) return []
    const porRol = new Map(trazado.map((capa) => [capa.rol, capa]))
    return [
      { rol: 'pieza', respaldo: 'Piezas', activo: dibujo.verPiezas },
      { rol: 'eje', respaldo: 'Ejes', activo: dibujo.verEjes },
    ].map((entrada) => {
      const capa = porRol.get(entrada.rol)
      return {
        rol: entrada.rol,
        rotulo: capa ? capa.rotulo : entrada.respaldo,
        activo: entrada.activo,
        hay: Boolean(capa),
      }
    })
  }, [moduloTraza, trazado, dibujo.verPiezas, dibujo.verEjes])

  /** @param {{x:number,y:number}} p @returns {{x:number,y:number}} */
  const aPantalla = useCallback(
    (p) => ({ x: p.x * vista.zoom + vista.x, y: p.y * vista.zoom + vista.y }),
    [vista],
  )

  /* --- grilla -------------------------------------------------------------- */

  const idMenor = `grilla-menor-${idAuto}`
  const idMayor = `grilla-mayor-${idAuto}`
  const idRecorte = `recorte-planta-${idAuto}`

  const celdaPx = pasoMm * vista.zoom
  const mostrarMenor = celdaPx >= CELDA_MINIMA_PX
  const mostrarMayor = celdaPx * PASOS_POR_LINEA_MAYOR >= CELDA_MINIMA_PX
  const pasoMayorMm = pasoMm * PASOS_POR_LINEA_MAYOR

  // Rectángulo de mundo visible, holgado en una celda mayor por lado para que el
  // patrón no se corte al desplazar.
  const mundoVisible = useMemo(() => {
    const holgura = pasoMayorMm
    const minX = (0 - vista.x) / vista.zoom - holgura
    const minY = (0 - vista.y) / vista.zoom - holgura
    const maxX = (tamano.ancho - vista.x) / vista.zoom + holgura
    const maxY = (tamano.alto - vista.y) / vista.zoom + holgura
    return { x: minX, y: minY, ancho: Math.max(maxX - minX, 0), alto: Math.max(maxY - minY, 0) }
  }, [vista, tamano.ancho, tamano.alto, pasoMayorMm])

  /* --- guía elástica -------------------------------------------------------- */

  const guia = useMemo(() => {
    if (!dibujando || !ultimoVertice || !cursorMm || arrastreRef.current) return null
    const destino = previsualizar(cursorMm, ultimoVertice)
    const largo = Math.hypot(destino.x - ultimoVertice.x, destino.y - ultimoVertice.y)
    if (largo <= 0) return null
    return {
      desde: ultimoVertice,
      hasta: destino,
      largoMm: largo,
      medio: { x: (ultimoVertice.x + destino.x) / 2, y: (ultimoVertice.y + destino.y) / 2 },
    }
  }, [dibujando, ultimoVertice, cursorMm, previsualizar])

  /* --- render -------------------------------------------------------------- */

  const trazoMundo = vista.zoom > 0 ? 1 / vista.zoom : 1
  const puntos = verticesVista.map((v) => `${v.x},${v.y}`).join(' ')
  const nombreRecinto = recinto ? recinto.nombre : 'sin recinto'

  const cursor = desplazando
    ? 'cursor-grabbing'
    : espacio
      ? 'cursor-grab'
      : dibujando
        ? 'cursor-crosshair'
        : 'cursor-default'

  return (
    <div
      className={['flex h-full w-full min-h-0 min-w-0 flex-col bg-canvas-ground', className]
        .filter(Boolean)
        .join(' ')}
    >
      {/* La franja de herramientas va en el FLUJO, arriba del papel. Apilada
          sobre el dibujo se envolvía en varias filas y se quedaba con los clics
          de la esquina superior izquierda del lienzo. */}
      <LienzoControles
        className="shrink-0"
        imanGrilla={dibujo.imanGrilla}
        onImanGrilla={acciones.alternarIman}
        ortogonal={dibujo.ortogonal}
        onOrtogonal={acciones.alternarOrtogonal}
        capasTrazado={capasTrazado}
        onCapaTrazado={acciones.alternarCapaTrazado}
        onAjustarVista={encuadrar}
        puedeDeshacer={puedeDeshacer}
        onDeshacer={acciones.deshacer}
        puedeRehacer={puedeRehacer}
        onRehacer={acciones.rehacer}
        puedeLimpiar={vertices.length > 0}
        onLimpiar={acciones.limpiarDibujo}
        pasoGrillaMm={pasoMm}
        onPasoGrilla={acciones.cambiarPasoGrilla}
        unidadActiva={unidad.id}
        totalVertices={vertices.length}
        cerrado={cerrado}
        onCerrarPoligono={acciones.cerrarPoligono}
        deshabilitado={!recinto}
      />

      <div ref={contenedorRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          role="application"
          tabIndex={0}
          aria-label={`Lienzo de dibujo de la planta del recinto ${nombreRecinto}. Medidas en ${unidad.nombre}.`}
          aria-describedby={idAyuda}
          // Sin viewBox: una unidad de usuario es un píxel del lienzo y la
          // transformación de vista es la única que interviene. Un viewBox
          // calculado del tamaño medido llegaría siempre un cuadro atrasado al
          // redimensionar y el dibujo se estiraría en el intertanto.
          className={`absolute inset-0 h-full w-full touch-none select-none ${cursor}`}
          onMouseDown={(evento) => {
            // El botón central abre el desplazamiento automático del navegador si
            // no se lo detiene en su propio evento.
            if (evento.button === 1) evento.preventDefault()
          }}
          onAuxClick={(evento) => {
            if (evento.button === 1) evento.preventDefault()
          }}
          onPointerDown={alBajarPuntero}
          onPointerMove={alMoverPuntero}
          onPointerUp={alSubirPuntero}
          onPointerCancel={alSubirPuntero}
          onPointerEnter={() => {
            sobreRef.current = true
          }}
          onPointerLeave={() => {
            sobreRef.current = false
            setCursorMm(null)
          }}
          onKeyDown={alTeclearLienzo}
          onFocus={(evento) => {
            if (evento.target === svgRef.current) setSvgEnfocado(true)
          }}
          onBlur={(evento) => {
            if (evento.target === svgRef.current) setSvgEnfocado(false)
          }}
        >
          <defs>
            <pattern id={idMenor} width={pasoMm} height={pasoMm} patternUnits="userSpaceOnUse">
              <path
                d={`M ${pasoMm} 0 L 0 0 L 0 ${pasoMm}`}
                fill="none"
                stroke="var(--color-grid-minor)"
                strokeWidth={trazoMundo}
              />
            </pattern>
            <pattern
              id={idMayor}
              width={pasoMayorMm}
              height={pasoMayorMm}
              patternUnits="userSpaceOnUse"
            >
              {mostrarMenor ? (
                <rect width={pasoMayorMm} height={pasoMayorMm} fill={`url(#${idMenor})`} />
              ) : null}
              <path
                d={`M ${pasoMayorMm} 0 L 0 0 L 0 ${pasoMayorMm}`}
                fill="none"
                stroke="var(--color-grid-major)"
                strokeWidth={trazoMundo}
              />
            </pattern>

            {/* Recorte del despiece contra la planta. El módulo emite su
              retícula completa sobre el rectángulo envolvente y el recorte lo
              resuelve el compositor del navegador: intersectar a mano cada
              rectángulo con un polígono cóncavo cualquiera es un problema de
              geometría computacional entero, y acá no aporta nada.

              Va sobre `puntos`, que es la planta EN CURSO: durante un arrastre
              el recorte sigue al dedo aunque la retícula de adentro esté
              congelada en la geometría guardada. */}
            {cerrado ? (
              <clipPath id={idRecorte} clipPathUnits="userSpaceOnUse">
                <polygon points={puntos} />
              </clipPath>
            ) : null}
          </defs>

          {/* Fondo: además de dar el papel, es lo que recibe el clic en el vacío.
            Un <svg> sin contenido pintado no dispara eventos de puntero. */}
          <rect x="0" y="0" width="100%" height="100%" fill="var(--color-canvas-ground)" />

          {/* Capa escalada: mundo en milímetros, trazo dividido por el zoom. */}
          <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.zoom})`}>
            {mostrarMayor && tamano.ancho > 0 ? (
              <rect
                x={mundoVisible.x}
                y={mundoVisible.y}
                width={mundoVisible.ancho}
                height={mundoVisible.alto}
                fill={`url(#${idMayor})`}
                pointerEvents="none"
              />
            ) : null}

            {/* Origen del mundo: la referencia de las coordenadas que se escriben
              a mano en la pestaña Geometría. */}
            <g pointerEvents="none" stroke="var(--color-grid-major)" strokeWidth={trazoMundo}>
              <line x1={-14 * trazoMundo} y1="0" x2={14 * trazoMundo} y2="0" />
              <line x1="0" y1={-14 * trazoMundo} x2="0" y2={14 * trazoMundo} />
            </g>

            {cerrado ? (
              <polygon
                points={puntos}
                fill="var(--color-poly-fill)"
                stroke="none"
                pointerEvents="none"
              />
            ) : null}

            {/* Despiece del módulo: va SOBRE el relleno y BAJO las aristas y las
              cotas. Es información de segundo plano —ordena la lectura de la
              planta, no la define—, así que nunca puede taparle el contorno ni
              robarle un clic a un vértice. */}
            {cerrado && trazadoVisible.length > 0 ? (
              <g clipPath={`url(#${idRecorte})`} pointerEvents="none" aria-hidden="true">
                {trazadoVisible.map((capa) => {
                  const tinta =
                    capa.rol === 'eje' ? 'var(--color-layout-eje)' : 'var(--color-layout-pieza)'
                  return (
                    <g key={capa.clave} stroke={tinta} strokeWidth={trazoMundo} fill="none">
                      {capa.rectangulos.map((pieza, i) => (
                        <rect
                          key={`${capa.clave}-r${i}`}
                          x={pieza.x}
                          y={pieza.y}
                          width={pieza.ancho}
                          height={pieza.alto}
                        />
                      ))}
                      {capa.lineas.map((eje, i) => (
                        <line
                          key={`${capa.clave}-l${i}`}
                          x1={eje.x1}
                          y1={eje.y1}
                          x2={eje.x2}
                          y2={eje.y2}
                        />
                      ))}
                    </g>
                  )
                })}
              </g>
            ) : null}

            {segmentos.map((seg) => {
              const cruzado = cruzados.has(seg.indice)
              const elegido = dibujo.segmentoSel === seg.indice
              return (
                <g key={`seg-${seg.indice}`}>
                  <line
                    x1={seg.a.x}
                    y1={seg.a.y}
                    x2={seg.b.x}
                    y2={seg.b.y}
                    stroke={cruzado ? 'var(--color-error)' : 'var(--color-edge)'}
                    strokeWidth={(elegido ? 2 : 1) * trazoMundo}
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                  {/* Franja de captura: seleccionar un segmento con el dedo exige
                    más ancho que el filete de un píxel que se ve. */}
                  <line
                    x1={seg.a.x}
                    y1={seg.a.y}
                    x2={seg.b.x}
                    y2={seg.b.y}
                    stroke="transparent"
                    strokeWidth={RADIO_CAPTURA_PX * trazoMundo}
                    pointerEvents={cerrado ? 'stroke' : 'none'}
                    onPointerDown={(evento) => {
                      if (evento.button !== 0 || espacioRef.current) return
                      evento.stopPropagation()
                      acciones.seleccionarSegmento(seg.indice)
                    }}
                  />
                </g>
              )
            })}

            {guia ? (
              <line
                x1={guia.desde.x}
                y1={guia.desde.y}
                x2={guia.hasta.x}
                y2={guia.hasta.y}
                stroke="var(--color-edge-guide)"
                strokeWidth={trazoMundo}
                strokeDasharray={`${6 * trazoMundo} ${4 * trazoMundo}`}
                pointerEvents="none"
              />
            ) : null}
          </g>

          {/* Capa sin escalar: todo lo que debe medir lo mismo a cualquier zoom.
            La posición se multiplica por el zoom a mano. */}
          <g>
            {segmentos.map((seg) => {
              if (seg.largoMm * vista.zoom < COTA_MINIMA_PX) return null
              const medio = aPantalla(seg.medio)
              return (
                <RotuloLienzo
                  key={`cota-${seg.indice}`}
                  x={medio.x}
                  y={medio.y}
                  texto={formatearLongitud(seg.largoMm, unidad.id, { conUnidad: true })}
                />
              )
            })}

            {dibujo.segmentoSel !== null && segmentos[dibujo.segmentoSel] ? (
              <CorchetesSegmento
                a={aPantalla(segmentos[dibujo.segmentoSel].a)}
                b={aPantalla(segmentos[dibujo.segmentoSel].b)}
              />
            ) : null}

            {guia ? (
              <RotuloLienzo
                x={aPantalla(guia.medio).x}
                y={aPantalla(guia.medio).y}
                tono="guia"
                texto={formatearLongitud(guia.largoMm, unidad.id, { conUnidad: true })}
              />
            ) : null}

            {cerrado && centro && area > 0 ? (
              <RotuloLienzo
                x={aPantalla(centro).x}
                y={aPantalla(centro).y}
                tono="area"
                texto={`${formatearArea(area)} m²`}
              />
            ) : null}

            {/* Cursor de teclado: solo aparece cuando el lienzo tiene el foco, que
              es cuando las flechas y la tecla A significan algo. */}
            {svgEnfocado && dibujando ? (
              <g pointerEvents="none">
                <Cruz
                  size={14}
                  color="var(--color-accent)"
                  x={aPantalla(caretPunto).x - 7}
                  y={aPantalla(caretPunto).y - 7}
                />
                <RotuloLienzo
                  x={aPantalla(caretPunto).x}
                  y={aPantalla(caretPunto).y + 18}
                  tono="guia"
                  texto={`${formatearLongitud(caretPunto.x, unidad.id)} · ${formatearLongitud(
                    caretPunto.y,
                    unidad.id,
                  )} ${unidad.label}`}
                />
              </g>
            ) : null}

            {verticesVista.map((vertice, indice) => {
              const p = aPantalla(vertice)
              const seleccionado = dibujo.verticeSel === vertice.id
              const enfocado = verticeEnfocado === vertice.id
              const esCierre = dibujando && indice === 0 && vertices.length >= 3
              const color =
                seleccionado || esCierre ? 'var(--color-vertex-active)' : 'var(--color-vertex)'

              return (
                <g key={vertice.id}>
                  {esCierre ? (
                    <rect
                      x={p.x - 11}
                      y={p.y - 11}
                      width="22"
                      height="22"
                      fill="none"
                      stroke="var(--color-vertex-active)"
                      strokeWidth="1"
                      strokeDasharray="3 2"
                      pointerEvents="none"
                    />
                  ) : null}

                  <Cruz size={16} color={color} x={p.x - 8} y={p.y - 8} pointerEvents="none" />

                  {seleccionado ? <TicksVertice x={p.x} y={p.y} /> : null}

                  {/* Marca de foco dibujada a mano. El `outline` de `:focus-visible`
                    sobre una figura SVG llegó tarde y desigual a los
                    navegadores, y este manipulador no puede quedarse sin marca
                    de foco visible en ninguno. */}
                  {enfocado ? (
                    <rect
                      x={p.x - 13}
                      y={p.y - 13}
                      width="26"
                      height="26"
                      fill="none"
                      stroke="var(--color-focus)"
                      strokeWidth="2"
                      pointerEvents="none"
                    />
                  ) : null}

                  {/* Área de captura transparente: 32 px de diámetro, cómoda con el
                    dedo. Es además el objetivo de tabulación de cada vértice.

                    NO es un `button`: un botón promete a un lector de pantalla
                    que Enter y Espacio lo accionan, y acá Espacio ya es el
                    modificador de desplazamiento del lienzo. Es un manipulador
                    arrastrable con posición editable, y así se anuncia. */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={RADIO_CAPTURA_PX}
                    fill="transparent"
                    pointerEvents="all"
                    tabIndex={0}
                    role="img"
                    aria-roledescription="vértice arrastrable"
                    className="cursor-move outline-none"
                    aria-label={
                      esCierre
                        ? `Vértice 1 de ${vertices.length}. Cierra el polígono acá.`
                        : `Vértice ${indice + 1} de ${vertices.length}. X ${formatearLongitud(
                            vertice.x,
                            unidad.id,
                            { conUnidad: true },
                          )}, Y ${formatearLongitud(vertice.y, unidad.id, { conUnidad: true })}.`
                    }
                    onPointerDown={(evento) => alBajarSobreVertice(evento, vertice, indice)}
                    onFocus={() => {
                      setVerticeEnfocado(vertice.id)
                      acciones.seleccionarVertice(vertice.id)
                    }}
                    onBlur={() =>
                      setVerticeEnfocado((previo) => (previo === vertice.id ? null : previo))
                    }
                    onKeyDown={(evento) => alTeclearVertice(evento, vertice)}
                  />
                </g>
              )
            })}
          </g>
        </svg>

        {/* Estado vacío: la instrucción va sobre el papel, sin robarle el clic. */}
        {recinto && vertices.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <p className="kb-prose border border-rule bg-block px-4 py-3 text-center">
              Haz clic en la grilla para marcar el primer vértice.
            </p>
          </div>
        ) : null}

        {hayCruce ? (
          <div className="absolute bottom-3 left-3 z-20 max-w-lg">
            <Aviso nivel="advertencia" titulo="Polígono cruzado">
              El polígono se cruza a sí mismo. El área puede ser incorrecta.
            </Aviso>
          </div>
        ) : null}
      </div>

      {/* Con el dedo, la acción que cierra el trabajo vive al pie del lienzo y
          no en el borde superior de la pantalla: ahí llega el pulgar. El
          envoltorio es el que decide si la franja existe, para que la pareja
          `hidden` / `pointer-coarse:flex` quede sobre un solo elemento. */}
      <div className="hidden shrink-0 justify-end border-t border-rule-strong bg-margin px-2 py-1 pointer-coarse:flex">
        <AccionCerrar
          totalVertices={vertices.length}
          cerrado={cerrado}
          deshabilitado={!recinto}
          onCerrarPoligono={acciones.cerrarPoligono}
        />
      </div>

      {/* Ruta equivalente de teclado, declarada donde el lector de pantalla la
          encuentra: es la descripción del propio lienzo. */}
      <p id={idAyuda} className="sr-only">
        Lienzo de planta con grilla en {unidad.nombre}. Con el lienzo enfocado, las flechas mueven
        el cursor de teclado un paso de grilla, con Mayúsculas se mueve cinco pasos, la tecla A
        marca un vértice en ese punto, la tecla F ajusta la vista a la figura, más y menos acercan y
        alejan, y Enter cierra el polígono. Con el tabulador se recorren los vértices ya marcados:
        las flechas mueven el vértice enfocado y Suprimir lo elimina. La pestaña Geometría ofrece la
        misma edición en una tabla, con las coordenadas de cada vértice y el largo de cada segmento
        escritos a mano.
        {/* El despiece se declara acá y no como elemento navegable: son hasta mil
            quinientas figuras sin nombre propio, y tabular por ellas sería una
            trampa. Lo que importa es qué hay dibujado y que no cambia números. */}
        {trazadoVisible.length > 0
          ? ` Dentro de la planta se dibuja el reparto del módulo: ${trazadoVisible
              .map(
                (capa) =>
                  `${capa.nombre || capa.clave}, ${
                    capa.rol === 'eje' ? 'como ejes' : 'como retícula de piezas'
                  }`,
              )
              .join('; ')}. Es una referencia de reparto para el trabajo en terreno: no altera ninguna cantidad de la cubicación, que se lee en la pestaña Resultados.`
          : ''}
        {/* Lo apagado se nombra una por una, porque el interruptor a buscar en
            la barra lleva ese mismo rótulo. */}
        {capasTrazado
          .filter((capa) => capa.hay && !capa.activo)
          .map(
            (capa) =>
              ` El dibujo de ${capa.rotulo.toLowerCase()} en la planta está apagado; se enciende con su interruptor en la barra de herramientas.`,
          )
          .join('')}
      </p>
    </div>
  )
}

export default Lienzo
