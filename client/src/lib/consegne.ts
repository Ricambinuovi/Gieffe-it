import type { Consegna } from "./tipi"

/**
 * Le date di PocketBase sono nel formato "2026-10-07 10:14:31.444Z" (con lo spazio):
 * WebKit, usato da Tauri su Linux e Mac, non le legge. Si sostituisce lo spazio con "T".
 */
export function leggiData(testo: string | undefined | null): number | null {
  if (!testo) return null
  const t = Date.parse(testo.replace(" ", "T"))
  return Number.isNaN(t) ? null : t
}

/** Una consegna va mostrata se è in attesa, o se il posticipo è scaduto. */
export function daMostrare(c: Pick<Consegna, "stato" | "posticipato_fino_a">, adesso: number): boolean {
  if (c.stato === "in_attesa") return true
  if (c.stato === "posticipato") {
    const fino = leggiData(c.posticipato_fino_a)
    return fino !== null && fino <= adesso
  }
  return false
}

/** Inserisce o aggiorna una consegna nella lista (ordinata dalla più vecchia), oppure la toglie. */
export function aggiornaLista(lista: Consegna[], c: Consegna, adesso: number): Consegna[] {
  const senza = lista.filter((x) => x.id !== c.id)
  if (!daMostrare(c, adesso)) return senza
  const precedente = lista.find((x) => x.id === c.id)
  const voce = precedente?.expand && !c.expand ? { ...c, expand: precedente.expand } : c
  return [...senza, voce].sort((a, b) => (leggiData(a.created) ?? 0) - (leggiData(b.created) ?? 0))
}

export function rimuovi(lista: Consegna[], id: string): Consegna[] {
  return lista.filter((x) => x.id !== id)
}

/** "oggi 14:32" / "ieri 09:10" / "03/10 16:45" */
export function formattaOra(testo: string, adesso: Date = new Date()): string {
  const t = leggiData(testo)
  if (t === null) return ""
  const d = new Date(t)
  const hm = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
  const giorno = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((giorno(adesso) - giorno(d)) / 86_400_000)
  if (diff === 0) return hm
  if (diff === 1) return `ieri ${hm}`
  return `${d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })} ${hm}`
}
