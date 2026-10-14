// Web Worker que genera los píxeles de las texturas fuera del hilo principal (así el juego no
// se congela mientras se pintan). Las costas de Natural Earth se importan aquí de forma
// estática: quedan dentro del archivo del worker, que solo se descarga cuando se usa.
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import tierra50m from 'world-atlas/land-50m.json'
import { generarColorTierra, generarLuna, generarMarte, generarNubesTierra } from './generadores'
import type { Poligono } from './rasterizar'
import type { PedidoTextura, RespuestaTextura } from './texturas'

let poligonos: Poligono[] | null = null
function costas(): Poligono[] {
  if (!poligonos) {
    const topo = tierra50m as unknown as Topology
    const geo = feature(topo, topo.objects.land) as unknown as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon>
    poligonos = geo.features.flatMap((f) => f.geometry.coordinates)
  }
  return poligonos
}

self.onmessage = (ev: MessageEvent<PedidoTextura>) => {
  const { id, tipo, ancho, alto } = ev.data
  try {
    let r: RespuestaTextura
    if (tipo === 'tierra') r = { id, capas: [generarColorTierra(costas(), ancho, alto)] }
    else if (tipo === 'nubes') r = { id, capas: [generarNubesTierra(ancho, alto)] }
    else if (tipo === 'marte') {
      const m = generarMarte(ancho, alto)
      r = { id, capas: [m.color, m.relieve] }
    } else {
      const l = generarLuna(ancho, alto)
      r = { id, capas: [l.color, l.relieve] }
    }
    self.postMessage(r, { transfer: r.capas.map((c) => c.buffer) })
  } catch (e) {
    const r: RespuestaTextura = { id, capas: [], error: String(e) }
    self.postMessage(r)
  }
}
