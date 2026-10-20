// Consecuencias de los trabajos de la tripulación que se hacen paso a paso: salir y entrar por
// la esclusa, reparar un equipo cambiando la unidad, sellar una fuga, cambiar un cartucho de LiOH,
// limpiar los paneles, tomar y analizar muestras y curar a un paciente. Los pasos y su
// explicación real están en shared/procedimientos.ts; server/procedimientos.ts llama aquí.
import { C } from '../shared/ciencia.js'
import {
  CONDICIONES,
  DCS,
  FUGA_TRAJE_KG_H,
  MAX_MUESTRAS,
  RIESGO_DCS,
  VALOR_MINIMO_MUESTRA,
  condicionDe,
  kitsReparacion,
  type Procedimiento,
} from '../shared/procedimientos.js'
import { SISTEMA_BY_ID, type Player, type RoomState, type SistemaId } from '../shared/types.js'
import { jugador, limitar, log, sis } from './base.js'
import { lanzarEmergencia } from './emergencies.js'
import { cambiarZona } from './game.js'
import { ahora, azar } from './reloj.js'

const r2 = (v: number) => Math.round(v * 100) / 100
const familia = (p: Procedimiento) => p.id.split(':')[0]
const nombreSitio = (id: string) => `Sample Site ${id.replace('muestra', '')}`
/** Errores que se cometieron en un paso de ordenar (su valor guardado). */
const errores = (v: unknown) => (typeof v === 'number' ? v : 0)

/** Vuelve al paso `k` conservando lo hecho antes, con datos nuevos para lo que viene. */
function reiniciar(room: RoomState, p: Procedimiento, k: number, datos: Record<string, number>) {
  const e = room.procedimientos![p.id]
  e.paso = k
  e.calidad = e.calidad.slice(0, k)
  e.por = e.por.slice(0, k)
  e.valores = (e.valores ?? []).slice(0, k)
  e.datos = { ...datos, ultimo: ahora() }
}

/** Da por resuelta la emergencia abierta que este trabajo acaba de arreglar. */
function resolverEmergencia(room: RoomState, filtro: (tipo: string, d: Record<string, unknown>) => boolean, resultado: string) {
  for (const em of room.emergencias) {
    if (em.estado !== 'activa' || !filtro(em.tipo, em.datos)) continue
    em.estado = 'resuelta'
    em.elegida = em.alternativas[0]?.id ?? null
    em.resultado = resultado
  }
}

/** Lo que impide hacer un paso aunque el procedimiento esté disponible. */
export function antesDePasoTrabajo(room: RoomState, p: Procedimiento, i: number, j: Player): string | null {
  const def = p.pasos[i]
  const d = room.procedimientos?.[p.id]?.datos ?? {}
  const v = room.procedimientos?.[p.id]?.valores ?? []
  if (def.cambiaZona === 'exterior' && !(p.puedeEmpezar?.(room) ?? true)) return p.motivo?.(room) ?? 'You cannot go outside right now.'
  switch (familia(p)) {
    case 'muestra':
      if (i === 0 && j.muestras >= MAX_MUESTRAS) return `You are already carrying ${MAX_MUESTRAS} samples. Analyze them in the lab.`
      break
    case 'reparar':
      if (def.id === 'instalar') {
        const n = kitsReparacion(sis(room, p.objetivo as SistemaId).integridad)
        if (room.rec.repuestos < n) return `You need ${n} spare parts kit${n > 1 ? 's' : ''} and ${room.rec.repuestos} ${room.rec.repuestos === 1 ? 'is' : 'are'} left.`
      }
      break
    case 'sellar':
      if (def.id === 'presionar' && !d.kit && room.rec.repuestos < 1) return 'No spare parts left.'
      break
    case 'lioh':
      if (i === 0 && room.rec.lioh < 1) return 'No cartridges left.'
      break
    case 'analizar':
      if (def.id === 'medir') {
        const kwh = (v[1] === 'ambos' ? 1.5 : 0.8) * Math.max(1, j.muestras)
        if (room.energia.bateria < kwh + 2 && room.energia.generacion <= room.energia.consumo) return 'There is not enough power for the lab.'
      }
      break
    case 'tratar': {
      const paciente = jugador(room, String(p.objetivo))
      if (!paciente) return 'Invalid patient.'
      if (paciente.zona !== 'nave') return `${paciente.nombre} is outside. Treat them inside the habitat.`
      if (def.id === 'tratamiento' && room.rec.botiquines < 1) return 'No medical kits left.'
      break
    }
  }
  return null
}

