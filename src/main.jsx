/* =============================================================================
   Kubikar · punto de entrada
   -----------------------------------------------------------------------------
   Orden de arranque, y el orden importa:

   1. `styles/base.css` primero. Arrastra tokens.css y las fuentes, de modo que
      la primera pintura ya sale con el papel, la tinta y el serif correctos y
      no hay un destello de estilos por defecto del navegador.
   2. `modules/index.js` por efecto lateral. Registra Cielo y los módulos
      anunciados antes de que se monte un solo componente. La interfaz nunca
      nombra un módulo: los consulta al registro, y el registro tiene que estar
      poblado antes del primer render.
   3. Recién ahí se monta React sobre #root.

   El proveedor de estado envuelve la aplicación entera porque la unidad activa,
   el proyecto abierto y el historial de dibujo los necesita cualquier zona.
   ============================================================================ */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles/base.css'
import './modules/index.js'

import { ProveedorApp } from './state/AppState.jsx'
import App from './App.jsx'

const contenedor = document.getElementById('root')

if (!contenedor) {
  // Sin nodo de montaje no hay nada que hacer, y un error mudo en consola es
  // peor que uno que dice exactamente qué falta en index.html.
  throw new Error('No se encontró el elemento #root en index.html. Kubikar no puede montarse.')
}

createRoot(contenedor).render(
  <StrictMode>
    <ProveedorApp>
      <App />
    </ProveedorApp>
  </StrictMode>,
)
