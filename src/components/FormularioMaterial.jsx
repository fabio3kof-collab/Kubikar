/* =============================================================================
   Kubikar · Formulario de material
   -----------------------------------------------------------------------------
   Alta y edición de un material de la biblioteca. Los campos dependen del tipo,
   porque una plancha, una barra y una pieza no se cubican con las mismas
   medidas: pedir "ancho" para un tornillo es pedir un dato que no existe.

   TRES REGLAS QUE ESTE ARCHIVO SOSTIENE

   1. CONVERSIÓN DE UNIDADES. Las medidas se ingresan y se muestran en la unidad
      activa (mm, cm o m), pero SIEMPRE se guardan en milímetros, que es la
      unidad base del producto. La conversión ocurre en dos puntos y en ningún
      otro: al abrir el formulario, `aUnidad(valorMm, unidad)` baja el dato
      guardado a la unidad de trabajo; al guardar, `aMilimetros(valor, unidad)`
      lo devuelve a milímetros. Entre medio, el estado de este formulario está
      en la unidad activa y nada más lo toca. Si la unidad cambia con el
      formulario abierto, los valores se reconvierten para que la cifra en
      pantalla siga midiendo lo mismo.

   2. UN PRECIO VACÍO SE GUARDA COMO `null`, NUNCA COMO 0. "Todavía no tengo el
      precio" y "vale cero" son cosas distintas en una cubicación: la primera
      deja la línea fuera del total y lo declara; la segunda mentiría con un
      total completo.

   3. LOS ERRORES NOMBRAN EL PROBLEMA Y LA SALIDA, y viajan a los campos por la
      prop `error` de cada primitiva, que ya los enlaza con `aria-describedby` y
      marca el control con `aria-invalid`.

   Este componente no persiste nada: entrega el material armado por `onGuardar`
   y quien lo monta decide qué hacer. El pie de botones lo pone el anfitrión
   (el diálogo de la Biblioteca) usando `idFormulario`; con `mostrarAcciones`
   el formulario dibuja su propio pie y sirve suelto.
   ============================================================================ */

import { useEffect, useId, useRef, useState } from 'react'

import { aMilimetros, aUnidad, obtenerUnidad } from '../core/units.js'
import { USOS_PIEZA, USO_PIEZA_POR_DEFECTO, nuevoMaterial } from '../data/schema.js'
import {
  Aviso,
  Boton,
  CampoNumero,
  CampoTexto,
  Regla,
  Rotulo,
  Selector,
} from '../ui/index.js'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/** Tipos de material, con el nombre con que se habla de ellos en obra. */
const OPCIONES_TIPO = [
  { valor: 'plancha', etiqueta: 'Plancha' },
  { valor: 'barra', etiqueta: 'Barra o perfil' },
  { valor: 'pieza', etiqueta: 'Pieza o accesorio' },
]

/**
 * Para qué sirve una pieza, con el nombre con que se pide en obra. El uso no
 * cambia cómo se cubica —eso lo decide el módulo— sino en qué parámetros se
 * ofrece el material: es lo que evita tener que buscar el tornillo entre los
 * alambres.
 */
const OPCIONES_USO = [
  { valor: 'fijacion_plancha', etiqueta: 'Fijación a plancha' },
  { valor: 'fijacion_metal', etiqueta: 'Fijación metal-metal' },
  { valor: 'colgante', etiqueta: 'Colgante' },
  { valor: 'general', etiqueta: 'Sin uso específico' },
]

/**
 * Quita el ruido de coma flotante que dejan las conversiones de unidad.
 * @param {number} n
 * @returns {number}
 */
function limpio(n) {
  return Math.round(n * 1e6) / 1e6
}

/**
 * Recorta un valor a los decimales que la unidad activa puede representar. Se
 * aplica al guardar, no al escribir: así lo que queda almacenado es exactamente
 * la cifra que el campo mostró después de normalizar el texto.
 * @param {number|null} valor
 * @param {number} decimales
 * @returns {number|null}
 */
