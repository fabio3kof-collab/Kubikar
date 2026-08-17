/* =============================================================================
   Kubikar · shell de la aplicación
   -----------------------------------------------------------------------------
   Este archivo hace dos cosas y nada más: arma la composición de tres zonas y
   enruta la vista activa. No conoce ningún módulo de cálculo, ningún material y
   ninguna clave de parámetro; todo eso vive en las zonas.

   LA COMPOSICIÓN

     ┌ BARRA SUPERIOR ───────────────────────────────────────────────────┐
     ├──────────────┬───────────────────────────────┬────────────────────┤
     │ clave del    │  bloque de medida: el lienzo  │ riel │ aparato     │
     │ margen izq.  │  manda toda la superficie     │      │             │
     └──────────────┴───────────────────────────────┴────────────────────┘

   Las tres zonas son pistas de una rejilla CSS medidas con los tokens
   estructurales, no anchos escritos a mano:

     --size-margin-left   clave numerada de recintos
     --size-rail          franja de detentes
     --size-margin-right  margen de aparato

   La pista central es `minmax(0, 1fr)`: el lienzo se queda con todo lo que
   sobre, que es exactamente la jerarquía del producto. El `minmax(0, …)` no es
   decorativo: sin él, una tabla ancha dentro del lienzo estiraría la pista y
   empujaría el aparato fuera de la pantalla.

   EL RESPONSIVO ES ESTRUCTURAL, NO FLUIDO

   No hay tipografía fluida ni anchos en porcentaje que se encojan hasta lo
   ilegible. Hay dos cortes, y en cada uno una pieza cambia de sitio entera:

     < 1180px  el margen de aparato baja: deja de ser una columna y pasa a ser
               una lámina inferior desplegable, con el riel convertido en tira
               horizontal de detentes (`orientacion="horizontal"`).
     <  900px  la clave de recintos se repliega en el desplegable que la barra
               superior ya publica. `PanelRecintos` se oculta solo; acá se
               retira además su pista, para que no quede una columna vacía.

   El lienzo nunca desaparece: es la única zona que sobrevive los dos cortes.

   El corte de 1180px se consulta con `matchMedia` y no solo con una variante
   CSS porque el cambio no es de pintura: la lámina se despliega y se repliega,
   y el riel cambia de orientación declarada (`aria-orientation`). Eso es
   estructura, y la estructura la decide el componente.

   DÓNDE VIVE CADA PESTAÑA

   Las tres viven en el margen de aparato, a la derecha del lienzo. Lo que cambia
   es cuánto margen piden.

   Geometría y Módulo son ENTRADA: acompañan al dibujo y les basta el margen
   normal de 24rem. Resultados es la SALIDA y necesita el bloque de medida MÁS su
   margen de anotación en la misma pista: la tabla de siete columnas a la
   izquierda y la memoria de cálculo encorchetada a la derecha. Con 24rem el
   motor de reglado no alcanza a trazar un corchete y la tabla se desplaza en
   horizontal justo sobre la columna que se compra.

   Por eso en esa pestaña la pista derecha pasa a `--size-margin-resultados`,
   que es `clamp(24rem, 42vw, 38rem)`. El lienzo se queda en la zona central en
   las tres pestañas y sigue siendo la pista más ancha: mandar es su trabajo, y
   una franja de 200 píxeles no es un lienzo, es una miniatura ilegible. El
   clamp existe para que ensanchar el aparato nunca deje al lienzo bajo lo
   usable. Bajo 1180px manda la lámina inferior, que ocupa el ancho completo y
   también le alcanza.
   ============================================================================ */

import { useCallback, useState, useSyncExternalStore } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { useApp } from './state/AppState.jsx'
import { AvisoAlmacenamiento } from './components/AvisoAlmacenamiento.jsx'
import { BarraSuperior } from './components/BarraSuperior.jsx'
import { BibliotecaMateriales } from './components/BibliotecaMateriales.jsx'
import { Lienzo } from './components/Lienzo.jsx'
import { PanelDerecho } from './components/PanelDerecho.jsx'
import { PanelRecintos } from './components/PanelRecintos.jsx'
import { SelectorProyecto } from './components/SelectorProyecto.jsx'
import { VistaConsolidado } from './components/VistaConsolidado.jsx'
import { EstadoVacio } from './ui/EstadoVacio.jsx'
import { Boton } from './ui/Boton.jsx'
import { Rotulo } from './ui/Rotulo.jsx'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/** Sobre este ancho el aparato es una columna; bajo él, una lámina inferior. */
const CONSULTA_AMPLIA = '(min-width: 1180px)'

