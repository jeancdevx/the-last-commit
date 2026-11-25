import preact from '@astrojs/preact'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

const base = process.env.ASTRO_BASE || '/'

export default defineConfig({
  base,
  output: 'static',
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()]
  }
})
