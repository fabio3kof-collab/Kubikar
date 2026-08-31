/* =============================================================================
   Kubikar · pruebas del chequeo de versión
   -----------------------------------------------------------------------------
   Dos cosas se fijan acá, y las dos se pagan en faena si fallan.

   La primera es el orden de las versiones. Compararlas como texto da
   `"1.10.0" < "1.9.0"`, un error que no aparece hasta la décima versión menor
   —cuando ya nadie está mirando— y que deja a todas las copias creyéndose al
   día para siempre.

   La segunda es que `buscarActualizacion` NO LANCE nunca. Kubikar se usa en
   terreno, donde estar sin internet es lo normal: una excepción al montar la
   aplicación por no poder hablar con GitHub sería cambiar un aviso que no
   importa por una pantalla en blanco que sí.
   ========================================================================== */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  VERSION_ACTUAL,
  buscarActualizacion,
  compararVersiones,
} from '../src/data/actualizaciones.js'

/**
 * Reemplaza `fetch` global por el doble dado mientras corre `cuerpo`, y lo
 * devuelve como estaba. Sin bundle de Vite, `VERSION_ACTUAL` cae en su valor de
 * respaldo `0.0.0`, así que cualquier versión publicada es posterior.
 *
 * @param {*} doble
 * @param {() => Promise<void>} cuerpo
 */
async function conFetch(doble, cuerpo) {
  const original = globalThis.fetch
  globalThis.fetch = doble
  try {
    await cuerpo()
  } finally {
    globalThis.fetch = original
  }
}

/** Respuesta que se comporta como la de `fetch` para lo que este módulo usa. */
function respuesta({ ok = true, status = 200, json }) {
  return {
    ok,
    status,
    async json() {
      if (typeof json === 'function') return json()
      return json
    },
  }
}

/* ── El orden de las versiones ─────────────────────────────────────────────── */

test('la versión se ordena por partes numéricas, no como texto', () => {
  // El caso entero por el que esta función existe.
  assert.ok(compararVersiones('1.10.0', '1.9.0') > 0)
  assert.ok(compararVersiones('1.9.0', '1.10.0') < 0)
})

test('versiones equivalentes dan cero', () => {
  assert.equal(compararVersiones('2.3.4', '2.3.4'), 0)
  // Largos distintos: lo que falta cuenta como cero.
  assert.equal(compararVersiones('2.3', '2.3.0'), 0)
})

test('cada parte pesa más que la siguiente', () => {
  assert.ok(compararVersiones('2.0.0', '1.99.99') > 0)
  assert.ok(compararVersiones('1.2.0', '1.1.99') > 0)
})

test('la basura no rompe el orden: cuenta como cero', () => {
  assert.equal(compararVersiones('', ''), 0)
  assert.equal(compararVersiones(null, undefined), 0)
  assert.ok(compararVersiones('1.0.0', 'no-es-una-version') > 0)
})

/* ── El chequeo nunca lanza ────────────────────────────────────────────────── */

test('sin red devuelve sin-conexion en vez de lanzar', async () => {
  await conFetch(
    async () => {
      throw new Error('getaddrinfo ENOTFOUND raw.githubusercontent.com')
    },
    async () => {
      assert.deepEqual(await buscarActualizacion(50), { estado: 'sin-conexion' })
    },
  )
})

test('un 404 devuelve sin-conexion', async () => {
  await conFetch(
    async () => respuesta({ ok: false, status: 404, json: null }),
    async () => {
      assert.deepEqual(await buscarActualizacion(50), { estado: 'sin-conexion' })
    },
  )
})

test('un manifiesto que no es JSON devuelve sin-conexion', async () => {
  await conFetch(
    async () =>
      respuesta({
        json() {
          throw new SyntaxError('Unexpected token < in JSON')
        },
      }),
    async () => {
      assert.deepEqual(await buscarActualizacion(50), { estado: 'sin-conexion' })
    },
  )
})

test('un manifiesto sin versión devuelve sin-conexion', async () => {
  await conFetch(
    async () => respuesta({ json: { fecha: '2026-08-31', notas: 'sin número' } }),
    async () => {
      assert.deepEqual(await buscarActualizacion(50), { estado: 'sin-conexion' })
    },
  )
})

/* ── El veredicto ──────────────────────────────────────────────────────────── */

test('una versión posterior a la de esta copia avisa', async () => {
  const manifiesto = { version: '99.0.0', fecha: '2026-08-31', notas: 'Arregla el cielo' }
  await conFetch(
    async () => respuesta({ json: manifiesto }),
    async () => {
      assert.deepEqual(await buscarActualizacion(50), { estado: 'hay-nueva', manifiesto })
    },
  )
})

test('la misma versión y las anteriores no avisan', async () => {
  await conFetch(
    async () => respuesta({ json: { version: VERSION_ACTUAL } }),
    async () => {
      assert.deepEqual(await buscarActualizacion(50), {
        estado: 'al-dia',
        version: VERSION_ACTUAL,
      })
    },
  )

  await conFetch(
    // Fuera del bundle `VERSION_ACTUAL` es 0.0.0, así que se prueba el empate
    // por abajo con una versión imposible de superar.
    async () => respuesta({ json: { version: '0.0.0' } }),
    async () => {
      const resultado = await buscarActualizacion(50)
      assert.equal(resultado.estado, 'al-dia')
    },
  )
})
