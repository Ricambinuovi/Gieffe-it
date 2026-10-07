import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { avviaServer, creaScenario } from "./helpers.mjs"

let srv, g, u
const client = {}

before(async () => {
  srv = await avviaServer()
  ;({ gruppi: g, utenti: u } = await creaScenario(srv.admin))
  for (const nome of Object.keys(u)) client[nome] = await srv.accedi(`${nome}@test.local`)
})

after(async () => {
  await srv?.ferma()
})

const consegneDi = (messaggio) =>
  srv.admin.collection("consegne").getFullList({ filter: `messaggio = "${messaggio.id}"` })

const destinatariDi = async (messaggio) =>
  (await consegneDi(messaggio)).map((c) => c.destinatario).sort()

const invia = (da, dati) =>
  client[da].collection("messaggi").create({
    mittente: u[da].id,
    urgenza: "normale",
    testo: "prova",
    ...dati,
  })

const ids = (...nomi) => nomi.map((n) => u[n].id).sort()

// ---------------------------------------------------------------- consegne

test("info: la rotta di servizio risponde senza login", async () => {
  const r = await (await fetch(`${srv.url}/api/gieffe/info`)).json()
  assert.equal(r.app, "gieffe-it")
  assert.ok(!Number.isNaN(Date.parse(r.ora)))
})

test("hook: 'tutti' genera una consegna per ogni utente tranne il mittente", async () => {
  const m = await invia("anna", { a_tutti: true })
  assert.deepEqual(await destinatariDi(m), ids("bruno", "carla", "dario", "elisa"))
  for (const c of await consegneDi(m)) assert.equal(c.stato, "in_attesa")
})

test("hook: un gruppo espande ai suoi membri, escluso il mittente", async () => {
  const m = await invia("anna", { gruppi: [g.Ufficio.id] })
  assert.deepEqual(await destinatariDi(m), ids("bruno"))
})

test("hook: gruppi e singoli utenti si sommano senza duplicati", async () => {
  // Elisa è sia in Officina sia in Magazzino ed è anche scelta come singola
  const m = await invia("anna", {
    gruppi: [g.Officina.id, g.Magazzino.id],
    utenti: [u.elisa.id, u.bruno.id],
  })
  assert.deepEqual(await destinatariDi(m), ids("bruno", "carla", "dario", "elisa"))
})

test("hook: il mittente nel proprio gruppo non riceve il proprio messaggio", async () => {
  const m = await invia("dario", { gruppi: [g.Officina.id] })
  assert.deepEqual(await destinatariDi(m), ids("elisa"))
})

test("hook: senza destinatari il messaggio viene rifiutato e non resta nulla", async () => {
  const prima = (await srv.admin.collection("messaggi").getFullList()).length
  await assert.rejects(invia("anna", {}), /destinatari|Nessun/i)
  await assert.rejects(invia("anna", { utenti: [u.anna.id] }), /destinatari|Nessun/i)
  const dopo = (await srv.admin.collection("messaggi").getFullList()).length
  assert.equal(dopo, prima)
})

test("hook: testo vuoto o di soli spazi rifiutato", async () => {
  await assert.rejects(invia("anna", { a_tutti: true, testo: "   " }))
})

test("regole: non si può scrivere a nome di un altro", async () => {
  await assert.rejects(
    client.anna.collection("messaggi").create({
      mittente: u.bruno.id, urgenza: "normale", testo: "finto", a_tutti: true,
    })
  )
})

test("regole: senza login non si legge né si scrive", async () => {
  // Le regole "filtro" non danno errore: restituiscono una lista vuota.
  // Il punto è che, pur esistendo messaggi e consegne, un anonimo non ne vede nessuno.
  await invia("anna", { a_tutti: true })
  for (const nome of ["messaggi", "consegne", "users", "gruppi", "modelli"]) {
    const r = await fetch(`${srv.url}/api/collections/${nome}/records`)
    const corpo = await r.json()
    assert.ok(r.status === 403 || corpo.totalItems === 0, `${nome} visibile senza login`)
  }
  const scrittura = await fetch(`${srv.url}/api/collections/messaggi/records`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mittente: u.anna.id, urgenza: "normale", testo: "x", a_tutti: true }),
  })
  assert.ok(scrittura.status === 400 || scrittura.status === 403)
})

// ---------------------------------------------------------------- visibilità