/** Prepara la lectura de un instrumento: si hay fuga, si la unidad quedó mal, cómo baja el CO2... */
export function prepararTrabajo(room: RoomState, p: Procedimiento, i: number) {
  const e = room.procedimientos?.[p.id]
  if (!e) return
  const d = (e.datos ??= {})
  const v = e.valores ?? []
  const prob = (x: number) => (d.reintento ? 0 : limitar(x, 0, 0.9))
  switch (`${familia(p)}:${p.pasos[i]?.id}`) {
    case 'salida:fugas':
      // Un traje mal puesto tiene más posibilidades de perder aire (modelo del juego).
      d.fuga = azar(room) < prob(0.12 + 0.15 * errores(v[0])) ? 1 : 0
      break
    case 'reparar:prueba':
      d.fallo = azar(room) < prob(0.12 + 0.12 * (errores(v[1]) + errores(v[3]))) ? 1 : 0
      break
    case 'sellar:decaimiento':
      d.resto = azar(room) < prob(({ doble: 0.08, sellante: 0.35, cinta: 0.6 } as Record<string, number>)[String(v[1])] ?? 0.3) ? 1 : 0
      break
    case 'lioh:co2':
      d.malo = azar(room) < prob(0.08 + 0.2 * errores(v[0])) ? 1 : 0
      d.co2 = Math.round(room.cabina.ppCO2 * 7.50062 * 10)
      break
    case 'tratar:vitales': {
      const paciente = jugador(room, String(p.objetivo))
      if (!paciente) break
      d.fc = Math.round(paciente.vit.fc)
      d.fr = Math.round(paciente.vit.fr)
      d.spo2 = Math.round(paciente.vit.spo2)
      // Lo que tiene el paciente se anota al examinarlo, aunque cambie mientras se le trata.
      d.cond = CONDICIONES.indexOf(condicionDe(paciente))
      break
    }
  }
}

/** Lo que pasa justo al hacer un paso. Devuelve true si el procedimiento vuelve atrás. */
export function alHacerPasoTrabajo(room: RoomState, p: Procedimiento, i: number, j: Player, valor: number | string | null): boolean {
  const e = room.procedimientos![p.id]
  const d = (e.datos ??= {})
  const v = e.valores ?? []
  const def = p.pasos[i]
  switch (`${familia(p)}:${def.id}`) {
    case 'salida:fugas':
      if (valor === 'falla') {
        reiniciar(room, p, 0, { reintento: 1 })
        log(room, `${j.nombre} found a leak in the suit. Every seal gets checked and the leak test is repeated.`, 'alerta')
        return true
      }
      break
    case 'reparar:retirar':
      if (v[0] === 'apagar' && azar(room) < 0.15) {
        lanzarEmergencia(room, 'medico', { jugadorId: j.id, nombre: j.nombre, dolencia: 'a hand injury' })
        log(room, `Someone switched the ${SISTEMA_BY_ID[p.objetivo as SistemaId].nombre} back on while ${j.nombre} had a hand inside. There was no lock on the breaker.`, 'alerta')
      }
      break
    case 'reparar:instalar': {
      const n = kitsReparacion(sis(room, p.objetivo as SistemaId).integridad)
      room.rec.repuestos -= n
      d.kits = n
      break
    }
    case 'reparar:prueba':
      if (valor === 'falla') {
        reiniciar(room, p, 3, { reintento: 1, kits: d.kits ?? 0 })
        log(room, `${j.nombre} found a connector that was not fully seated. The unit gets reconnected and tested again.`, 'alerta')
        return true
      }
      break
    case 'sellar:buscar':
      if (valor === 'esperar') {
        const perdida = r2(Math.min(room.rec.o2, room.cabina.fuga * 4 * 0.23))
        room.rec.o2 -= perdida
        log(room, `While the crew waited, the leak kept going. ${perdida} kg of oxygen from the reserves went into the lost air.`, 'alerta')
      }
      break
    case 'sellar:presionar':
      if (!d.kit) {
        room.rec.repuestos -= 1
        d.kit = 1
      }
      break
    case 'sellar:decaimiento':
      if (valor === 'falla') {
        reiniciar(room, p, 1, { reintento: 1, kit: d.kit ?? 1 })
        log(room, `${j.nombre} sees that the pressure still drops. The patch gets redone with what is left of the kit.`, 'alerta')
        return true
      }
      break
    case 'lioh:co2':
      if (valor === 'falla') {
        reiniciar(room, p, 0, { reintento: 1 })
        log(room, `${j.nombre} sees that the CO2 is not dropping. The cartridge gets seated again.`, 'alerta')
        return true
      }
      break
    case 'muestra:perforar':
      if (v[1] === 'fracturada' && !d.desmoronada && azar(room) < 0.5) {
        reiniciar(room, p, 1, { desmoronada: 1 })
        log(room, `The rock crumbled into powder when ${j.nombre} drilled it, like the first rock Perseverance tried. Another rock has to be chosen.`, 'alerta')
        return true
      }
      break
    case 'analizar:medir': {
      const kwh = (v[1] === 'ambos' ? 1.5 : 0.8) * Math.max(1, j.muestras)
      room.energia.bateria = Math.max(0, room.energia.bateria - kwh)
      break
    }
  }
  // Cruzar la esclusa: al final de salir, o al cerrar la escotilla al volver.
  if (def.cambiaZona && j.zona !== def.cambiaZona) cambiarZona(room, j.id, def.cambiaZona)
  return false
}

