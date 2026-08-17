import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    // El contrato de direccion vive como comentario HTML en index.html y debe
    // sobrevivir el build de produccion para poder auditarse.
    //
    // Vite 8 transpila y minifica con oxc: esbuild ya no viene incluido y
    // pedirlo por nombre rompe el build con "Cannot find package 'esbuild'".
    // El minificador solo toca JS y CSS; los comentarios de index.html pasan
    // intactos, que es lo que este ajuste tiene que garantizar.
    minify: 'oxc',
  },
})