test("regole: ognuno vede solo le proprie consegne", async () => {
  const m = await invia("anna", { utenti: [u.bruno.id, u.carla.id] })

  const diBruno = await client.bruno.collection("consegne").getFullList()
  assert.ok(diBruno.every((c) => c.destinatario === u.bruno.id))
  assert.ok(diBruno.some((c) => c.messaggio === m.id))

  // Dario non è destinatario: non vede né la consegna né il messaggio
  const diDario = await client.dario.collection("consegne").getFullList()
  assert.ok(!diDario.some((c) => c.messaggio === m.id))
  await assert.rejects(client.dario.collection("messaggi").getOne(m.id))
})

test("regole: il mittente vede lo stato di tutti i destinatari", async () => {
  const m = await invia("anna", { utenti: [u.bruno.id, u.carla.id, u.dario.id] })
  const viste = await client.anna
    .collection("consegne")
    .getFullList({ filter: `messaggio = "${m.id}"`, expand: "destinatario" })
  assert.equal(viste.length, 3)
  assert.deepEqual(viste.map((c) => c.expand.destinatario.name).sort(), ["Bruno", "Carla", "Dario"])
})

test("regole: il destinatario legge messaggio e mittente con expand", async () => {
  const m = await invia("anna", { utenti: [u.bruno.id], testo: "Cliente al banco" })
  const c = (await client.bruno.collection("consegne").getFullList({
    filter: `messaggio = "${m.id}"`, expand: "messaggio.mittente",
  }))[0]
  assert.equal(c.expand.messaggio.testo, "Cliente al banco")
  assert.equal(c.expand.messaggio.expand.mittente.name, "Anna")
})

test("regole: la rubrica è visibile ma senza email, e non modificabile", async () => {
  const rubrica = await client.bruno.collection("users").getFullList()
  assert.equal(rubrica.length, 5)
  // l'email è visibile solo a chi la possiede
  assert.ok(rubrica.filter((x) => x.id !== u.bruno.id).every((x) => !x.email))
  await assert.rejects(client.bruno.collection("users").update(u.anna.id, { name: "Hacker" }))
  await assert.rejects(client.bruno.collection("gruppi").create({ nome: "Nuovo" }))
  await assert.rejects(client.bruno.collection("modelli").create({ testo: "x" }))
})

test("regole: i messaggi inviati non si modificano né si cancellano", async () => {
  const m = await invia("anna", { utenti: [u.bruno.id] })
  await assert.rejects(client.anna.collection("messaggi").update(m.id, { testo: "cambiato" }))
  await assert.rejects(client.anna.collection("messaggi").delete(m.id))
})

// ---------------------------------------------------------------- stati

async function consegnaDi(da, a, dati = {}) {
  const m = await invia(da, { utenti: [u[a].id], ...dati })
  const [c] = await client[a].collection("consegne").getFullList({ filter: `messaggio = "${m.id}"` })
  return c
}

test("stato: OK imposta la data dell'azione lato server", async () => {
  const c = await consegnaDi("anna", "bruno")
  assert.equal(c.azione_il, "")
  const dopo = await client.bruno.collection("consegne").update(c.id, { stato: "ok" })
  assert.equal(dopo.stato, "ok")
  assert.ok(dopo.azione_il)
})

test("stato: il mittente vede il cambio di stato", async () => {
  const c = await consegnaDi("anna", "bruno")
  await client.bruno.collection("consegne").update(c.id, { stato: "ignorato" })
  const vista = await client.anna.collection("consegne").getOne(c.id)
  assert.equal(vista.stato, "ignorato")
})

test("stato: ignorato e ok sono definitivi", async () => {
  const c = await consegnaDi("anna", "bruno")
  await client.bruno.collection("consegne").update(c.id, { stato: "ignorato" })
  await assert.rejects(client.bruno.collection("consegne").update(c.id, { stato: "ok" }))
})

test("stato: posticipato richiede la data e la conserva", async () => {
  const c = await consegnaDi("anna", "bruno")
  await assert.rejects(client.bruno.collection("consegne").update(c.id, { stato: "posticipato" }))

  const quando = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const dopo = await client.bruno.collection("consegne").update(c.id, {
    stato: "posticipato", posticipato_fino_a: quando,
  })
  assert.equal(dopo.stato, "posticipato")
  assert.equal(new Date(dopo.posticipato_fino_a).getTime(), new Date(quando).getTime())

  // si può posticipare di nuovo e poi chiudere; chiudendo la data sparisce
  const chiuso = await client.bruno.collection("consegne").update(c.id, { stato: "ok" })
  assert.equal(chiuso.posticipato_fino_a, "")
})

test("stato: non si torna a in_attesa", async () => {
  const c = await consegnaDi("anna", "bruno")
  const quando = new Date(Date.now() + 60_000).toISOString()
  await client.bruno.collection("consegne").update(c.id, { stato: "posticipato", posticipato_fino_a: quando })
  await assert.rejects(client.bruno.collection("consegne").update(c.id, { stato: "in_attesa" }))
})

