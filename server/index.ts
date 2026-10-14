// Servidor local: desarrollo (`npm run dev`) y autoalojado (`npm start`).
// En Cloudflare no se usa este archivo: ahí la entrada es server/cloudflare.ts.
import express from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { usarAlmacen } from './almacen.js'
import { almacenArchivos } from './almacen-archivos.js'
import { manejar } from './api.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })
usarAlmacen(almacenArchivos(process.env.MT_DATA_DIR ?? DATA_DIR))

// Secreto de sesiones: en local se genera una vez y se guarda en server/data (fuera de git).
if (!process.env.AUTH_SECRET) {
  const archivo = path.join(DATA_DIR, 'secret.txt')
  if (!fs.existsSync(archivo)) fs.writeFileSync(archivo, crypto.randomBytes(32).toString('hex'))
  process.env.AUTH_SECRET = fs.readFileSync(archivo, 'utf8').trim()
}

const app = express()
app.use(express.json({ limit: '64kb' }))

app.post('/api/juego', async (req, res) => {
  const r = await manejar(req.body, req.headers.authorization)
  res.status(r.status).set('content-type', 'application/json; charset=utf-8').set('cache-control', 'no-store').send(r.json)
})

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'dist')
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

// En desarrollo Vite ocupa PORT (5173); el servidor de juego usa SERVER_PORT o 3001.
const PORT = Number(process.env.SERVER_PORT ?? (process.env.NODE_ENV === 'production' ? process.env.PORT : undefined) ?? 3001)
app.listen(PORT, () => console.log(`Mission Trainer servidor en http://localhost:${PORT}`))
