/* =============================================================================
   Kubikar · pruebas de la ubicación del repositorio
   -----------------------------------------------------------------------------
   El build escribe el entregable en `..\Kubikar.html`, un nivel más arriba del
   repositorio, y `publicar` lo lee desde ahí. Si el clon quedó fuera de su
   carpeta contenedora nada se rompe con estruendo: el entregable cae suelto
   entre los archivos del Escritorio y se publica ese. El error se descubre en
   faena, con la versión equivocada sobre la mesa.

   Lo que se fija acá es qué se exige y qué no. Se exige que el nivel de arriba
   sea el contenedor —eso es lo que el build necesita—. NO se exige un nombre
   para el clon: cada computador tiene el suyo, y un guardián que rechace una
   máquina de trabajo que funciona es un guardián que se termina desactivando.
   ========================================================================== */

import test from 'node:test'
import assert from 'node:assert/strict'

import { verificarUbicacion } from '../scripts/verificar-ubicacion.mjs'

test('un clon dentro de la carpeta contenedora pasa', () => {
  assert.doesNotThrow(() => verificarUbicacion('/Escritorio/Kubikar/Kubikar-codigo'))
})

test('el nombre del clon da lo mismo: lo que importa es el nivel de arriba', () => {
  assert.doesNotThrow(() => verificarUbicacion('/dev/Kubikar/clon-de-trabajo'))
})

test('el contenedor se reconoce sin importar mayúsculas', () => {
  assert.doesNotThrow(() => verificarUbicacion('/Escritorio/kubikar/codigo'))
})

test('clonar sobre el Escritorio falla: el entregable caería suelto', () => {
  assert.throws(() => verificarUbicacion('/Escritorio/Kubikar'), /fuera de su carpeta contenedora/)
})

test('el clon que ocupa el contenedor se manda a hundirse un nivel, no a mudarse', () => {
  try {
    verificarUbicacion('/Escritorio/Kubikar')
    assert.fail('tenía que fallar')
  } catch (e) {
    assert.match(e.message, /ocupa la carpeta contenedora/)
    assert.match(e.message, /Kubikar-codigo/)
  }
})

test('un clon en cualquier otra parte se manda a mudarse dentro del contenedor', () => {
  try {
    verificarUbicacion('/dev/repos/kubi')
    assert.fail('tenía que fallar')
  } catch (e) {
    assert.match(e.message, /Mueve el repositorio dentro de una carpeta 'Kubikar'/)
    assert.match(e.message, /mkdir Kubikar/)
  }
})

test('el mensaje dice dónde caería el entregable, que es el daño concreto', () => {
  try {
    verificarUbicacion('/Escritorio/Kubikar')
    assert.fail('tenía que fallar')
  } catch (e) {
    assert.match(e.message, /Kubikar\.html/)
    assert.match(e.message, /Escritorio/)
  }
})
