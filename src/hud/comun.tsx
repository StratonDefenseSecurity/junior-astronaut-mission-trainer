import { useEffect, useState, type ReactNode } from 'react'
import { C } from '@shared/ciencia'
import { escenarioDe, fechaCorta, fechaDeMision } from '@shared/escenarios'
import { ROLE_BY_ID, TRANSITO_INICIO_S, formatoHora, formatoMET, type Role, type RoomState } from '@shared/types'
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
/** Fecha real (calendario terrestre, UTC) del instante actual de la misión. */
export const fechaActual = (sala: RoomState) => fechaDeMision(escenarioDe(sala.escenario), Math.max(0, sala.t))

export function relojMision(sala: RoomState): { principal: string; secundario: string } {
  const fecha = fechaCorta(fechaActual(sala))
  if (enMarte(sala)) {
    return { principal: `Sol ${sala.ambiente.sol} · ${formatoHora(sala.ambiente.hora)}`, secundario: `de ${sala.mision.solesObjetivo} soles · ${fecha}` }
  }
  if (sala.fase === 'transito' || sala.fase === 'llegada') {
    const dia = Math.floor(Math.max(0, sala.t) / 86400) + 1
    return { principal: `Día ${dia} · ${formatoHora(sala.ambiente.hora)}`, secundario: `de ${sala.mision.diasTransito} de viaje · ${fecha}` }
  }
  return { principal: formatoMET(sala.t), secundario: `tiempo de misión · ${fecha}` }
}

/** Días y horas que la tripulación lleva en el espacio, desde que alcanzó la órbita hasta aterrizar. */
export function tiempoEnEspacio(sala: RoomState): string {
  const fin = sala.tAterrizaje > 0 ? sala.tAterrizaje : sala.t
  const s = Math.max(0, fin - TRANSITO_INICIO_S)
  const dias = Math.floor(s / 86400)
  const horas = Math.floor((s % 86400) / 3600)
  if (dias > 0) return `${dias} d ${horas} h`
  return horas > 0 ? `${horas} h ${Math.floor((s % 3600) / 60)} min` : `${Math.floor(s / 60)} min`
}

/** Energía eléctrica consumida desde el despegue, con una unidad legible. */
export const energiaUsada = (sala: RoomState): string => {
  const kwh = sala.energia.usada ?? 0
  return kwh >= 10_000 ? `${(kwh / 1000).toFixed(1)} MWh` : kwh >= 100 ? `${Math.round(kwh)} kWh` : `${kwh.toFixed(1)} kWh`
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
