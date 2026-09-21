import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Rutas relativas para que funcione igual en GitHub Pages que en la raíz de un dominio.
  base: './',
})