/** Nombre visible de cada pestaña, para rotular la lámina replegada. */
const NOMBRE_PESTANA = {
  geometria: 'Geometría',
  modulo: 'Módulo',
  resultados: 'Resultados',
}

/**
 * Suscripción a una consulta de medios. Se lee con `useSyncExternalStore` para
 * que React tenga el valor correcto ya en el primer render y no haya un cuadro
 * con la composición equivocada.
 *
 * @param {string} consulta
 * @returns {boolean}
 */
function useConsultaDeMedios(consulta) {
  const suscribir = useCallback(
    /** @param {() => void} alCambiar */
    (alCambiar) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => {}
      }
      const lista = window.matchMedia(consulta)
      lista.addEventListener('change', alCambiar)
      return () => lista.removeEventListener('change', alCambiar)
    },
    [consulta],
  )

  const leer = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(consulta).matches
  }, [consulta])

  return useSyncExternalStore(suscribir, leer, () => false)
}

/**
 * Zona central: el bloque de medida. `min-h-0` y `min-w-0` son obligatorios
 * porque el lienzo se mide con `ResizeObserver` y un hijo de rejilla sin ellos
 * reclama el tamaño de su contenido en vez del de su pista.
 *
 * @param {{className?: string}} [props]
 */
function ZonaLienzo({ className } = {}) {
  return (
    <div className={cx('relative flex min-h-0 min-w-0 flex-col', className)}>
      <Lienzo />
    </div>
  )
}

/**
 * Lámina inferior desplegable con el aparato, para pantallas angostas.
 *
 * El tirador se queda siempre a la vista y dice en qué pestaña se está parado:
 * replegar el aparato no puede hacer que el usuario pierda el rastro de dónde
 * quedó. Al desplegarse aparece el riel como tira horizontal de detentes.
 *
 * @param {{abierta:boolean, onAlternar:() => void, pestana:string}} props
 */
function LaminaAparato({ abierta, onAlternar, pestana }) {
  const nombre = NOMBRE_PESTANA[pestana] || NOMBRE_PESTANA.geometria
  const Marca = abierta ? ChevronDown : ChevronUp

  return (
    <aside
      aria-label="Aparato del recinto"
      className="col-span-full row-start-2 flex min-h-0 flex-col border-t border-rule-strong bg-margin"
    >
      <h2>
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={abierta}
          aria-controls="lamina-aparato"
          className={cx(
            'flex w-full min-h-[var(--size-touch-sm)] items-center justify-between gap-3 px-3 py-2 text-left',
            'transition-[background-color] duration-[var(--duration-fast)] ease-damped',
            'hover:bg-margin-deep pointer-coarse:min-h-[var(--size-touch)]',
          )}
        >
          <span className="flex min-w-0 items-baseline gap-2">
            <Rotulo tinta="fuerte">Aparato</Rotulo>
            <span className="kb-label kb-label-rubric truncate">{nombre}</span>
          </span>
          <Marca size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-ink-2" />
        </button>
      </h2>

      {/* Replegada, la lámina no monta el aparato: un panel de altura cero
          seguiría en el orden de tabulación y el lector de pantalla lo leería
          igual. Desplegada se le da un techo, para que el lienzo conserve
          superficie útil incluso con la memoria de cálculo a la vista. */}
      {abierta ? (
        <div id="lamina-aparato" className="h-[45dvh] min-h-0 border-t border-rule">
          <PanelDerecho orientacion="horizontal" />
        </div>
      ) : null}
    </aside>
  )
}

/**
 * Composición de tres zonas. La rejilla cambia de forma en cada corte; las
 * zonas no saben en cuál están, salvo el aparato, que cambia de orientación.
 *
 * @param {{amplio:boolean, laminaAbierta:boolean, onAlternarLamina:() => void, pestana:string, centro:import('react').ReactNode, conAparato:boolean, margenAncho?:boolean}} props
 */