function cuantizar(valor, decimales) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return null
  const factor = 10 ** Math.max(0, Math.min(6, decimales))
  return Math.round(valor * factor) / factor
}

/**
 * Milímetros guardados → unidad activa. El vacío se conserva vacío: `null` es
 * "no hay dato", y convertirlo a 0 inventaría una medida.
 * @param {number|null|undefined} valorMm
 * @param {string} unidadId
 * @returns {number|null}
 */
function desdeMm(valorMm, unidadId) {
  if (valorMm === null || valorMm === undefined || !Number.isFinite(valorMm)) return null
  return limpio(aUnidad(valorMm, unidadId))
}

/**
 * Unidad activa → milímetros, que es como se guarda toda medida en Kubikar.
 * @param {number|null|undefined} valor
 * @param {string} unidadId
 * @returns {number|null}
 */
function aMm(valor, unidadId) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return null
  return limpio(aMilimetros(valor, unidadId))
}

/**
 * @param {number|null} valor
 * @returns {boolean}
 */
function esPositivo(valor) {
  return valor !== null && Number.isFinite(valor) && valor > 0
}

/**
 * @typedef {Object} PropsFormularioMaterial
 * @property {Object|null} [material]      material a editar; `null` para uno nuevo
 * @property {string} [unidadActiva]       unidad de presentación de las medidas
 * @property {(material: Object) => void} onGuardar  recibe el material ya en mm
 * @property {() => void} [onCancelar]
 * @property {string} [idFormulario]       para el botón de envío del anfitrión
 * @property {boolean} [mostrarAcciones]   dibuja el pie de botones propio
 * @property {boolean} [guardando]
 * @property {string} [error]              falla externa al guardar
 * @property {string} [className]
 */

/**
 * Formulario de un material de la biblioteca.
 *
 * El estado interno se inicializa una sola vez: para editar otro material hay
 * que remontar el componente con `key`, que es como lo hace la Biblioteca.
 *
 * @param {PropsFormularioMaterial} props
 */
