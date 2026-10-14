// Almacén en archivos, para el servidor local de desarrollo y el autoalojado.
import fs from 'node:fs'
import path from 'node:path'
import { sha, type Almacen } from './almacen.js'

export function almacenArchivos(dir: string): Almacen {
  const archivo = (ruta: string) => path.join(dir, ...ruta.split('/'))
  return {
    nombre: 'archivos',
    async leer(ruta, conocida) {
      const f = archivo(ruta)
      if (!fs.existsSync(f)) return null
      const texto = fs.readFileSync(f, 'utf8')
      const etiqueta = sha(texto)
      return etiqueta === conocida ? 'igual' : { texto, etiqueta }
    },
    async escribir(ruta, texto, etiqueta) {
      const f = archivo(ruta)
      const existe = fs.existsSync(f)
      if (etiqueta === null && existe) return 'conflicto'
      if (etiqueta !== null && (!existe || sha(fs.readFileSync(f, 'utf8')) !== etiqueta)) return 'conflicto'
      fs.mkdirSync(path.dirname(f), { recursive: true })
      fs.writeFileSync(f, texto)
      return sha(texto)
    },
    async borrar(ruta) {
      fs.rmSync(archivo(ruta), { force: true })
    },
  }
}
