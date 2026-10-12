// Carga la función empaquetada tal como la ejecutará Vercel y le envía una petición simulada.
// Uso: node scripts/probar-paquete.cjs   (después de npm run empaquetar)
const { Readable } = require('node:stream')
const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs')

process.env.AUTH_SECRET = 'prueba-local'
process.env.MT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-paquete-'))
const handler = require(path.join(process.cwd(), '.vercel/output/functions/api/juego.func/index.js'))

function pedir(metodo, cuerpo, cabeceras = {}) {
  return new Promise((resolver) => {
    const req = Readable.from(cuerpo ? [Buffer.from(JSON.stringify(cuerpo))] : [])
    req.method = metodo
    req.headers = { 'content-type': 'application/json', ...cabeceras }
    const res = {
      statusCode: 200,
      cabeceras: {},
      setHeader(k, v) {
        this.cabeceras[k] = v
      },
      end(texto) {
        resolver({ status: this.statusCode, cuerpo: texto })
      },
    }
    handler(req, res)
  })
}

;(async () => {
  if (typeof handler !== 'function') throw new Error('module.exports no es una función')
  const get = await pedir('GET')
  const reg = await pedir('POST', { op: 'registro', usuario: 'paquete', clave: 'abcd1234' })
  const token = JSON.parse(reg.cuerpo).token
  const sala = await pedir('POST', { op: 'crear', modo: 'votacion' }, { authorization: `Bearer ${token}` })
  const d = JSON.parse(sala.cuerpo)
  console.log('GET →', get.status, '| registro →', reg.status, '| crear →', sala.status, d.sala && d.sala.codigo, d.sala && d.sala.modoDecision)
  const bien = get.status === 405 && reg.status === 200 && sala.status === 200 && /^[A-Z0-9]{6}$/.test(d.sala.codigo)
  console.log(bien ? 'PAQUETE OK' : 'PAQUETE CON FALLAS')
  process.exit(bien ? 0 : 1)
})()
