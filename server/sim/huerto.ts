// El huerto, almohadilla por almohadilla: el sustrato se seca, las plantas crecen según el agua,
// la luz y la competencia, y el exceso de humedad trae moho. Las ecuaciones son del juego; los
// cultivos, las almohadillas y los problemas son los del Veggie y el Hábitat Avanzado de la ISS.
import { C } from '../../shared/ciencia.js'
import { ALMOHADILLAS, cultivoDe } from '../../shared/procedimientos.js'
import type { RoomState } from '../../shared/types.js'
import { limitar, log, sis } from '../base.js'

/** kg de O2 por día que da el huerto con todas sus plantas sanas y crecidas (modelo del juego). */
const O2_HUERTO_KG_DIA = 0.7

export function pasoHuerto(room: RoomState, dt: number) {
  const h = room.huerto
  if (!h.establecido) return
  // Salas guardadas antes de que existieran las almohadillas.
  h.almohadillas ??= Array.from({ length: ALMOHADILLAS }, () => ({ humedad: 60, salud: 100, crecimiento: Math.min(0.9, h.diasCultivo / 33), moho: 0, plantulas: 1, raleada: true, muerta: false }))
  const dias = dt / 86400
  const luz = sis(room, 'huerto').operativo ? (h.luz ?? 1) : 0
  const cultivo = cultivoDe(room)
  const viento = h.ventilador === 'alto' ? 1.6 : 1
  let biomasa = 0
  for (const a of h.almohadillas) {
    if (a.muerta) continue
    // La planta transpira y el aire se lleva la humedad; las mechas suben algo de agua del tapete.
    const seca = 7 * viento * (0.5 + Math.min(1, a.crecimiento)) * (luz > 0 ? 1 : 0.4)
    const mecha = a.humedad < 40 ? 3 : 0
    a.humedad = limitar(a.humedad + (mecha - seca) * dias, 0, 100)
    // Moho: con el sustrato empapado y poco aire aparece; pasado cierto punto avanza solo.
    if (a.humedad > 80) a.moho += 0.08 * (viento > 1 ? 0.3 : 1) * dias
    else if (a.moho < 0.25 && a.humedad < 60) a.moho -= 0.03 * dias
    if (a.moho >= 0.25) a.moho += 0.04 * dias
    a.moho = limitar(a.moho, 0, 1)
    // Salud: la sed, las raíces encharcadas y el moho la bajan; con todo en orden se recupera.
    let dano = a.moho * 10
    if (a.humedad < 25) dano += 5
    if (a.humedad < 10) dano += 15
    if (a.humedad > 95) dano += 3
    const bien = a.humedad >= 35 && a.humedad <= 85 && a.moho < 0.1
    a.salud = limitar(a.salud + ((bien ? 3 : 0) - dano) * dias, 0, 100)
    if (a.salud <= 0) {
      a.muerta = true
      log(room, `A plant in the garden died${a.moho > 0.4 ? ' from mold' : a.humedad < 15 ? ' from lack of water' : ''}.`, 'alerta')
      continue
    }
    // Crecimiento: con buena luz, salud y agua llega a la cosecha en los días del cultivo.
    const agua = a.humedad >= 30 && a.humedad <= 88 ? 1 : 0.4
    const competencia = a.plantulas > 1 && a.crecimiento > 0.12 ? 0.7 : 1
    if (a.crecimiento < 1) a.crecimiento = Math.min(1, a.crecimiento + (dias / cultivo.dias) * luz * (a.salud / 100) * agua * competencia)
    biomasa += (a.salud / 100) * (0.2 + 0.8 * a.crecimiento)
  }
  h.diasCultivo += dias

  // Las plantas iluminadas dan algo de oxígeno y absorben CO2.
  if (luz > 0 && biomasa > 0) {
    const o2 = (O2_HUERTO_KG_DIA * (biomasa / ALMOHADILLAS) * dt) / 86400
    room.cabina.ppO2 += o2 / C.KG_O2_POR_KPA
    room.cabina.ppCO2 = Math.max(0.02, room.cabina.ppCO2 - (o2 * (44 / 32)) / C.KG_CO2_POR_KPA)
  }
  for (const a of h.almohadillas) {
    a.humedad = Math.round(a.humedad * 100) / 100
    a.salud = Math.round(a.salud * 100) / 100
    a.crecimiento = Math.round(a.crecimiento * 1e4) / 1e4
    a.moho = Math.round(a.moho * 1e4) / 1e4
  }
}
