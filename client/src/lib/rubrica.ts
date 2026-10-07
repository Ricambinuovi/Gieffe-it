import type { Gruppo, Utente } from "./tipi"

export interface Scelta {
  tutti: boolean
  gruppi: string[]
  utenti: string[]
}

/** Persone che riceveranno il messaggio (senza duplicati e senza il mittente). */
export function destinatariEffettivi(scelta: Scelta, rubrica: Utente[], mittenteId: string): Utente[] {
  return rubrica.filter((u) => {
    if (u.id === mittenteId) return false
    if (scelta.tutti) return true
    if (scelta.utenti.includes(u.id)) return true
    return u.gruppi?.some((g) => scelta.gruppi.includes(g)) ?? false
  })
}

export function riepilogoDestinatari(n: number): string {
  if (n === 0) return "Nessun destinatario"
  return n === 1 ? "Lo riceverà 1 persona" : `Lo riceveranno ${n} persone`
}

export function nomiGruppi(ids: string[], gruppi: Gruppo[]): string[] {
  return ids.map((id) => gruppi.find((g) => g.id === id)?.nome).filter((x): x is string => !!x)
}
