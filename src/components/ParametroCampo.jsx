/* =============================================================================
   Kubikar · un parámetro del esquema
   -----------------------------------------------------------------------------
   Este archivo traduce UNA entrada del esquema declarado por un módulo al
   control que le corresponde. Decide por `tipo` y por nada más: no sabe qué
   módulo lo llamó, no conoce ninguna clave de parámetro y no puede saberlas. Esa
   es la condición para que agregar Tabiquería, Pisos o Cerámicos no obligue a
   tocar una línea de interfaz.

     numero      → CampoNumero con min, max, paso, sufijo y valores rápidos
     porcentaje  → CampoNumero acotado a 0–100, con el mensaje de negativo
     material    → Selector alimentado por la biblioteca filtrada por tipo y uso
     booleano    → Interruptor
     seleccion   → Selector con las opciones declaradas

   Un selector de material vacío no es un callejón: se muestra deshabilitado, con
   el tipo que falta escrito, y con la salida concreta al lado, que es abrir la
   Biblioteca y cargar el material.
   ============================================================================ */

import { Library } from 'lucide-react'

import { parsearNumeroCL } from '../core/units.js'
import { materialesDe } from '../modules/registry.js'
import { Aviso } from '../ui/Aviso.jsx'
import { Boton } from '../ui/Boton.jsx'
import { CampoNumero } from '../ui/CampoNumero.jsx'
import { Interruptor } from '../ui/Interruptor.jsx'
import { Selector } from '../ui/Selector.jsx'

/** Mínimo y máximo de un porcentaje. El desperdicio vive siempre en este rango. */
const PORCENTAJE_MIN = 0
const PORCENTAJE_MAX = 100

/**
 * Un parámetro guardado puede venir como número o como texto en formato chileno
 * (un proyecto importado, un campo recién escrito). El control siempre recibe un
 * número o null: nunca `undefined` ni una cadena.
 * @param {*} valor
 * @returns {number|null}
 */
function aNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  return parsearNumeroCL(valor)
}

/**
 * @typedef {Object} PropsParametroCampo
 * @property {import('../modules/registry.js').EsquemaParametro} parametro
 * @property {*} valor
 * @property {(valor:*) => void} onChange
 * @property {Array} [biblioteca]
 * @property {() => void} [onAbrirBiblioteca]
 * @property {boolean} [deshabilitado]
 */

/**
 * Control de un parámetro declarado.
 * @param {PropsParametroCampo} props
 */
