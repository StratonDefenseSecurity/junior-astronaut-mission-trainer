// Calidad de los gráficos: "alta" con sombras y más resolución, "ligera" para computadoras
// sencillas. Se recuerda en el navegador; la primera vez se elige según el equipo.
import { create } from 'zustand'

export type Calidad = 'alta' | 'ligera'

function inicial(): Calidad {
  try {
    const v = localStorage.getItem('mt_graficos')
    if (v === 'alta' || v === 'ligera') return v
  } catch {
    // sin almacenamiento: se decide por el equipo
  }
  const nucleos = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4
  const tactil = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  return nucleos <= 4 || tactil ? 'ligera' : 'alta'
}

export const useGraficos = create<{ calidad: Calidad; alternar: () => void }>((set, get) => ({
  calidad: inicial(),
  alternar: () => {
    const calidad: Calidad = get().calidad === 'alta' ? 'ligera' : 'alta'
    try {
      localStorage.setItem('mt_graficos', calidad)
    } catch {
      // no se recuerda, pero el cambio vale para esta pestaña
    }
    set({ calidad })
  },
}))