/** Consecuencias de un trabajo terminado. */
export function alTerminarTrabajo(room: RoomState, p: Procedimiento, j: Player) {
  const e = room.procedimientos![p.id]
  const v = e.valores ?? []
  const q = e.calidad
  const d = e.datos ?? {}
  const objetivo = String(p.objetivo ?? '')
  switch (familia(p)) {
    case 'salida': {
      if (v[2] === 'cuatro') j.vit.fatiga = limitar(j.vit.fatiga + 10, 0, 100)
      if ((d.fuga ?? 0) > 0 && q[1] === 0) {
        j.trajeFuga = FUGA_TRAJE_KG_H
        log(room, `${j.nombre} went outside with a leaking suit. Its oxygen will run out sooner.`, 'alerta')
      }
      const riesgo = RIESGO_DCS[String(v[2])] ?? 0
      if (riesgo > 0 && azar(room) < riesgo && j.dolencia !== DCS) {
        j.vit.salud = limitar(j.vit.salud - 10, 0, 100)
        log(room, `${j.nombre} feels a deep pain in the knees and shoulders: decompression sickness, the bends. The prebreathe was too short.`, 'alerta')
        lanzarEmergencia(room, 'medico', { jugadorId: j.id, nombre: j.nombre, dolencia: DCS })
      } else if (riesgo > 0) log(room, `${j.nombre} went outside after a short prebreathe and was lucky this time.`, 'alerta')
      break
    }
    case 'entrada': {
      if (v[0] === 'dentro') {
        const s = sis(room, 'cdra')
        s.integridad = Math.max(20, s.integridad - 3)
        log(room, `${j.nombre} brought dust into the habitat. It clogs the filters of the CO2 Scrubber (${Math.round(s.integridad)}%).`, 'alerta')
      }
      if (j.trajeFuga) {
        delete j.trajeFuga
        log(room, `The leak in ${j.nombre}'s suit was found in the airlock and the seal was replaced.`, 'ok')
      }
      break
    }
    case 'reparar': {
      const s = sis(room, objetivo as SistemaId)
      const nombre = SISTEMA_BY_ID[s.id].nombre
      const mal = (d.fallo ?? 0) > 0 && q[4] === 0
      s.integridad = Math.min(100, s.integridad + (mal ? 15 : 45))
      s.activo = true
      j.vit.fatiga = limitar(j.vit.fatiga + 3, 0, 100)
      log(
        room,
        mal
          ? `${j.nombre} marked the ${nombre} as repaired, but a connector is loose and it only got back to ${Math.round(s.integridad)}%.`
          : `${j.nombre} swapped the worn unit of the ${nombre}. It is at ${Math.round(s.integridad)}% and ${room.rec.repuestos} spare parts kits are left.`,
        mal ? 'alerta' : 'ok',
      )
      if (s.integridad > 15) resolverEmergencia(room, (tipo, x) => tipo === 'fallo' && x.sistema === s.id, `The ${nombre} was repaired step by step.`)
      break
    }
    case 'sellar': {
      const resto = (d.resto ?? 0) > 0 && q[3] === 0
      room.cabina.fuga = resto ? 0.15 : 0
      log(room, resto ? `${j.nombre} marked the leak as sealed, but air still escapes at the edge of the patch.` : `${j.nombre} sealed the pressure leak. The pressure holds.`, resto ? 'alerta' : 'ok')
      resolverEmergencia(room, (tipo) => tipo === 'fuga', 'The leak was found and sealed step by step.')
      break
    }
    case 'lioh': {
      const malo = (d.malo ?? 0) > 0 && q[1] === 0
      room.rec.lioh -= 1
      room.rec.liohActivo += malo ? C.LIOH_KG_CO2 * 0.4 : C.LIOH_KG_CO2
      log(room, malo ? `${j.nombre} installed a cartridge that is not sealed in its socket. Most of the air goes around it.` : `${j.nombre} installed a lithium hydroxide cartridge. ${room.rec.lioh} left.`, malo ? 'alerta' : 'ok')
      break
    }
    case 'limpiar': {
      const limpio = (q[0] ?? 1) * (q[1] ?? 1)
      const ef = (room.efectos ??= {})
      const antes = Math.round(room.energia.polvo * 100)
      room.energia.polvo = r2(0.01 + Math.max(0, room.energia.polvo - 0.01) * (1 - limpio))
      if (v[0] === 'duro') ef.solar = r2((ef.solar ?? 1) * 0.95)
      if (v[1] === 'circulos') ef.solar = r2((ef.solar ?? 1) * 0.98)
      j.vit.fatiga = limitar(j.vit.fatiga + 5, 0, 100)
      log(room, `${j.nombre} cleaned the solar panels. Dust went from ${antes}% to ${Math.round(room.energia.polvo * 100)}%.${v[0] === 'duro' || v[1] === 'circulos' ? ' The cover glass got scratched and will always catch a little less light.' : ''}`, limpio < 0.8 ? 'alerta' : 'ok')
      break
    }
    case 'muestra': {
      const valor = r2((q[1] ?? 1) * (q[3] ?? 1) * (q[5] ?? 1))
      ;(j.muestrasTomadas ??= []).push({ sitio: objetivo, roca: String(v[1] ?? 'capas'), valor })
      j.muestras += 1
      if (!room.muestreos.includes(objetivo)) room.muestreos.push(objetivo)
      j.vit.fatiga = limitar(j.vit.fatiga + 3, 0, 100)
      log(room, `${j.nombre} sealed a sample from ${nombreSitio(objetivo)}. ${j.muestras} of ${MAX_MUESTRAS} tubes carried.`, 'ok')
      break
    }
    case 'analizar': {
      const lab = (q[0] ?? 1) * (q[1] ?? 1) * (q[3] === 0 ? 0.5 : 1)
      const tomadas = j.muestrasTomadas?.length ? j.muestrasTomadas : Array.from({ length: j.muestras }, () => ({ sitio: '', roca: 'capas', valor: 1 }))
      let cuentan = 0
      const malas: string[] = []
      for (const m of tomadas) {
        if (m.valor * lab >= VALOR_MINIMO_MUESTRA) cuentan += 1
        else if (m.sitio) {
          malas.push(nombreSitio(m.sitio))
          room.muestreos = room.muestreos.filter((x) => x !== m.sitio)
        }
      }
      room.mision.muestrasAnalizadas += cuentan
      log(room, `${j.nombre} analyzed ${tomadas.length} sample${tomadas.length === 1 ? '' : 's'}. ${cuentan === tomadas.length ? 'All of them count' : `${cuentan} count`} toward the objective: ${room.mision.muestrasAnalizadas} of ${room.mision.muestrasObjetivo} done.`, cuentan === tomadas.length ? 'ok' : 'alerta')
      if (malas.length) log(room, `Not good enough to count: the sample from ${malas.join(', ')}. ${malas.length === 1 ? 'That site' : 'Those sites'} can be sampled again.`, 'alerta')
      j.muestras = 0
      j.muestrasTomadas = []
      break
    }
    case 'tratar': {
      const paciente = jugador(room, objetivo)
      if (!paciente) break
      const c = CONDICIONES[d.cond ?? -1] ?? condicionDe(paciente)
      room.rec.botiquines = Math.max(0, room.rec.botiquines - 1)
      if (v[4] === c.id) {
        if (c.id === 'dcs') room.rec.o2 = Math.max(0, room.rec.o2 - 0.5)
        paciente.dolencia = null
        paciente.incapacitado = 0
        paciente.vit.salud = limitar(paciente.vit.salud + (c.urgente && v[3] === 'consultar' ? 12 : 20), 0, 100)
        if (paciente.ayuda?.paraRol === 'medico') paciente.ayuda = null
        resolverEmergencia(room, (tipo, x) => (tipo === 'medico' || tipo === 'mareo') && x.jugadorId === paciente.id, `${paciente.nombre} was treated in the Medical Bay.`)
        log(room, `${j.nombre} treated ${paciente.id === j.id ? 'themself' : paciente.nombre}: ${c.diagnostico.toLowerCase()}.`, 'ok')
      } else {
        paciente.vit.salud = limitar(paciente.vit.salud + 3, 0, 100)
        log(room, `The treatment did not help ${paciente.nombre}. ${paciente.dolencia ? `They still have ${paciente.dolencia}.` : 'They still need care.'} A medical kit was used.`, 'alerta')
      }
      break
    }
  }
}
