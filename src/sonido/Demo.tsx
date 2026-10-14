// Banco de pruebas del sonido: no está conectado al juego. Sirve para escuchar cada ambiente y
// evento y afinar niveles. Las simulaciones usan valores de demostración en tiempo comprimido,
// no perfiles reales de vuelo.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { sonido, useSonido, type NombreEvento, type OpcionesEvento, type ParametrosAmbiente, type TipoAmbiente } from './index'

const AMBIENTES: TipoAmbiente[] = ['ninguno', 'nave', 'orbita', 'base', 'eva', 'lanzamiento', 'descenso']

const EVENTOS: { etiqueta: string; nombre: NombreEvento; opciones?: OpcionesEvento }[] = [
  { etiqueta: 'Alarma (bucle)', nombre: 'alarma' },
  { etiqueta: 'Aviso', nombre: 'aviso' },
  { etiqueta: 'Clic', nombre: 'clic' },
  { etiqueta: 'Quindar inicio', nombre: 'quindarInicio' },
  { etiqueta: 'Quindar fin', nombre: 'quindarFin' },
  { etiqueta: 'Radio', nombre: 'radio' },
  { etiqueta: 'Esclusa: despresurizar', nombre: 'esclusa', opciones: { direccion: 'despresurizar' } },
  { etiqueta: 'Esclusa: presurizar', nombre: 'esclusa', opciones: { direccion: 'presurizar' } },
  { etiqueta: 'Paso (interior)', nombre: 'paso', opciones: { superficie: 'interior' } },
  { etiqueta: 'Paso (Marte)', nombre: 'paso', opciones: { superficie: 'marte' } },
  { etiqueta: 'Separación', nombre: 'separacion' },
  { etiqueta: 'Teclado', nombre: 'teclado' },
  { etiqueta: 'Éxito', nombre: 'exito' },
  { etiqueta: 'Latido', nombre: 'latido' },
  { etiqueta: 'Ejercicio (bucle)', nombre: 'ejercicio' },
]

type Deslizador = { clave: keyof ParametrosAmbiente; min: number; max: number; paso: number }
const DESLIZADORES: Deslizador[] = [
  { clave: 'viento', min: 0, max: 1, paso: 0.01 },
  { clave: 'respiracion', min: 0, max: 50, paso: 1 },
  { clave: 'empuje', min: 0, max: 1, paso: 0.01 },
  { clave: 'altitudKm', min: 0, max: 150, paso: 1 },
  { clave: 'presionDinamica', min: 0, max: 1, paso: 0.01 },
  { clave: 'calor', min: 0, max: 1, paso: 0.01 },
  { clave: 'paracaidas', min: 0, max: 1, paso: 0.01 },
  { clave: 'retro', min: 0, max: 1, paso: 0.01 },
]

const INICIALES: Required<ParametrosAmbiente> = {
  viento: 0.3,
  respiracion: 14,
  empuje: 0,
  altitudKm: 0,
  presionDinamica: 0,
  calor: 0,
  paracaidas: 0,
  retro: 0,
  marte: 0,
}

const caja: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }
const suave = (desde: number, hasta: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - desde) / (hasta - desde)))
  return x * x * (3 - 2 * x)
}

