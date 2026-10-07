import { test, expect } from "vitest"
import { ClientResponseError } from "pocketbase"
import { erroreDiRete, messaggioErrore, sessioneNonValida } from "./errori"

const err = (status: number, response: object = {}) =>
  new ClientResponseError({ status, response, url: "http://x" })

test("errori di rete", () => {
  expect(messaggioErrore(err(0))).toMatch(/Impossibile raggiungere il server/)
  expect(messaggioErrore(new TypeError("Failed to fetch"))).toMatch(/Impossibile raggiungere il server/)
  expect(erroreDiRete(err(0))).toBe(true)
  expect(erroreDiRete(err(500))).toBe(false)
})

test("accesso con credenziali sbagliate", () => {
  expect(messaggioErrore(err(400, { message: "Failed to authenticate." }), "accesso")).toBe("Email o password non corretti.")
})

test("errori degli hook server passano in italiano", () => {
  const e = err(400, { message: "x", data: { gieffe: { message: "Nessun destinatario: scegli almeno una persona diversa da te." } } })
  expect(messaggioErrore(e)).toBe("Nessun destinatario: scegli almeno una persona diversa da te.")
})

test("nessun testo inglese di PocketBase arriva all'utente", () => {
  for (const s of [400, 401, 403, 404, 429, 500, 503, 418]) {
    expect(messaggioErrore(err(s, { message: "Something went wrong." }))).not.toMatch(/Something|wrong|Failed/i)
  }
  expect(messaggioErrore(new Error("boom"))).toBe("Si è verificato un errore imprevisto.")
})

test("sessioneNonValida", () => {
  expect(sessioneNonValida(err(401))).toBe(true)
  expect(sessioneNonValida(err(400))).toBe(false) // una richiesta sbagliata non deve far uscire l'utente
  expect(sessioneNonValida(err(0))).toBe(false)
  expect(sessioneNonValida(err(500))).toBe(false)
})