export function FormularioMaterial({
  material = null,
  unidadActiva = 'cm',
  onGuardar,
  onCancelar,
  idFormulario,
  mostrarAcciones = false,
  guardando = false,
  error,
  className,
}) {
  const idAuto = useId()
  const idForm = idFormulario || `material-${idAuto}`

  // Valores de fábrica del esquema: una plancha nueva llega con las medidas
  // comerciales corrientes ya cargadas, no con el formulario en blanco.
  const [inicial] = useState(() => material || nuevoMaterial('plancha'))
  const u = obtenerUnidad(unidadActiva)
  // Salto de las flechas del teclado en los campos de medida: un milímetro, un
  // centímetro o diez centímetros, según la unidad en que se esté trabajando.
  const pasoMedida = u.id === 'm' ? 0.1 : 1

  const [tipo, setTipo] = useState(inicial.tipo)
  const [nombre, setNombre] = useState(inicial.nombre || '')
  const [designacion, setDesignacion] = useState(inicial.designacion || '')
  const [uso, setUso] = useState(
    USOS_PIEZA.includes(inicial.uso) ? inicial.uso : USO_PIEZA_POR_DEFECTO,
  )
  const [desperdicio, setDesperdicio] = useState(
    Number.isFinite(inicial.desperdicioPct) ? inicial.desperdicioPct : 0,
  )
  const [precio, setPrecio] = useState(
    Number.isFinite(inicial.precioUnitario) ? inicial.precioUnitario : null,
  )

  // Medidas EN LA UNIDAD ACTIVA. Lo guardado viene en milímetros y baja acá.
  const [ancho, setAncho] = useState(() => desdeMm(inicial.anchoMm, unidadActiva))
  const [largo, setLargo] = useState(() => desdeMm(inicial.largoMm, unidadActiva))
  const [espesor, setEspesor] = useState(() => desdeMm(inicial.espesorMm, unidadActiva))
  const [traslapo, setTraslapo] = useState(() => desdeMm(inicial.traslapoMm, unidadActiva))
  const [largoBarra, setLargoBarra] = useState(() => desdeMm(inicial.largoBarraMm, unidadActiva))
  const [retazoMinimo, setRetazoMinimo] = useState(() =>
    desdeMm(inicial.retazoMinimoMm, unidadActiva),
  )

  const [errores, setErrores] = useState(/** @type {Record<string,string>} */ ({}))
  const [intentado, setIntentado] = useState(false)

  // Si la unidad cambia con el formulario abierto, la cifra en pantalla se
  // reconvierte para seguir midiendo lo mismo. La medida real no se mueve: solo
  // cambia el idioma en que se escribe.
  const unidadPrevia = useRef(u.id)
  useEffect(() => {
    const previa = unidadPrevia.current
    if (previa === u.id) return
    unidadPrevia.current = u.id
    /** @param {number|null} valor */
    const convertir = (valor) => (valor === null ? null : desdeMm(aMm(valor, previa), u.id))
    setAncho(convertir)
    setLargo(convertir)
    setEspesor(convertir)
    setTraslapo(convertir)
    setLargoBarra(convertir)
    setRetazoMinimo(convertir)
  }, [u.id])

  /**
   * Cambiar de tipo cambia qué medidas tienen sentido: las del tipo anterior se
   * descartan y entran los valores de fábrica del tipo nuevo. El nombre, el
   * desperdicio y el precio se conservan, que son comunes a los tres.
   * @param {string} nuevoTipo
   */
  function cambiarTipo(nuevoTipo) {
    if (!nuevoTipo || nuevoTipo === tipo) return
    const base = nuevoMaterial(nuevoTipo)
    setTipo(nuevoTipo)
    setAncho(desdeMm(base.anchoMm, u.id))
    setLargo(desdeMm(base.largoMm, u.id))
    setEspesor(desdeMm(base.espesorMm, u.id))
    setTraslapo(desdeMm(base.traslapoMm, u.id))
    setLargoBarra(desdeMm(base.largoBarraMm, u.id))
    setRetazoMinimo(desdeMm(base.retazoMinimoMm, u.id))
    if (nuevoTipo === 'barra') setDesignacion(inicial.designacion || '')
    if (nuevoTipo === 'pieza') setUso(USOS_PIEZA.includes(uso) ? uso : USO_PIEZA_POR_DEFECTO)
    setErrores({})
  }

  /**
   * Reglas de validación. Cada mensaje dice qué está mal y qué hacer.
   * @returns {Record<string,string>}
   */
  function validar() {
    /** @type {Record<string,string>} */
    const fallas = {}

    if (!nombre.trim()) {
      fallas.nombre =
        'El material necesita un nombre para reconocerlo en la biblioteca. Escribe uno.'
    }

    if (tipo === 'plancha') {
      if (!esPositivo(ancho)) {
        fallas.ancho = `Ingresa el ancho de la plancha en ${u.nombre}. Tiene que ser mayor que 0.`
      }
      if (!esPositivo(largo)) {
        fallas.largo = `Ingresa el largo de la plancha en ${u.nombre}. Tiene que ser mayor que 0.`
      }
      if (espesor !== null && !esPositivo(espesor)) {
        fallas.espesor = 'El espesor tiene que ser mayor que 0. Déjalo vacío si no lo vas a registrar.'
      }
      if (traslapo !== null && traslapo < 0) {
        fallas.traslapo = 'El traslapo no puede ser negativo. Deja 0 si las planchas van a tope.'
      } else if (
        esPositivo(ancho) &&
        esPositivo(largo) &&
        traslapo !== null &&
        (traslapo >= ancho || traslapo >= largo)
      ) {
        fallas.traslapo =
          'El traslapo tiene que ser menor que el ancho y que el largo: con este valor la plancha no cubre superficie. Ingresa un traslapo menor.'
      }
    }

    if (tipo === 'barra') {
      if (!esPositivo(largoBarra)) {
        fallas.largoBarra = `Ingresa el largo de la barra en ${u.nombre}. Tiene que ser mayor que 0.`
      }
      if (traslapo !== null && traslapo < 0) {
        fallas.traslapo = 'El traslapo no puede ser negativo. Deja 0 si las barras se unen a tope.'
      } else if (esPositivo(largoBarra) && traslapo !== null && traslapo >= largoBarra) {
        fallas.traslapo =
          'El traslapo tiene que ser menor que el largo de la barra: con este valor un empalme no avanza corrida. Ingresa un traslapo menor.'
      }
      if (retazoMinimo !== null && retazoMinimo < 0) {
        fallas.retazoMinimo =
          'El retazo mínimo no puede ser negativo. Deja 0 si aprovechas cualquier sobrante.'
      }
    }

    if (tipo === 'pieza') {
      if (!USOS_PIEZA.includes(uso)) {
        fallas.uso = 'Elige para qué sirve la pieza para poder ofrecerla donde corresponde.'
      }
    }

    if (tipo !== 'pieza') {
      if (desperdicio === null) {
        fallas.desperdicio = 'Ingresa el desperdicio por defecto. Usa 0 si no consideras pérdida.'
      } else if (desperdicio < 0) {
        fallas.desperdicio = 'El desperdicio no puede ser negativo.'
      } else if (desperdicio > 100) {
        fallas.desperdicio =
          'El desperdicio no puede pasar de 100 %. Ingresa un valor entre 0 y 100.'
      }
    }

    if (precio !== null && precio < 0) {
      fallas.precio = 'El precio no puede ser negativo. Déjalo vacío si todavía no lo tienes.'
    }

    return fallas
  }

  /**
   * Arma el material con la forma estable del esquema, ya en milímetros.
   * @returns {Object}
   */
  function construir() {
    const base = material ? { ...material } : {}
    const dec = u.decimales

    return {
      ...base,
      tipo,
      nombre: nombre.trim(),

      // Plancha · las tres medidas viajan de la unidad activa a milímetros.
      anchoMm: tipo === 'plancha' ? aMm(cuantizar(ancho, dec), u.id) : null,
      largoMm: tipo === 'plancha' ? aMm(cuantizar(largo, dec), u.id) : null,
      espesorMm: tipo === 'plancha' ? aMm(cuantizar(espesor, dec), u.id) : null,

      // El traslapo es el único campo que comparten dos tipos, con significados
      // distintos: en la plancha resta área útil, en la barra es lo que consume
      // cada empalme. Es el mismo campo del esquema y por eso el mismo estado.
      traslapoMm:
        tipo === 'plancha' || tipo === 'barra'
          ? (aMm(cuantizar(traslapo, dec), u.id) ?? 0)
          : null,

      // Barra o perfil.
      largoBarraMm: tipo === 'barra' ? aMm(cuantizar(largoBarra, dec), u.id) : null,
      retazoMinimoMm: tipo === 'barra' ? (aMm(cuantizar(retazoMinimo, dec), u.id) ?? 0) : null,
      designacion: tipo === 'barra' && designacion.trim() ? designacion.trim() : null,

      // Pieza o accesorio.
      uso: tipo === 'pieza' ? uso : null,

      // Comunes. Una pieza no acarrea desperdicio: se cubica por densidad.
      desperdicioPct: tipo === 'pieza' ? 0 : (desperdicio ?? 0),
      // Sin precio cargado se guarda `null`, jamás 0: un precio ausente deja la
      // línea fuera del total y así queda declarado en el consolidado.
      precioUnitario: precio === null ? null : Math.round(precio),

      // Previstos para el mapeo futuro contra la base de materiales de Karbec.
      // Kubikar no los llena en esta versión: viajan en null de punta a punta
      // para que el día que exista el catálogo se puedan poblar sin migrar nada.
      codigoMaterial: null,
      partida: null,
    }
  }

  /** @param {import('react').FormEvent<HTMLFormElement>} evento */
  function alEnviar(evento) {
    evento.preventDefault()
    const fallas = validar()
    setErrores(fallas)
    setIntentado(true)
    if (Object.keys(fallas).length > 0) return
    if (onGuardar) onGuardar(construir())
  }

  /**
   * Limpia el error de un campo apenas se corrige, sin esperar al próximo envío.
   * @param {string} clave
   */
  function limpiarError(clave) {
    setErrores((previos) => {
      if (!previos[clave]) return previos
      const siguiente = { ...previos }
      delete siguiente[clave]
      return siguiente
    })
  }

  /**
   * @param {string} clave
   * @param {(valor:*) => void} setter
   * @returns {(valor:*) => void}
   */
  function alCambiar(clave, setter) {
    return (valor) => {
      setter(valor)
      limpiarError(clave)
    }
  }

  const hayFallas = Object.keys(errores).length > 0

  return (
    <form
      id={idForm}
      noValidate
      onSubmit={alEnviar}
      className={cx('flex w-full flex-col gap-5', className)}
    >
      {error ? <Aviso nivel="error">{error}</Aviso> : null}

      {intentado && hayFallas ? (
        <Aviso nivel="error" titulo="Datos incompletos">
          Faltan datos o hay valores que no sirven para cubicar. Revisa los campos marcados.
        </Aviso>
      ) : null}

      <Selector
        etiqueta="Tipo de material"
        valor={tipo}
        onChange={cambiarTipo}
        opciones={OPCIONES_TIPO}
        ayuda="El tipo define qué medidas se piden y en qué parámetros del módulo se puede elegir."
      />

      <CampoTexto
        etiqueta="Nombre"
        valor={nombre}
        onChange={alCambiar('nombre', setNombre)}
        requerido
        error={errores.nombre}
        placeholder="Plancha yeso-cartón 1200 × 3000 mm"
        ayuda="Con este nombre aparece en los parámetros del módulo y en la cubicación."
      />

      {tipo === 'plancha' ? (
        <section className="flex flex-col gap-3">
          <Rotulo tinta="fuerte" como="h3">
            Medidas de la plancha
          </Rotulo>
          <Regla />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoNumero
              etiqueta="Ancho"
              valor={ancho}
              onChange={alCambiar('ancho', setAncho)}
              sufijo={u.label}
              decimales={u.decimales}
              min={0}
              paso={pasoMedida}
              requerido
              error={errores.ancho}
              ayuda={`Se ingresa en ${u.nombre} y se guarda en milímetros.`}
            />
            <CampoNumero
              etiqueta="Largo"
              valor={largo}
              onChange={alCambiar('largo', setLargo)}
              sufijo={u.label}
              decimales={u.decimales}
              min={0}
              paso={pasoMedida}
              requerido
              error={errores.largo}
            />
            <CampoNumero
              etiqueta="Espesor"
              valor={espesor}
              onChange={alCambiar('espesor', setEspesor)}
              sufijo={u.label}
              decimales={u.decimales}
              min={0}
              paso={pasoMedida}
              error={errores.espesor}
              ayuda="Opcional. No entra en el cálculo, sirve para identificar la plancha."
            />
            <CampoNumero
              etiqueta="Traslapo"
              valor={traslapo}
              onChange={alCambiar('traslapo', setTraslapo)}
              sufijo={u.label}
              decimales={u.decimales}
              min={0}
              paso={pasoMedida}
              error={errores.traslapo}
              ayuda="Opcional. Se descuenta del ancho y del largo para obtener el área útil."
            />
          </div>
        </section>
      ) : null}

      {tipo === 'barra' ? (
        <section className="flex flex-col gap-3">
          <Rotulo tinta="fuerte" como="h3">
            Medidas de la barra
          </Rotulo>
          <Regla />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoNumero
              etiqueta="Largo de la barra"
              valor={largoBarra}
              onChange={alCambiar('largoBarra', setLargoBarra)}
              sufijo={u.label}
              decimales={u.decimales}
              min={0}
              paso={pasoMedida}
              requerido
              error={errores.largoBarra}
              ayuda={`Se ingresa en ${u.nombre} y se guarda en milímetros.`}
            />
            <CampoTexto
              etiqueta="Designación"
              valor={designacion}
              onChange={alCambiar('designacion', setDesignacion)}
              error={errores.designacion}
              placeholder="Omega 38x0,85 mm"
              ayuda="Opcional. El perfil comercial, tal como se pide en la ferretería."
            />
            <CampoNumero
              etiqueta="Retazo mínimo"
              valor={retazoMinimo}
              onChange={alCambiar('retazoMinimo', setRetazoMinimo)}
              sufijo={u.label}
              decimales={u.decimales}
              min={0}
              paso={pasoMedida}
              error={errores.retazoMinimo}
              ayuda="Bajo este largo el sobrante de una barra es descarte y no se usa en otra corrida. Deja 0 si aprovechas cualquier retazo."
            />
            <CampoNumero
              etiqueta="Traslapo de empalme"
              valor={traslapo}
              onChange={alCambiar('traslapo', setTraslapo)}
              sufijo={u.label}
              decimales={u.decimales}
              min={0}
              paso={pasoMedida}
              error={errores.traslapo}
              ayuda="Lo que consume cada empalme cuando la corrida es más larga que la barra. Deja 0 si las barras se unen a tope."
            />
          </div>
        </section>
      ) : null}

      {tipo === 'pieza' ? (
        <section className="flex flex-col gap-3">
          <Rotulo tinta="fuerte" como="h3">
            Uso
          </Rotulo>
          <Regla />
          <Selector
            etiqueta="Para qué sirve"
            valor={uso}
            onChange={alCambiar('uso', setUso)}
            opciones={OPCIONES_USO}
            error={errores.uso}
            ayuda="Define en qué parámetros del módulo se ofrece esta pieza. Sin uso específico aparece en todos."
          />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <Rotulo tinta="fuerte" como="h3">
          Cubicación
        </Rotulo>
        <Regla />
        <div className="grid gap-4 sm:grid-cols-2">
          {tipo !== 'pieza' ? (
            <CampoNumero
              etiqueta="Desperdicio por defecto"
              valor={desperdicio}
              onChange={alCambiar('desperdicio', setDesperdicio)}
              sufijo="%"
              min={0}
              max={100}
              paso={1}
              sugeridos={[0, 5, 10]}
              error={errores.desperdicio}
              mensajeMin="El desperdicio no puede ser negativo."
              mensajeMax="El desperdicio no puede pasar de 100 %. Ingresa un valor entre 0 y 100."
              ayuda="Se precarga en el módulo cada vez que se elige este material."
            />
          ) : null}
          <CampoNumero
            etiqueta="Precio unitario"
            valor={precio}
            onChange={alCambiar('precio', setPrecio)}
            sufijo="$"
            decimales={0}
            min={0}
            paso={100}
            error={errores.precio}
            ayuda="Opcional, en pesos. Sin precio, el material se cubica igual y queda fuera del total."
          />
        </div>
      </section>

      {mostrarAcciones ? (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {onCancelar ? (
            <Boton variante="fantasma" onClick={onCancelar} deshabilitado={guardando}>
              Cancelar
            </Boton>
          ) : null}
          <Boton type="submit" variante="primaria" cargando={guardando}>
            Guardar material
          </Boton>
        </div>
      ) : null}
    </form>
  )
}

export default FormularioMaterial
