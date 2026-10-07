import { test, expect } from "vitest"
import { aggiornaLista, daMostrare, formattaOra, leggiData, rimuovi } from "./consegne"
import type { Consegna } from "./tipi"

const cons = (id: string, stato: Consegna["stato"], extra: Partial<Consegna> = {}): Consegna => ({
  id, messaggio: "m" + id, destinatario: "u1", stato,
  posticipato_fino_a: "", azione_il: "", created: "2026-10-07 10:00:00.000Z", ...extra,
})

test("leggiData accetta il formato di PocketBase con lo spazio", () => {
  expect(leggiData("2026-10-07 10:14:31.444Z")).toBe(Date.UTC(2026, 9, 7, 10, 14, 31, 444))
  expect(leggiData("")).toBeNull()
  expect(leggiData("boh")).toBeNull()
})

test("daMostrare: in attesa sì, chiusi no, posticipati solo se scaduti", () => {
  const adesso = Date.UTC(2026, 9, 7, 12, 0, 0)
  expect(daMostrare(cons("1", "in_attesa"), adesso)).toBe(true)
  expect(daMostrare(cons("1", "ok"), adesso)).toBe(false)
  expect(daMostrare(cons("1", "ignorato"), adesso)).toBe(false)
  expect(daMostrare(cons("1", "posticipato", { posticipato_fino_a: "2026-10-07 11:59:00.000Z" }), adesso)).toBe(true)
  expect(daMostrare(cons("1", "posticipato", { posticipato_fino_a: "2026-10-07 12:01:00.000Z" }), adesso)).toBe(false)
  expect(daMostrare(cons("1", "posticipato"), adesso)).toBe(false)
})

test("aggiornaLista: aggiunge senza duplicati, ordina, toglie le chiuse e tiene l'expand", () => {
  const adesso = Date.UTC(2026, 9, 7, 12, 0, 0)
  const a = cons("a", "in_attesa", { created: "2026-10-07 10:05:00.000Z" })
  const b = cons("b", "in_attesa", { created: "2026-10-07 10:01:00.000Z" })
  let l = aggiornaLista([], a, adesso)
  l = aggiornaLista(l, b, adesso)
  expect(l.map((x) => x.id)).toEqual(["b", "a"])

  l = aggiornaLista(l, a, adesso)
  expect(l).toHaveLength(2)

  const conExpand = { ...a, expand: { messaggio: { id: "ma", testo: "ciao" } as never } }
  l = aggiornaLista(l, conExpand, adesso)
  l = aggiornaLista(l, { ...a }, adesso) // aggiornamento senza expand: non lo perde
  expect(l.find((x) => x.id === "a")?.expand?.messaggio?.testo).toBe("ciao")

  l = aggiornaLista(l, { ...a, stato: "ok" }, adesso)
  expect(l.map((x) => x.id)).toEqual(["b"])
  expect(rimuovi(l, "b")).toEqual([])
})

test("formattaOra: oggi, ieri, altro giorno", () => {
  const adesso = new Date(2026, 9, 7, 15, 0, 0)
  const loc = (d: Date) => d.toISOString().replace("T", " ")
  expect(formattaOra(loc(new Date(2026, 9, 7, 9, 5)), adesso)).toBe("09:05")
  expect(formattaOra(loc(new Date(2026, 9, 6, 9, 5)), adesso)).toBe("ieri 09:05")
  expect(formattaOra(loc(new Date(2026, 9, 1, 9, 5)), adesso)).toBe("01/10 09:05")
  expect(formattaOra("", adesso)).toBe("")
})
