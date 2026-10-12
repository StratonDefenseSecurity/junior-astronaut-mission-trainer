import { azar } from './reloj.js'
import { MODULE_BY_ID, type Emergency, type EmergencyAlternative, type ModuleId, type Role, type RoomState } from '../shared/types.js'

export interface EmergencyDef {
  tipo: string
  titulo: string
  descripcion: (room: RoomState) => string
  roles: Role[]
  alternativas: EmergencyAlternative[] // la última es la peor (se aplica si nadie decide)
  condicion: (room: RoomState) => boolean
  alIniciar?: (room: RoomState) => void
}

const sis = (room: RoomState, id: ModuleId) => room.sistemas.find((s) => s.id === id)!
const tripulacion = (room: RoomState) => room.jugadores.filter((j) => j.rol)
const horaAbs = (room: RoomState) => room.mision.sol * 24 + room.mision.hora

export const EMERGENCIAS: EmergencyDef[] = [
  {
    tipo: 'tormenta',
    titulo: 'Tormenta solar',
    descripcion: () => 'Se detecta una eyección de masa coronal. La radiación subirá durante las próximas 8 horas.',
    roles: ['medico', 'comandante'],
    condicion: (r) => !r.tormenta,
    alIniciar: (r) => {
      r.tormenta = true
      r.tormentaHasta = horaAbs(r) + 8
    },
    alternativas: [
      { id: 'refugio', etiqueta: 'Toda la tripulación al refugio', consecuencia: 'Dosis -90%. Sin producción ni experimentos por 8 horas.' },
      { id: 'parcial', etiqueta: 'Refugio parcial', consecuencia: 'Solo sistemas sigue trabajando. Dosis -60% para el resto, sistemas recibe dosis completa.' },
      { id: 'seguir', etiqueta: 'Seguir trabajando', consecuencia: 'Producción normal. Toda la tripulación recibe la dosis completa.' },
    ],
  },
  {
    tipo: 'fallo_soporte',
    titulo: 'Fallo del soporte vital',
    descripcion: (r) => `El regenerador de oxígeno se detuvo (integridad ${Math.round(sis(r, 'soporteVital').integridad)}%). El oxígeno cae el doble de rápido.`,
    roles: ['sistemas'],
    condicion: (r) => sis(r, 'soporteVital').online,
    alIniciar: (r) => {
      sis(r, 'soporteVital').online = false
    },
    alternativas: [
      { id: 'reparar', etiqueta: 'Reparar con repuestos', consecuencia: 'Usa 3 repuestos. Módulo al 80%.' },
      { id: 'reinicio', etiqueta: 'Reinicio de emergencia', consecuencia: '50% de éxito. Si falla, el módulo queda al 15%.' },
      { id: 'esperar', etiqueta: 'Esperar al próximo sol', consecuencia: 'Sin repuestos gastados. El oxígeno sigue cayendo rápido 12 horas.' },
    ],
  },
  {
    tipo: 'fuga_agua',
    titulo: 'Fuga en el tanque de agua',
    descripcion: (r) => `Una junta cedió. Quedan ${Math.round(r.recursos.agua)} L y se pierden 40 L si no se actúa.`,
    roles: ['logistica'],
    condicion: (r) => r.recursos.agua > 30,
    alternativas: [
      { id: 'sellar', etiqueta: 'Sellar con repuestos', consecuencia: 'Usa 1 repuesto. Se pierden solo 5 L.' },
      { id: 'trasvasar', etiqueta: 'Trasvasar a mano', consecuencia: 'Se pierden 20 L. Quien lo haga pierde 5 de salud por esfuerzo.' },
      { id: 'ignorar', etiqueta: 'Dejar que drene', consecuencia: 'Se pierden 40 L.' },
    ],
  },
  {
    tipo: 'medico',
    titulo: 'Tripulante con síntomas',
    descripcion: (r) => {
      const t = tripulacion(r)
      const p = t[Math.floor(azar(r) * t.length)]
      return `${p?.nombre ?? 'Un tripulante'} presenta mareos y fiebre. Puede ser deshidratación o una infección.`
    },
    roles: ['medico'],
    condicion: (r) => tripulacion(r).length > 0,
    alternativas: [
      { id: 'tratar', etiqueta: 'Tratar con botiquín', consecuencia: 'Usa 1 botiquín. Recupera 10 de salud.' },
      { id: 'reposo', etiqueta: 'Reposo 8 horas', consecuencia: 'El tripulante queda fuera de servicio 8 horas. No gasta botiquín.' },
      { id: 'ignorar', etiqueta: 'Seguir trabajando', consecuencia: 'Pierde 20 de salud y puede contagiar.' },
    ],
  },
  {
    tipo: 'panel',
    titulo: 'Panel solar dañado',
    descripcion: () => 'Una ráfaga de polvo cubrió los paneles. La generación cae a la mitad hasta limpiarlos.',
    roles: ['sistemas', 'piloto'],
    condicion: (r) => sis(r, 'energia').online,
    alIniciar: (r) => {
      sis(r, 'energia').integridad = Math.max(10, sis(r, 'energia').integridad - 35)
    },
    alternativas: [
      { id: 'limpiar', etiqueta: 'Salida extravehicular para limpiar', consecuencia: 'Planta al 90%. Quien sale recibe dosis de radiación (-6 salud).' },
      { id: 'rover', etiqueta: 'Limpiar con el rover', consecuencia: 'Usa 2 repuestos. Planta al 75%. Nadie se expone.' },
      { id: 'esperar', etiqueta: 'Esperar a que el viento limpie', consecuencia: 'La planta sigue dañada. -10 de energía.' },
    ],
  },
  {
    tipo: 'escasez',
    titulo: 'Inventario de alimentos incorrecto',
    descripcion: (r) => `Al revisar el almacén faltan raciones. Hay ${Math.round(r.recursos.alimentos)} raciones reales.`,
    roles: ['logistica', 'comandante'],
    condicion: (r) => r.recursos.alimentos > 20,
    alIniciar: (r) => {
      r.recursos.alimentos = Math.max(0, r.recursos.alimentos - 15)
    },
    alternativas: [
      { id: 'racion', etiqueta: 'Pasar a ración de ahorro', consecuencia: 'Consumo al 80% hasta nuevo aviso.' },
      { id: 'huerto', etiqueta: 'Priorizar el huerto', consecuencia: 'Si el huerto está establecido, +15 raciones. Si no, nada cambia.' },
      { id: 'nada', etiqueta: 'Mantener consumo', consecuencia: 'Nada cambia. El riesgo de quedarse sin comida sube.' },
    ],
  },
]

