// Ayuda para los scripts de prueba: cruzar la esclusa por la API con el procedimiento de
// ponerse el traje y salir, o de entrar y quitárselo, con los valores que daría un experto
// (ver salida y entrada en shared/procedimientos.ts). Devuelve el error, o null si cruzó.
const VESTIR = ['lcvg', 'inferior', 'superior', 'gorro', 'casco', 'guantes']
const QUITAR = ['guantes', 'casco', 'gorro', 'superior', 'inferior', 'lcvg']
const PASOS = {
  exterior: [{ orden: VESTIR, errores: 0 }, (d) => (d.fuga ? 'falla' : 'pasa'), 'isle', 8, 6, 'radio'],
  nave: ['cepillar', 6, { orden: QUITAR, errores: 0 }],
}

export async function cruzar(base, codigo, token, jugadorId, zona) {
  const procId = `${zona === 'exterior' ? 'salida' : 'entrada'}:${jugadorId}`
  const llamar = async (datos) => {
    const r = await fetch(`${base}/api/juego`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ op: 'procedimiento', codigo, proc: procId, ...datos }),
    })
    return r.json().catch(() => ({ error: `respuesta no JSON (${r.status})` }))
  }
  let sala = null
  for (let k = 0; k < 20; k++) {
    const e = sala?.procedimientos?.[procId]
    const n = e && !e.terminado ? e.paso : 0
    const v = PASOS[zona][n]
    const r = await llamar({ paso: n, valor: typeof v === 'function' ? v(e?.datos ?? {}) : v })
    if (r.error) return r.error
    sala = r.sala
    if (!sala?.procedimientos?.[procId]) return null
  }
  return 'The airlock procedure did not finish.'
}
