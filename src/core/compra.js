/* =============================================================================
   Kubikar · escalón de compra
   -----------------------------------------------------------------------------
   Hay materiales que no se despachan en la cantidad exacta que pide el cálculo.
   Un tornillo se pide por puñado o por caja: el que llega a la ferretería con
   358 redondea igual, pero en el mesón y sin que quede escrito en la cubicación,
   y entonces dos personas con la misma hoja compran cantidades distintas.

   El escalón es ese redondeo, escrito. Tiene dos números y ninguno más:

     · `minimo`  la compra chica. Bajo eso no hay bolsa que pedir.
     · `paso`    de ahí para arriba, se sube al múltiplo siguiente.

   QUIÉN LO DECLARA Y QUIÉN LO APLICA SON DISTINTOS, y es la decisión de fondo
   de este archivo. El módulo declara el escalón en su línea porque sabe qué
   está cubicando; la LISTA DE COMPRA lo aplica, porque comprar es una decisión
   del proyecto entero y no de cada recinto. Tres recintos de 20 tornillos son 60
   tornillos y una sola visita a la ferretería: aplicarlo en cada recinto los
   convertiría en 150, que es material comprado de más por un redondeo hecho tres
   veces.

   Es exactamente la diferencia con el retazo de una barra, que sí se redondea
   por recinto: el sobrante de un corte no viaja a la pieza siguiente, y un
   tornillo sí. Por eso el escalón no es una propiedad del recinto sino del
   proyecto, y por eso vive acá y no en `repartirBarras`.

   Funciones puras: no leen estado, no formatean y nunca lanzan.
   ========================================================================== */

/**
 * @typedef {Object} EscalonDeCompra
 * @property {number} minimo  compra chica, en la unidad de la línea
 * @property {number} paso    múltiplo al que se sube por sobre el mínimo
 */

/**
 * Valida un escalón declarado por un módulo y lo deja en forma canónica.
 *
 * Devuelve null ante cualquier declaración que no sirva —sin paso, con paso 0 o
 * negativo, basura— en vez de corregirla a un valor inventado: una línea sin
 * escalón utilizable se compra en su cantidad exacta, que es la respuesta segura.
 * El mínimo ausente es legítimo y vale 0: hay materiales que suben de a cien
 * desde el primero, sin compra chica.
 *
 * @param {*} compra
 * @returns {EscalonDeCompra|null}
 */
export function normalizarEscalon(compra) {
  if (!compra || typeof compra !== 'object') return null
  const paso = Number(compra.paso)
  if (!Number.isFinite(paso) || !(paso > 0)) return null
  const minimo = Number(compra.minimo)
  return { minimo: Number.isFinite(minimo) && minimo > 0 ? minimo : 0, paso }
}

/**
 * Sube una cantidad al escalón de compra que declara su línea.
 *
 *   Con `{minimo: 50, paso: 100}`
 *     1 – 49    → 50      la compra chica
 *     50 – 100  → 100     desde el mínimo se sube al paso
 *     101 – 200 → 200     y de ahí en adelante, de cien en cien
 *     358       → 400
 *     1.150     → 1.200
 *
 * Siempre hacia arriba y nunca hacia abajo: un tornillo que falta detiene a la
 * cuadrilla hasta que alguien baje a la ferretería, y uno que sobra se queda en
 * la caja. El sesgo es a propósito y va en una sola dirección.
 *
 * El múltiplo exacto no gasta un escalón de más: 100 con paso 100 se queda en
 * 100. Subirlo a 200 sería regalar cien unidades por un redondeo que no tenía
 * nada que redondear, y se descarta el ruido de coma flotante antes de decidirlo
 * —igual que en `techo`— para que un 99,999999 sumado a punta de floats no
 * dispare una centena entera.
 *
 * Sin escalón declarado devuelve la cantidad tal cual: la mayoría de las líneas
 * no tiene escalón y esa es su respuesta correcta, no un caso especial.
 *
 * @param {number} cantidad
 * @param {*} [compra]  escalón declarado por la línea, o nada
 * @returns {number}
 */
export function aplicarEscalon(cantidad, compra) {
  const n = Number(cantidad)
  if (!Number.isFinite(n)) return 0
  if (!(n > 0)) return n

  const escalon = normalizarEscalon(compra)
  if (!escalon) return n

  if (n < escalon.minimo) return escalon.minimo
  const pasos = n / escalon.paso
  return Math.ceil(Math.round(pasos * 1e6) / 1e6) * escalon.paso
}

/**
 * Si el escalón mueve o no esta cantidad. Lo usa la memoria de cálculo para
 * callarse cuando no la movió: escribir «100 un → 100 un» es ruido en una hoja
 * que se lee en terreno, igual que «+0% desperdicio».
 *
 * @param {number} cantidad
 * @param {*} [compra]
 * @returns {boolean}
 */
export function elEscalonMueve(cantidad, compra) {
  return aplicarEscalon(cantidad, compra) !== cantidad
}