export function aplicarAlternativa(room: RoomState, em: Emergency, altId: string): string {
  const r = room.recursos
  const t = tripulacion(room)
  const dañar = (n: number, filtro?: (p: (typeof t)[number]) => boolean) => {
    for (const p of t) if (!filtro || filtro(p)) p.salud = Math.max(0, p.salud - n)
  }
  switch (em.tipo) {
    case 'tormenta':
      if (altId === 'refugio') {
        room.enRefugio = true
        room.refugioHasta = horaAbs(room) + 8
        for (const j of room.jugadores) j.ubicacion = 'refugio'
        return 'La tripulación está a salvo en el refugio.'
      }
      if (altId === 'parcial') {
        for (const j of room.jugadores) if (j.rol !== 'sistemas') j.ubicacion = 'refugio'
        dañar(6, (p) => p.rol !== 'sistemas')
        dañar(14, (p) => p.rol === 'sistemas')
        return 'Sistemas quedó expuesto; el resto redujo su dosis.'
      }
      dañar(14)
      return 'Toda la tripulación recibió la dosis completa.'

    case 'fallo_soporte': {
      const mod = sis(room, 'soporteVital')
      if (altId === 'reparar') {
        if (r.repuestos >= 3) {
          r.repuestos -= 3
          mod.integridad = 80
          mod.online = true
          return 'Soporte vital reparado y en línea.'
        }
        mod.integridad = 15
        return 'No había repuestos suficientes. El módulo sigue apagado.'
      }
      if (altId === 'reinicio') {
        if (azar(room) < 0.5) {
          mod.online = true
          return 'El reinicio funcionó.'
        }
        mod.integridad = 15
        return 'El reinicio falló. Integridad al 15%.'
      }
      return 'El soporte vital sigue apagado. Sistemas debe repararlo.'
    }

    case 'fuga_agua':
      if (altId === 'sellar') {
        if (r.repuestos >= 1) {
          r.repuestos -= 1
          r.agua = Math.max(0, r.agua - 5)
          return 'Fuga sellada. Se perdieron 5 L.'
        }
        r.agua = Math.max(0, r.agua - 40)
        return 'Sin repuestos: se perdieron 40 L.'
      }
      if (altId === 'trasvasar') {
        r.agua = Math.max(0, r.agua - 20)
        const log = t.find((p) => p.rol === 'logistica') ?? t[0]
        if (log) log.salud = Math.max(0, log.salud - 5)
        return 'Se trasvasó a mano. Se perdieron 20 L.'
      }
      r.agua = Math.max(0, r.agua - 40)
      return 'Se perdieron 40 L de agua.'

    case 'medico': {
      const nombre = em.descripcion.split(' presenta')[0]
      const p = t.find((x) => x.nombre === nombre) ?? t[0]
      if (!p) return 'Sin tripulación afectada.'
      if (altId === 'tratar') {
        if (r.botiquines >= 1) {
          r.botiquines -= 1
          p.salud = Math.min(100, p.salud + 10)
          return `${p.nombre} fue tratado y se recupera.`
        }
        p.fueraDeServicio = 8
        return 'No había botiquines. Queda en reposo 8 horas.'
      }
      if (altId === 'reposo') {
        p.fueraDeServicio = 8
        return `${p.nombre} queda fuera de servicio 8 horas.`
      }
      p.salud = Math.max(0, p.salud - 20)
      if (azar(room) < 0.4) dañar(5, (x) => x.id !== p.id)
      return `${p.nombre} empeoró y pudo contagiar a otros.`
    }

    case 'panel': {
      const mod = sis(room, 'energia')
      if (altId === 'limpiar') {
        mod.integridad = 90
        const s = t.find((p) => p.rol === 'sistemas') ?? t[0]
        if (s) s.salud = Math.max(0, s.salud - 6)
        return 'Paneles limpios. Quien salió recibió radiación.'
      }
      if (altId === 'rover') {
        if (r.repuestos >= 2) {
          r.repuestos -= 2
          mod.integridad = 75
          return 'Rover limpió los paneles.'
        }
        r.energia = Math.max(0, r.energia - 10)
        return 'Sin repuestos para el rover. La planta sigue dañada.'
      }
      r.energia = Math.max(0, r.energia - 10)
      return 'Los paneles siguen cubiertos de polvo.'
    }

    case 'escasez':
      if (altId === 'racion') {
        room.racion = 'ahorro'
        return 'Ración de ahorro activada.'
      }
      if (altId === 'huerto') {
        if (room.huerto.establecido) {
          r.alimentos = Math.min(room.capacidad.alimentos, r.alimentos + 15)
          return 'El huerto compensó parte de la pérdida.'
        }
        return 'El huerto no está establecido. Nada cambió.'
      }
      return 'Consumo sin cambios.'
  }
  return `${MODULE_BY_ID.habitat.nombre}: sin efecto.`
}
