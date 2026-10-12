// Compila el sitio y la función del juego al formato Build Output API de Vercel (.vercel/output).
// Después se publica con `vercel deploy --prebuilt --prod` (ver `npm run desplegar`).
import { build } from 'esbuild'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const raiz = process.cwd()
const salida = path.join(raiz, '.vercel', 'output')
fs.rmSync(salida, { recursive: true, force: true })

console.log('1/2 Compilando el cliente…')
execSync('npx vite build', { stdio: 'inherit' })
fs.cpSync(path.join(raiz, 'dist'), path.join(salida, 'static'), { recursive: true })

console.log('2/2 Empaquetando la función del juego…')
async function funcion(nombre, entrada, maxDuration) {
  const dir = path.join(salida, 'functions', 'api', `${nombre}.func`)
  await build({
    entryPoints: [path.join(raiz, entrada)],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    outfile: path.join(dir, 'index.js'),
    legalComments: 'none',
    logLevel: 'warning',
    // El lanzador de Vercel espera que module.exports sea la función manejadora.
    footer: { js: 'module.exports = module.exports.default || module.exports;' },
  })
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"commonjs"}\n')
  fs.writeFileSync(
    path.join(dir, '.vc-config.json'),
    JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.js', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration }, null, 2),
  )
  const kb = Math.round(fs.statSync(path.join(dir, 'index.js')).size / 1024)
  console.log(`   /api/${nombre}  ${kb} KB`)
}
await funcion('juego', 'server/vercel.ts', 30)

fs.writeFileSync(
  path.join(salida, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/assets/(.*)', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
        { handle: 'filesystem' },
        { src: '/api/(.*)', status: 404 },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
)

console.log('Listo: .vercel/output')