export function ParametroCampo({
  parametro,
  valor,
  onChange,
  biblioteca = [],
  onAbrirBiblioteca,
  deshabilitado = false,
}) {
  if (!parametro || typeof parametro !== 'object') return null

  switch (parametro.tipo) {
    case 'booleano':
      return (
        <Interruptor
          etiqueta={parametro.etiqueta}
          ayuda={parametro.ayuda}
          activo={valor === true}
          deshabilitado={deshabilitado}
          onChange={(activo) => onChange(activo)}
        />
      )

    case 'seleccion':
      return (
        <Selector
          etiqueta={parametro.etiqueta}
          ayuda={parametro.ayuda}
          valor={valor === undefined ? null : valor}
          opciones={Array.isArray(parametro.opciones) ? parametro.opciones : []}
          deshabilitado={deshabilitado}
          onChange={(elegido) => onChange(elegido)}
        />
      )

    case 'material': {
      const lista = Array.isArray(biblioteca) ? biblioteca : []
      const materiales = materialesDe(parametro, lista)

      // El material ya elegido se muestra siempre, aunque el filtro por uso lo
      // deje fuera: si el usuario reclasifica una pieza en la Biblioteca, el
      // parámetro que la usaba no puede quedarse con el selector en blanco sin
      // decir nada. Se ve lo que está cubicando y él decide si lo cambia.
      const elegido = typeof valor === 'string' && valor ? valor : null
      const ausente =
        elegido && !materiales.some((material) => material.id === elegido)
          ? lista.find((material) => material && material.id === elegido)
          : null

      const opciones = (ausente ? [ausente, ...materiales] : materiales).map((material) => ({
        valor: material.id,
        etiqueta: material.nombre,
      }))
      const vacia = opciones.length === 0

      return (
        <Selector
          etiqueta={parametro.etiqueta}
          ayuda={parametro.ayuda}
          valor={elegido}
          opciones={opciones}
          placeholder="Selecciona un material"
          // Con uso declarado el vacío se explica por el parámetro, no por el
          // tipo interno: "no hay materiales de tipo pieza" no le dice nada a
          // quien está buscando un tornillo de plancha.
          textoVacio={
            parametro.materialUso
              ? `No hay materiales para «${parametro.etiqueta}» en la biblioteca`
              : `No hay materiales de tipo ${parametro.materialTipo} en la biblioteca`
          }
          deshabilitado={deshabilitado}
          onChange={(id) => onChange(id)}
          pie={
            vacia && onAbrirBiblioteca ? (
              <Boton variante="secundaria" tamano="sm" icono={Library} onClick={onAbrirBiblioteca}>
                Cargar material en la Biblioteca
              </Boton>
            ) : null
          }
        />
      )
    }

    case 'porcentaje':
      return (
        <CampoNumero
          etiqueta={parametro.etiqueta}
          ayuda={parametro.ayuda}
          valor={aNumero(valor)}
          min={PORCENTAJE_MIN}
          max={PORCENTAJE_MAX}
          paso={Number.isFinite(parametro.paso) ? parametro.paso : 1}
          sufijo={parametro.sufijo || '%'}
          sugeridos={parametro.sugeridos}
          deshabilitado={deshabilitado}
          // El texto lo puede aportar el esquema: el día que Pintura declare un
          // "Rendimiento perdido %", el campo no puede seguir hablando de
          // desperdicio. El literal es el respaldo, no la regla.
          mensajeMin={parametro.mensajeMin || 'El desperdicio no puede ser negativo.'}
          mensajeMax={
            parametro.mensajeMax || 'El desperdicio no puede pasar de 100%. Revisa el valor.'
          }
          // El vacío se propaga tal cual. Convertirlo a 0 haría que borrar el
          // campo para reteclearlo lo rellene solo con un cero, que además es
          // un dato real que entra al cálculo: acá no se inventan valores. El
          // módulo ya trata el ausente como 0 al cubicar.
          onChange={(numero) => onChange(numero)}
        />
      )

    case 'numero':
      return (
        <CampoNumero
          etiqueta={parametro.etiqueta}
          ayuda={parametro.ayuda}
          valor={aNumero(valor)}
          min={parametro.min}
          max={parametro.max}
          paso={Number.isFinite(parametro.paso) ? parametro.paso : 1}
          sufijo={parametro.sufijo}
          sugeridos={parametro.sugeridos}
          deshabilitado={deshabilitado}
          mensajeMin={parametro.mensajeMin}
          mensajeMax={parametro.mensajeMax}
          // Un parámetro cuyo mínimo es mayor que cero no admite el vacío: la
          // separación entre ejes en blanco deja la perfilería sin cubicar. El
          // mensaje tiene que salir en el propio campo y no dos pestañas más
          // allá. Los que sí admiten cero —el descuento por vanos— no se marcan:
          // ahí el vacío es un cero legítimo y exigirlo sería un error falso.
          requerido={Number.isFinite(parametro.min) && parametro.min > 0}
          onChange={(numero) => onChange(numero)}
        />
      )

    default:
      // El registro valida el tipo al registrar el módulo, así que acá solo se
      // llega con un módulo cargado por fuera del contrato. Se declara en vez de
      // desaparecer en silencio: un parámetro invisible se cubica mal.
      return (
        <Aviso nivel="error" titulo={parametro.etiqueta || 'Parámetro desconocido'}>
          {`Este parámetro declara el tipo "${String(parametro.tipo)}", que esta versión no sabe mostrar. El recinto se puede cubicar, pero el valor no se puede ajustar desde acá.`}
        </Aviso>
      )
  }
}

export default ParametroCampo
