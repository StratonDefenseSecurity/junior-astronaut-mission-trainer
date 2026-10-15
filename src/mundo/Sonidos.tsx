// Une el estado de la misión con el motor de sonido: el ambiente de cada escena, la alarma de
// las emergencias, los tonos de radio de las transmisiones, la esclusa y el ejercicio.
import { useEffect, useRef } from 'react'
import { calorEDL, EDL } from '@shared/edl'
import type { Player, RoomState } from '@shared/types'
import { sonido } from '../sonido'
import { enMicrogravedad } from './Interior'

export function useSonidoJuego(sala: RoomState, yo: Player) {
  // El navegador solo deja sonar el audio después de un gesto del usuario.
  useEffect(() => sonido.activarAlInteractuar(), [])

  // ---- Ambiente según dónde se está ----
  const descenso = sala.fase === 'llegada' && sala.subfase === 'descenso'
  const tipo =
    sala.fase === 'lanzamiento' ? 'lanzamiento'
    : descenso ? 'descenso'
    : sala.fase === 'fin' ? 'base'
    : yo.zona === 'exterior' ? 'eva'
    : sala.tAterrizaje > 0 ? 'base'
    : enMicrogravedad(sala) && sala.fase === 'llegada' ? 'orbita'
    : 'nave'
  const t = sala.t
  const td = Math.max(0, t - sala.tFase)
  const parametros =
    tipo === 'lanzamiento'
      ? {
          empuje: t >= 0 && t < 150 ? 1 : t >= 160 && t < 510 ? 0.75 : 0,
          altitudKm: sala.vuelo.altitud,
          // Máxima presión dinámica hacia el minuto y cuarto.
          presionDinamica: Math.exp(-Math.pow((t - 72) / 22, 2)),
        }
      : tipo === 'descenso'
        ? {
            // Momentos reales del descenso de Perseverance (shared/edl.ts).
            calor: calorEDL(td),
            paracaidas: td >= EDL.paracaidas && td < EDL.cubierta ? 1 : 0,
            retro: td >= EDL.cubierta && td < EDL.contacto ? 0.9 : 0,
            marte: 1,
          }
        : tipo === 'eva'
          ? { respiracion: Math.round(yo.vit.fr), viento: Math.min(1, 0.2 + sala.ambiente.tau / 5) }
          : tipo === 'base'
            ? { viento: Math.min(1, (sala.ambiente.tormentaPolvo ? 0.7 : 0.2) + sala.ambiente.tau / 10) }
            : {}
  useEffect(() => {
    sonido.ambiente(tipo, parametros)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, JSON.stringify(parametros)])
  useEffect(() => () => sonido.ambiente('ninguno'), [])

  // ---- Separación de etapas ----
  const separada = sala.fase === 'lanzamiento' && t >= 150
  useEffect(() => {
    if (separada) sonido.evento('separacion')
  }, [separada])

  // ---- Alarma mientras haya una emergencia activa ----
  const emergencia = sala.emergencias.find((e) => e.estado === 'activa')?.id ?? null
  useEffect(() => {
    if (emergencia) sonido.evento('alarma')
    else sonido.detener('alarma')
  }, [emergencia])
  useEffect(() => () => sonido.detener(), [])

  // ---- Ejercicio propio ----
  const ejercicio = yo.manual === 'ejercicio'
  useEffect(() => {
    if (ejercicio) sonido.evento('ejercicio')
    else sonido.detener('ejercicio')
  }, [ejercicio])

  // ---- Esclusa al salir o entrar ----
  const zona = useRef(yo.zona)
  useEffect(() => {
    if (zona.current !== yo.zona) sonido.evento('esclusa', { direccion: yo.zona === 'exterior' ? 'despresurizar' : 'presurizar' })
    zona.current = yo.zona
  }, [yo.zona])

  // ---- Transmisiones: tonos Quindar antes y después, como en el Apolo ----
  useEffect(() => {
    const alLlegar = () => {
      sonido.evento('quindarInicio')
      window.setTimeout(() => sonido.evento('radio', { duracion: 0.4 }), 300)
      window.setTimeout(() => sonido.evento('quindarFin'), 2200)
    }
    window.addEventListener('mt:transmision', alLlegar)
    return () => window.removeEventListener('mt:transmision', alLlegar)
  }, [])

  // ---- Corazón acelerado ----
  const pulso = yo.vit.fc
  useEffect(() => {
    if (pulso < 150) return
    const id = window.setInterval(() => sonido.evento('latido', { volumen: 0.7 }), Math.max(330, 60000 / pulso))
    return () => window.clearInterval(id)
  }, [pulso >= 150, Math.round(pulso / 10)]) // eslint-disable-line react-hooks/exhaustive-deps
}
