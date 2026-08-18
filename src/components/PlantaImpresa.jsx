/* =============================================================================
   Kubikar · planta impresa
   -----------------------------------------------------------------------------
   El dibujo del recinto para el papel: polígono, despiece, cotas y área. Nada
   más.

   No comparte código con `Lienzo.jsx` a propósito, y conviene dejar dicho por
   qué: el lienzo es una máquina de estados con vista, zoom, arrastre, foco,
   teclado, imán y medición de cotas en dos pasadas. Ninguna de esas siete cosas
   existe en una hoja de papel. Meterle un modo "solo lectura" habría obligado a
   defender cada una de ellas contra un caso que nunca ocurre; un dibujo estático
   con el `viewBox` calzado al recinto es corto y no se rompe.

   Dos consecuencias de dibujar para papel y no para pantalla:

   1. El trazo va con `vector-effect="non-scaling-stroke"`, así que mide un
      píxel del dispositivo de salida sea cual sea la escala del recinto. En el
      lienzo esto se resuelve dividiendo por el zoom; acá no hay zoom que dividir.
   2. El papel de las cotas se estima por cantidad de caracteres en vez de
      medirse con `getBBox`. Medir exige una pasada de layout y un segundo render,
      y en una hoja que se imprime una vez la estimación sobra.
   ============================================================================ */

import { areaMm2, boundingBox, centroide, segmentos } from '../core/geometry.js'
import { formatearArea, formatearLongitud } from '../core/units.js'

/** Aire alrededor del recinto, como fracción de su lado mayor. */
const MARGEN = 0.08

/**
 * Alto de texto de una cota, como fracción del lado mayor del recinto. Calibrado
 * para que una planta que ocupa el ancho útil de una hoja A4 imprima la cota
 * cerca de 9 pt, que es el piso legible de una lámina de terreno.
 */
const TEXTO = 1 / 62

/**
 * Planta del recinto para impresión.
 *
 * @param {Object} props
 * @param {Array} props.vertices          vértices del polígono, en mm
 * @param {boolean} props.cerrado
 * @param {Array} [props.capas]           capas de despiece que declaró el módulo
 * @param {string} [props.unidad]         unidad activa, solo para rotular cotas
 * @param {string} [props.etiqueta]       nombre accesible del dibujo
 */
export function PlantaImpresa({ vertices, cerrado, capas = [], unidad = 'cm', etiqueta }) {
  const puntos = Array.isArray(vertices) ? vertices : []
  if (puntos.length < 2) return null

  const bbox = boundingBox(puntos)
  const lado = Math.max(bbox.ancho, bbox.alto)
  if (!(lado > 0)) return null

  const aire = lado * MARGEN
  const vista = {
    x: bbox.minX - aire,
    y: bbox.minY - aire,
    ancho: bbox.ancho + aire * 2,
    alto: bbox.alto + aire * 2,
  }

  const texto = lado * TEXTO
  const lados = segmentos(puntos, cerrado)
  const centro = centroide(puntos)
  const trazo = puntos.map((v) => `${v.x},${v.y}`).join(' ')

  return (
    <svg
      viewBox={`${vista.x} ${vista.y} ${vista.ancho} ${vista.alto}`}
      className="block h-auto w-full"
      role="img"
      aria-label={etiqueta || 'Planta del recinto'}
    >
      {/* Despiece primero: ordena la lectura de la planta, no la define, y por
          eso va bajo las aristas y bajo las cotas. Dentro del despiece las
          piezas van encima de los ejes, porque las juntas del lado largo caen
          justo sobre un eje y al revés quedaban tapadas. */}
      {capas
        .filter((capa) => capa.rol === 'eje')
        .map((capa) => (
          <g key={capa.clave} className="text-layout-eje">
            {capa.lineas.map((l, i) => (
              <line
                key={i}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke="currentColor"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ))}

      {capas
        .filter((capa) => capa.rol === 'pieza')
        .map((capa) => (
          <g key={capa.clave} className="text-layout-pieza">
            {capa.rectangulos.map((r, i) => (
              <rect
                key={i}
                x={r.x}
                y={r.y}
                width={r.ancho}
                height={r.alto}
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ))}

      {/* El polígono. Cerrado lleva relleno; abierto es una polilínea y se dice
          con el trazo, no con un aviso al costado. */}
      {cerrado ? (
        <polygon
          points={trazo}
          className="fill-navy-soft text-edge"
          fillOpacity={0.35}
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <polyline
          points={trazo}
          className="text-edge"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Vértices: la misma cruz de registro del lienzo, a la escala del mundo. */}
      <g className="text-vertex" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke">
        {puntos.map((v) => (
          <g key={v.id}>
            <line x1={v.x - texto * 0.5} y1={v.y} x2={v.x + texto * 0.5} y2={v.y} />
            <line x1={v.x} y1={v.y - texto * 0.5} x2={v.x} y2={v.y + texto * 0.5} />
          </g>
        ))}
      </g>

      {/* Cotas. El papel detrás de cada cifra se estima por caracteres: en una
          hoja que se imprime una vez, medir con getBBox no paga su costo. */}
      {lados.map((lado_) => {
        const cifra = formatearLongitud(lado_.largoMm, unidad, { conUnidad: true })
        const ancho = cifra.length * texto * 0.52
        return (
          <g key={lado_.indice}>
            <rect
              x={lado_.medio.x - ancho / 2}
              y={lado_.medio.y - texto * 0.62}
              width={ancho}
              height={texto * 1.24}
              className="fill-block"
            />
            <text
              x={lado_.medio.x}
              y={lado_.medio.y}
              fontSize={texto}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-cota"
            >
              {cifra}
            </text>
          </g>
        )
      })}

      {cerrado && puntos.length >= 3 ? (
        <text
          x={centro.x}
          y={centro.y}
          fontSize={texto * 1.25}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-ink"
        >
          {`${formatearArea(areaMm2(puntos))} m²`}
        </text>
      ) : null}
    </svg>
  )
}

export default PlantaImpresa
