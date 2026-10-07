import { test, expect } from "vitest"
import { destinatariEffettivi } from "./rubrica"
import type { Utente } from "./tipi"

const u = (id: string, gruppi: string[] = []): Utente => ({ id, name: id, gruppi })
const rubrica = [u("anna", ["uff"]), u("bruno", ["uff"]), u("carla", ["mag"]), u("elisa", ["off", "mag"])]
const ids = (l: Utente[]) => l.map((x) => x.id)

test("destinatari effettivi come nel server", () => {
  expect(ids(destinatariEffettivi({ tutti: true, gruppi: [], utenti: [] }, rubrica, "anna"))).toEqual(["bruno", "carla", "elisa"])
  expect(ids(destinatariEffettivi({ tutti: false, gruppi: ["uff"], utenti: [] }, rubrica, "anna"))).toEqual(["bruno"])
  expect(ids(destinatariEffettivi({ tutti: false, gruppi: ["mag"], utenti: ["elisa", "bruno"] }, rubrica, "anna"))).toEqual(["bruno", "carla", "elisa"])
  expect(destinatariEffettivi({ tutti: false, gruppi: [], utenti: [] }, rubrica, "anna")).toEqual([])
})