function Zonas({
  amplio,
  laminaAbierta,
  onAlternarLamina,
  pestana,
  centro,
  conAparato,
  margenAncho = false,
}) {
  return (
    <div
      className={cx(
        'grid min-h-0 flex-1',
        amplio
          ? cx(
              'grid-rows-[minmax(0,1fr)]',
              conAparato
                ? margenAncho
                  ? // Resultados: el margen se ensancha para que quepan la tabla
                    // y la anotación encorchetada. El lienzo sigue en la zona
                    // central y sigue siendo la pista más ancha; no se lo echa.
                    'grid-cols-[var(--size-margin-left)_minmax(0,1fr)_calc(var(--size-rail)_+_var(--size-margin-resultados))]'
                  : 'grid-cols-[var(--size-margin-left)_minmax(0,1fr)_calc(var(--size-rail)_+_var(--size-margin-right))]'
                : 'grid-cols-[var(--size-margin-left)_minmax(0,1fr)]',
            )
          : cx(
              // Bajo 900px la clave se repliega en la barra superior y su pista
              // se retira: `PanelRecintos` ya se oculta solo.
              'grid-cols-[var(--size-margin-left)_minmax(0,1fr)] max-[900px]:grid-cols-[minmax(0,1fr)]',
              conAparato ? 'grid-rows-[minmax(0,1fr)_auto]' : 'grid-rows-[minmax(0,1fr)]',
            ),
      )}
    >
      <PanelRecintos />

      {centro}

      {conAparato && amplio ? (
        <div className="flex min-h-0 min-w-0 flex-col border-l border-rule-strong">
          <PanelDerecho />
        </div>
      ) : null}

      {conAparato && !amplio ? (
        <LaminaAparato abierta={laminaAbierta} onAlternar={onAlternarLamina} pestana={pestana} />
      ) : null}
    </div>
  )
}

/**
 * Raíz de la aplicación.
 */
export function App() {
  const { estado, acciones } = useApp()
  const amplio = useConsultaDeMedios(CONSULTA_AMPLIA)
  const [laminaAbierta, setLaminaAbierta] = useState(false)

  const alternarLamina = useCallback(() => {
    setLaminaAbierta((previo) => !previo)
  }, [])

  /** @returns {import('react').ReactNode} */
  function cuerpo() {
    if (estado.cargando) {
      return (
        <div className="flex min-h-0 flex-1 items-start justify-center px-4 py-10">
          <p className="kb-prose">Cargando la información guardada en este navegador.</p>
        </div>
      )
    }

    if (estado.error) {
      return (
        <div className="mx-auto flex w-full max-w-[48rem] flex-col px-4 py-6">
          <EstadoVacio
            encuadrado
            nivelTitulo="h2"
            titulo="No se pudo abrir la información guardada."
            descripcion={estado.error}
            acciones={
              <Boton variante="primaria" onClick={() => window.location.reload()}>
                Reintentar
              </Boton>
            }
          />
        </div>
      )
    }

    if (estado.vista === 'biblioteca') {
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          <BibliotecaMateriales
            onVolver={() => acciones.cambiarVista(estado.proyecto ? 'recinto' : 'proyectos')}
          />
        </div>
      )
    }

    // Sin proyecto abierto no hay ni clave, ni lienzo, ni aparato que mostrar:
    // manda la vista de proyectos, sea cual sea la vista pedida.
    if (estado.vista === 'proyectos' || !estado.proyecto) {
      return (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SelectorProyecto />
        </div>
      )
    }

    if (estado.vista === 'consolidado') {
      return (
        <Zonas
          amplio={amplio}
          laminaAbierta={laminaAbierta}
          onAlternarLamina={alternarLamina}
          pestana={estado.pestana}
          conAparato={false}
          centro={
            <div className="min-h-0 min-w-0 overflow-y-auto">
              <VistaConsolidado />
            </div>
          }
        />
      )
    }

    // Resultados es la única pestaña que necesita bloque de medida más margen de
    // anotación en la misma pista, así que ensancha el margen. El lienzo se
    // queda en la zona central en las tres pestañas: mandar es su trabajo.
    const margenAncho = amplio && estado.pestana === 'resultados'

    return (
      <Zonas
        amplio={amplio}
        laminaAbierta={laminaAbierta}
        onAlternarLamina={alternarLamina}
        pestana={estado.pestana}
        conAparato
        margenAncho={margenAncho}
        centro={<ZonaLienzo />}
      />
    )
  }

  return (
    // La altura la fija el shell, no el documento: el lienzo se mide contra su
    // pista y ninguna zona puede empujar el largo de la página.
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-paper text-ink">
      <BarraSuperior />
      <AvisoAlmacenamiento />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{cuerpo()}</main>
    </div>
  )
}

export default App