export function DemoSonido() {
  const estado = useSonido()
  const [tipo, setTipo] = useState<TipoAmbiente>('ninguno')
  const [p, setP] = useState(INICIALES)
  const animacion = useRef(0)

  useEffect(
    () => () => {
      cancelAnimationFrame(animacion.current)
      sonido.detener()
      sonido.ambiente('ninguno')
    },
    [],
  )

  const cambiar = (nuevo: ParametrosAmbiente) => {
    setP((prev) => ({ ...prev, ...nuevo }))
    sonido.parametros(nuevo)
  }

  const elegir = (t: TipoAmbiente) => {
    cancelAnimationFrame(animacion.current)
    void sonido.activar()
    setTipo(t)
    sonido.ambiente(t, p)
  }

  /** Recorre una función del tiempo cuadro a cuadro, como lo haría el juego. */
  const simular = (t: TipoAmbiente, inicial: ParametrosAmbiente, duracion: number, cuadro: (s: number, dispara: (s0: number, f: () => void) => void) => ParametrosAmbiente) => {
    cancelAnimationFrame(animacion.current)
    void sonido.activar()
    setTipo(t)
    sonido.ambiente(t, inicial)
    const t0 = performance.now()
    const hechos = new Set<number>()
    const dispara = (s0: number, f: () => void) => {
      if (!hechos.has(s0)) {
        hechos.add(s0)
        f()
      }
    }
    const paso = () => {
      const s = (performance.now() - t0) / 1000
      const valores = cuadro(s, (s0, f) => s >= s0 && dispara(s0, f))
      sonido.parametros(valores)
      setP((prev) => ({ ...prev, ...valores }))
      if (s < duracion) animacion.current = requestAnimationFrame(paso)
    }
    animacion.current = requestAnimationFrame(paso)
  }

  // Ascenso de demostración en 40 s: encendido, máx. Q, separación, segunda etapa, apagado y radio
  const ascenso = () =>
    simular('lanzamiento', { empuje: 0, altitudKm: 0, presionDinamica: 0 }, 40, (s, dispara) => {
      const altitudKm = 120 * suave(3.5, 33, s) ** 1.6
      const empuje = s < 20 ? suave(2, 3.5, s) : s < 21.2 ? 0 : s < 33 ? 0.8 * suave(21.2, 22, s) : 0
      const presionDinamica = s > 3.5 ? Math.exp(-(((altitudKm - 12) / 7) ** 2)) * (empuje > 0 ? 1 : 0.3) : 0
      dispara(20, () => sonido.evento('separacion'))
      dispara(34.5, () => sonido.evento('quindarInicio'))
      dispara(34.9, () => sonido.evento('radio', { duracion: 1.4 }))
      dispara(36.4, () => sonido.evento('quindarFin'))
      return { empuje, altitudKm, presionDinamica }
    })

  // Descenso de demostración en 30 s: entrada, paracaídas, retrocohetes y contacto
  const descenso = () =>
    simular('descenso', { calor: 0, paracaidas: 0, retro: 0, marte: p.marte }, 30, (s, dispara) => {
      const calor = suave(0, 5, s) * (1 - suave(8, 13, s))
      const paracaidas = s > 13 ? 1 - suave(21, 22, s) : 0
      const retro = s > 21.5 ? 1 - suave(27, 27.4, s) : 0
      dispara(13, () => sonido.evento('separacion', { volumen: 0.5 }))
      dispara(27.4, () => sonido.evento('separacion', { volumen: 0.35 }))
      return { calor, paracaidas, retro }
    })

  return (
    <div style={{ padding: 16, maxWidth: 820 }}>
      <h2>Banco de sonido</h2>
      <p className="mini muted">
        Estado: {estado.activo ? 'activo' : 'inactivo (pulsa Activar)'} · ambiente: {tipo}
      </p>
      <div style={caja}>
        <button onClick={() => void sonido.activar()}>Activar</button>
        <button onClick={() => sonido.silenciar(!estado.silenciado)}>{estado.silenciado ? 'Quitar silencio' : 'Silenciar'}</button>
        <label>
          Volumen {Math.round(estado.volumen * 100)}%{' '}
          <input type="range" min={0} max={1} step={0.01} value={estado.volumen} onChange={(e) => sonido.volumen(Number(e.target.value))} />
        </label>
      </div>

      <h3>Ambientes</h3>
      <div style={caja}>
        {AMBIENTES.map((a) => (
          <button key={a} onClick={() => elegir(a)} disabled={a === tipo}>
            {a}
          </button>
        ))}
        <button onClick={ascenso}>Simular ascenso (40 s)</button>
        <button onClick={descenso}>Simular descenso (30 s)</button>
      </div>

      <h3>Parámetros</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8, marginBottom: 12 }}>
        {DESLIZADORES.map((d) => (
          <label key={d.clave}>
            {d.clave}: {p[d.clave].toFixed(d.paso < 1 ? 2 : 0)}
            <input
              type="range"
              min={d.min}
              max={d.max}
              step={d.paso}
              value={p[d.clave]}
              onChange={(e) => cambiar({ [d.clave]: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
        ))}
        <label>
          <input type="checkbox" checked={p.marte >= 0.5} onChange={(e) => cambiar({ marte: e.target.checked ? 1 : 0 })} /> Descenso en Marte
        </label>
      </div>

      <h3>Eventos</h3>
      <div style={caja}>
        {EVENTOS.map((e) => (
          <button
            key={e.etiqueta}
            onClick={() => {
              void sonido.activar()
              sonido.evento(e.nombre, e.opciones)
            }}
          >
            {e.etiqueta}
          </button>
        ))}
        <button onClick={() => sonido.detener('alarma')}>Detener alarma</button>
        <button onClick={() => sonido.detener('ejercicio')}>Detener ejercicio</button>
      </div>
    </div>
  )
}
