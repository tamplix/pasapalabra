import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // En local se sirve en la raíz; el despliegue en GitHub Pages fija BASE_PATH=/pasapalabra/.
  base: process.env.BASE_PATH ?? '/',
})
