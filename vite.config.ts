import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

// SPORT 환경변수: badminton (기본) 또는 tennis
const sport = process.env.SPORT || 'badminton'

export default defineConfig({
  define: {
    'process.env.SPORT': JSON.stringify(sport),
    '__SPORT__': JSON.stringify(sport),
  },
  plugins: [
    build({
      entry: 'src/index.tsx',
      outputDir: './dist'
    }),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ]
})
