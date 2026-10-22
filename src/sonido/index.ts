// API pública del sonido del juego. No depende de React salvo el gancho useSonido().
// Uso típico:
//   sonido.activarAlInteractuar()            // una vez al arrancar: el primer clic o tecla enciende el audio
//   sonido.ambiente('nave')                  // al entrar en una escena
//   sonido.parametros({ empuje, altitudKm }) // cada cuadro o varias veces por segundo
//   sonido.evento('quindarInicio')           // sonidos cortos
// Física, fuentes y límites: README.md de esta carpeta.
import { useSyncExternalStore } from 'react'
import { motor } from './motor'
import { subtitular } from '../accesibilidad'
import type { BucleSonido, EstadoSonido, NombreEvento, OpcionesEvento, ParametrosAmbiente, TipoAmbiente } from './motor'

export type { BucleSonido, EstadoSonido, NombreEvento, OpcionesEvento, ParametrosAmbiente, TipoAmbiente }

export const sonido = {
  /**
   * Crea o reanuda el AudioContext. Debe llamarse desde un gesto del usuario (clic, tecla, toque)
   * por la política de reproducción automática de los navegadores. Se puede llamar muchas veces.
   * Lo que se pidió antes (ambiente, alarma, ejercicio) empieza a sonar al activar.
   */
  activar: (): Promise<void> => motor.activar(),
  /** Escucha el primer gesto del usuario y activa el sonido con él. Devuelve la función para cancelar. */
  activarAlInteractuar: (): (() => void) => motor.activarAlInteractuar(),
  /** Silencia o devuelve el sonido (también las voces). Se recuerda en localStorage. */
  silenciar: (b: boolean): void => motor.silenciar(b),
  /** Volumen maestro 0..1 (por defecto 0.6). Se recuerda en localStorage. */
  volumen: (v: number): void => motor.volumen(v),
  /** { activo, silenciado, volumen }. La referencia solo cambia cuando cambia algún valor. */
  estado: (): EstadoSonido => motor.estado(),
  /** Avisa cuando cambia estado(). Devuelve la función para dejar de escuchar. */
  suscribir: (fn: () => void): (() => void) => motor.suscribir(fn),
  /**
   * Cambia el ambiente continuo con un fundido de 1.5 s. Llamarlo con el mismo tipo solo
   * actualiza los parámetros. 'ninguno' es silencio (por ejemplo, una toma exterior en el vacío).
   */
  ambiente: (tipo: TipoAmbiente, parametros?: ParametrosAmbiente): void => motor.ambiente(tipo, parametros),
  /** Actualiza los parámetros vivos. Es barato: no crea nodos y aplica como mucho 20 veces por segundo. */
  parametros: (p: ParametrosAmbiente): void => motor.parametros(p),
  /** Sonido corto. 'alarma' y 'ejercicio' se repiten hasta detener(nombre). Sin activar, no suena. */
  evento: (nombre: NombreEvento, opciones?: OpcionesEvento): void => {
    subtitular(nombre) // subtítulo del sonido, si el jugador los activó (src/accesibilidad.ts)
    motor.evento(nombre, opciones)
  },
  /** Detiene 'alarma' o 'ejercicio'; sin nombre, los dos. */
  detener: (nombre?: NombreEvento): void => motor.detener(nombre),
  /** El AudioContext, o null si aún no se activó. */
  contexto: (): AudioContext | null => motor.contexto(),
  /**
   * Nodo de entrada para el chat de voz: lo que se conecte aquí respeta el silencio y el volumen.
   * Ejemplo: fuente.connect(new PannerNode(ctx, { panningModel: 'HRTF' })).connect(sonido.destinoVoces()!)
   * Es null hasta activar.
   */
  destinoVoces: (): GainNode | null => motor.destinoVoces(),
}

/** Estado del sonido para React: vuelve a renderizar cuando cambia el silencio, el volumen o la activación. */
export function useSonido(): EstadoSonido {
  return useSyncExternalStore(motor.suscribir, motor.estado, motor.estado)
}
