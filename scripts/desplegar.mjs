// Empaqueta, prueba el paquete y lo publica en Vercel.
// Si existe .vercel/cli-dir.txt, usa esa carpeta como sesión de la CLI (opción -Q), para no
// mezclar esta cuenta de Vercel con otras que haya en la misma máquina.
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const correr = (cmd) => execSync(cmd, { stdio: 'inherit' })
correr('node scripts/empaquetar.mjs')
correr('node scripts/probar-paquete.cjs')
const dir = fs.existsSync('.vercel/cli-dir.txt') ? fs.readFileSync('.vercel/cli-dir.txt', 'utf8').trim() : ''
correr(`npx --yes vercel@latest deploy --prebuilt --prod --yes${dir ? ` -Q "${dir}"` : ''}`)
