import { useEffect, useState, type ReactNode } from 'react'
import { C } from '@shared/ciencia'
import { ROLE_BY_ID, formatoHora, formatoMET, type Role, type RoomState } from '@shared/types'
import { ahoraServidor } from '../store'

export type Nivel = 'ok' | 'warn' | 'bad'
export const nivel = (malo: boolean, regular: boolean): Nivel => (malo ? 'bad' : regular ? 'warn' : 'ok')

export function Barra({ valor, max = 100, tono = 'ok' }: { valor: number; max?: number; tono?: Nivel | 'azul' }) {
  const pct = Math.min(100, Math.max(0, (valor / max) * 100))
  return (
    <div className={`bar ${tono}`}>
      <i style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Un dato con su etiqueta, su valor y, si se quiere, una barra y una nota. */
export function Dato({ etiqueta, valor, tono, barra, nota }: { etiqueta: string; valor: ReactNode; tono?: Nivel; barra?: { valor: number; max?: number }; nota?: string }) {
  return (
    <div className="dato" title={nota}>
      <span>{etiqueta}</span>
      <b className={tono ?? ''}>{valor}</b>
      {barra && <Barra valor={barra.valor} max={barra.max} tono={tono ?? 'ok'} />}
    </div>
  )
}

export function RolTag({ rol }: { rol: Role | null }) {
  if (!rol) return <span className="muted">sin rol</span>
  const r = ROLE_BY_ID[rol]
  return (
    <span className="tag" style={{ color: r.color }} title={r.nombre}>
      {r.corto}
    </span>
  )
}

export const roles = (lista: Role[]) => lista.map((r) => ROLE_BY_ID[r].corto).join(' + ')

/** Segundo a segundo, la hora del servidor (para cuentas regresivas). */
export function useAhora() {
  const [t, setT] = useState(ahoraServidor())
  useEffect(() => {
    const id = setInterval(() => setT(ahoraServidor()), 500)
    return () => clearInterval(id)
  }, [])
  return t
}

export const enMarte = (sala: RoomState) => sala.tAterrizaje > 0

/** Reloj de la misión: T+ durante el vuelo, sol y hora local en Marte. */
export function relojMision(sala: RoomState): { principal: string; secundario: string } {
  if (enMarte(sala)) {
    return { principal: `Sol ${sala.ambiente.sol} · ${formatoHora(sala.ambiente.hora)}`, secundario: `de ${sala.mision.solesObjetivo} soles` }
  }
  if (sala.fase === 'transito' || sala.fase === 'llegada') {
    const dia = Math.floor(Math.max(0, sala.t) / 86400) + 1
    return { principal: `Día ${dia} · ${formatoHora(sala.ambiente.hora)}`, secundario: `de ${sala.mision.diasTransito} de viaje` }
  }
  return { principal: formatoMET(sala.t), secundario: 'tiempo de misión' }
}

export const escalaTexto = (e: number) =>
  e >= 86400 ? '1 s = 1 día' : e >= 3600 ? `1 s = ${e / 3600} h` : e >= 60 ? `1 s = ${e / 60} min` : e > 1 ? `1 s = ${e} s` : 'tiempo real'

export const diasTexto = (d: number) => (d >= 999 ? 'de sobra' : `${Math.round(d)} d`)
export const mmHg = (kPa: number) => kPa * 7.50062
export const pctTraje = (kg: number) => Math.round((kg / C.TRAJE_O2_KG) * 100)

/** Días de misión que faltan (misma cuenta que el servidor). */
export function diasRestantes(sala: RoomState): number {
  const estancia = (sala.mision.solesObjetivo * C.SOL_S) / 86400
  if (enMarte(sala)) return Math.max(0, estancia - (sala.t - sala.tAterrizaje) / 86400)
  return Math.max(0, sala.mision.diasTransito - Math.max(0, sala.t - 510) / 86400) + estancia
}