test("urgenti: si chiudono solo con OK (niente ignora, niente posticipo)", async () => {
  const c = await consegnaDi("anna", "bruno", { urgenza: "urgente" })
  const quando = new Date(Date.now() + 60_000).toISOString()
  await assert.rejects(client.bruno.collection("consegne").update(c.id, { stato: "ignorato" }))
  await assert.rejects(
    client.bruno.collection("consegne").update(c.id, { stato: "posticipato", posticipato_fino_a: quando })
  )
  const ok = await client.bruno.collection("consegne").update(c.id, { stato: "ok" })
  assert.equal(ok.stato, "ok")
})

test("stato: solo il destinatario può cambiare la consegna, e solo lo stato", async () => {
  const c = await consegnaDi("anna", "bruno")
  // il mittente non può forzare lo stato del destinatario
  await assert.rejects(client.anna.collection("consegne").update(c.id, { stato: "ok" }))
  // un terzo non la vede nemmeno
  await assert.rejects(client.carla.collection("consegne").update(c.id, { stato: "ok" }))
  // il destinatario non può cambiare destinatario/messaggio/data azione
  await assert.rejects(client.bruno.collection("consegne").update(c.id, { destinatario: u.carla.id }))
  await assert.rejects(client.bruno.collection("consegne").update(c.id, { azione_il: "2020-01-01 00:00:00.000Z" }))
  // e nessuno crea o cancella consegne a mano
  await assert.rejects(client.bruno.collection("consegne").create({
    messaggio: c.messaggio, destinatario: u.bruno.id, stato: "in_attesa",
  }))
  await assert.rejects(client.bruno.collection("consegne").delete(c.id))
})

// ---------------------------------------------------------------- risposte

test("risposta: arriva al mittente come nuovo messaggio collegato all'originale", async () => {
  const originale = await invia("anna", { utenti: [u.bruno.id], testo: "Cliente al banco" })
  const risposta = await invia("bruno", {
    utenti: [u.anna.id], risposta_a: originale.id, testo: "Arrivo subito",
  })
  assert.equal(risposta.risposta_a, originale.id)

  const [c] = await client.anna.collection("consegne").getFullList({
    filter: `messaggio = "${risposta.id}"`, expand: "messaggio.risposta_a",
  })
  assert.equal(c.expand.messaggio.expand.risposta_a.testo, "Cliente al banco")
})

test("risposta: non si può rispondere a un messaggio che non si conosce", async () => {
  const privato = await invia("anna", { utenti: [u.bruno.id] })
  await assert.rejects(invia("dario", { utenti: [u.anna.id], risposta_a: privato.id }))
  await assert.rejects(invia("dario", { utenti: [u.anna.id], risposta_a: "idinesistente1" }))
})

// ---------------------------------------------------------------- realtime e sessione

test("realtime: il destinatario riceve la nuova consegna, il mittente l'aggiornamento", async () => {
  const arrivate = []
  const aggiornate = []
  await client.dario.collection("consegne").subscribe("*", (e) => arrivate.push(e))
  await client.anna.collection("consegne").subscribe("*", (e) => aggiornate.push(e))

  const m = await invia("anna", { utenti: [u.dario.id] })
  const attendi = async (cond) => {
    for (let i = 0; i < 50 && !cond(); i++) await new Promise((r) => setTimeout(r, 100))
  }
  await attendi(() => arrivate.length > 0)
  const nuova = arrivate.find((e) => e.action === "create" && e.record.messaggio === m.id)
  assert.ok(nuova, "il destinatario deve ricevere la consegna in tempo reale")

  await client.dario.collection("consegne").update(nuova.record.id, { stato: "ok" })
  await attendi(() => aggiornate.some((e) => e.action === "update"))
  const upd = aggiornate.find((e) => e.action === "update" && e.record.id === nuova.record.id)
  assert.equal(upd?.record.stato, "ok")

  await client.dario.collection("consegne").unsubscribe()
  await client.anna.collection("consegne").unsubscribe()
})

test("sessione: il token dura circa un anno e si può rinnovare", async () => {
  const exp = JSON.parse(Buffer.from(client.anna.authStore.token.split(".")[1], "base64url")).exp
  const giorni = (exp * 1000 - Date.now()) / 86_400_000
  assert.ok(giorni > 360 && giorni <= 366, `durata token: ${giorni} giorni`)
  const r = await client.anna.collection("users").authRefresh()
  assert.equal(r.record.id, u.anna.id)
})
