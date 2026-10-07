/**
 * Connessione al server: gira solo nella finestra "postit", che resta sempre in
 * vita (anche nascosta). Tiene la sottoscrizione realtime, si riconnette da sola
 * e a ogni (ri)connessione recupera i messaggi rimasti in sospeso.
 */
import type PocketBase from "pocketbase"
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event"
import { aggiornaLista, rimuovi } from "./consegne"
import { erroreDiRete, messaggioErrore, sessioneNonValida } from "./errori"
import {
  cancellaSessione, clientDaSessione, impostaNotaAccesso, leggiSessione, salvaSessione,
} from "./sessione"
import { apriFinestra, EVENTO_CHIEDI_STATO, EVENTO_SESSIONE, EVENTO_STATO } from "./tauri"
import type { Consegna, Sessione } from "./tipi"

export type Fase = "avvio" | "senza_sessione" | "connesso" | "offline"

const ESPANDI = "messaggio,messaggio.mittente"
const CONTROLLO_MS = 5_000
const RECUPERO_MS = 30_000
const SALTO_SOSPENSIONE_MS = 20_000
const TICK_SSE_SPENTO = 3

export const stato = $state({
  fase: "avvio" as Fase,
  inSospeso: [] as Consegna[],
  nome: "",
  server: "",
})

/** Chiamata quando arriva una consegna nuova (non al recupero iniziale). */
let allArrivo: ((c: Consegna) => void) | null = null
export function quandoArrivaMessaggio(f: (c: Consegna) => void) {
  allArrivo = f
}

let pb: PocketBase | null = null
let sessione: Sessione | null = null
let timer: ReturnType<typeof setInterval> | null = null
let ultimoTick = Date.now()
let ultimoRecupero = 0
let tickSenzaSse = 0
let occupato = false
let autenticato = false // il token è già stato rinnovato in questa sessione di connessione
let generazione = 0 // cambia a ogni riavvio: scarta i risultati delle chiamate vecchie
const sciogli: UnlistenFn[] = []

function imposta(fase: Fase) {
  if (stato.fase !== fase) {
    stato.fase = fase
    void pubblicaStato()
  }
}

async function pubblicaStato() {
  await emit(EVENTO_STATO, { fase: stato.fase, inSospeso: stato.inSospeso.length })
}

function filtroInSospeso(p: PocketBase, utenteId: string) {
  return p.filter(
    'destinatario = {:d} && (stato = "in_attesa" || (stato = "posticipato" && posticipato_fino_a <= {:ora}))',
    { d: utenteId, ora: new Date() },
  )
}

/** Rilegge dal server tutto ciò che è in sospeso. */
async function recupera(): Promise<void> {
  if (!pb || !sessione) return
  const mia = generazione
  const p = pb
  try {
    const lista = await p.collection("consegne").getFullList<Consegna>({
      filter: filtroInSospeso(p, sessione.utente.id),
      expand: ESPANDI,
      sort: "created",
    })
    if (mia !== generazione) return
    stato.inSospeso = lista
    ultimoRecupero = Date.now()
    imposta("connesso")
  } catch (e) {
    if (mia !== generazione) return
    gestisciErrore(e)
  }
}

function gestisciErrore(e: unknown) {
  if (sessioneNonValida(e)) {
    void sessioneScaduta()
  } else if (erroreDiRete(e)) {
    imposta("offline")
  } else {
    console.error("Errore nel recupero dei messaggi:", messaggioErrore(e), e)
  }
}

async function sessioneScaduta() {
  await ferma()
  await cancellaSessione()
  await impostaNotaAccesso("La sessione è scaduta: accedi di nuovo.")
  imposta("senza_sessione")
  await apriFinestra("login")
}

async function conEspansione(c: Consegna): Promise<Consegna> {
  if (c.expand?.messaggio?.expand?.mittente || !pb) return c
  try {
    return await pb.collection("consegne").getOne<Consegna>(c.id, { expand: ESPANDI })
  } catch {
    return c
  }
}

async function sulloEvento(azione: string, record: Consegna) {
  if (!sessione || record.destinatario !== sessione.utente.id) return
  const mia = generazione

  if (azione === "delete") {
    stato.inSospeso = rimuovi(stato.inSospeso, record.id)
    return
  }

  const nuovo = !stato.inSospeso.some((x) => x.id === record.id)
  const pronto = record.stato === "in_attesa" ? await conEspansione(record) : record
  if (mia !== generazione) return

  stato.inSospeso = aggiornaLista(stato.inSospeso, pronto, Date.now())
  if (nuovo && azione === "create" && stato.inSospeso.some((x) => x.id === record.id)) {
    allArrivo?.(pronto)
  }
}

async function sottoscrivi(): Promise<void> {
  if (!pb || !sessione) return
  const p = pb
  const mia = generazione

  // Ogni volta che il flusso realtime si (ri)connette si recuperano i messaggi in sospeso.
  await p.realtime.subscribe("PB_CONNECT", () => {
    if (mia !== generazione) return
    tickSenzaSse = 0
    void recupera()
  })
  p.realtime.onDisconnect = (attive) => {
    if (mia !== generazione) return
    if (attive.length > 0) imposta("offline")
  }

  await p.collection("consegne").subscribe<Consegna>(
    "*",
    (e) => void sulloEvento(e.action, e.record),
    { filter: p.filter("destinatario = {:d}", { d: sessione.utente.id }), expand: ESPANDI },
  )
}

/** Chiude e riapre il flusso realtime e rilegge i messaggi. */
async function riconnetti(): Promise<void> {
  if (occupato || !pb || !sessione) return
  occupato = true
  const mia = generazione
  try {
    // Rinnova il token a ogni avvio: la sessione si allunga finché l'app si usa.
    // Con un token scaduto PocketBase non dà errore sulle liste (le restituisce vuote),
    // quindi la verifica va fatta qui.
    if (!autenticato) {
      await pb.collection("users").authRefresh()
      if (mia !== generazione) return
      autenticato = true
    }
    await pb.realtime.unsubscribe().catch(() => {})
    if (mia !== generazione) return
    await sottoscrivi()
    await recupera()
  } catch (e) {
    if (mia === generazione) gestisciErrore(e)
  } finally {
    occupato = false
  }
}

async function controllo() {
  const adesso = Date.now()
  const salto = adesso - ultimoTick
  ultimoTick = adesso
  if (!pb || !sessione || occupato) return

  // Il PC era in sospensione: il flusso può essere rimasto aperto a metà.
  if (salto > SALTO_SOSPENSIONE_MS) {
    await riconnetti()
    return
  }

  if (stato.fase === "offline") {
    try {
      const r = await fetch(`${sessione.server}/api/gieffe/info`, { signal: AbortSignal.timeout(4000) })
      if (r.ok) await riconnetti()
    } catch {
      /* ancora irraggiungibile: riprova al prossimo giro */
    }
    return
  }

  // Flusso realtime spento ma server raggiungibile: lo si riapre.
  if (!pb.realtime.isConnected) {
    tickSenzaSse += 1
    if (tickSenzaSse >= TICK_SSE_SPENTO) {
      tickSenzaSse = 0
      await riconnetti()
      return
    }
  } else {
    tickSenzaSse = 0
  }

  // Rete di sicurezza: anche senza eventi si rilegge ogni tanto.
  if (adesso - ultimoRecupero > RECUPERO_MS) await recupera()
}

/** Avvia (o riavvia) la connessione con la sessione salvata. */
export async function avvia(): Promise<void> {
  await ferma()
  const mia = ++generazione

  sessione = await leggiSessione()
  if (!sessione) {
    stato.nome = ""
    stato.server = ""
    imposta("senza_sessione")
    await apriFinestra("login")
    return
  }

  stato.nome = sessione.utente.name
  stato.server = sessione.server
  pb = clientDaSessione(sessione)
  pb.authStore.onChange((token, record) => {
    if (sessione && token && record) {
      sessione = { ...sessione, token, utente: { ...sessione.utente, ...(record as object) } }
      void salvaSessione(sessione)
    }
  })

  imposta("offline") // finché non risponde il server
  ultimoTick = Date.now()
  timer = setInterval(() => void controllo(), CONTROLLO_MS)
  await riconnetti() // se il server non risponde, il controllo periodico riprova
}

export async function ferma(): Promise<void> {
  generazione += 1
  if (timer) clearInterval(timer)
  timer = null
  const p = pb
  pb = null
  sessione = null
  occupato = false
  autenticato = false
  stato.inSospeso = []
  if (p) {
    p.realtime.onDisconnect = undefined
    await p.realtime.unsubscribe().catch(() => {})
  }
}

/** Da chiamare una volta nella finestra del post-it. */
export async function inizia(): Promise<void> {
  sciogli.push(
    await listen(EVENTO_SESSIONE, () => void avvia()),
    await listen(EVENTO_CHIEDI_STATO, () => void pubblicaStato()),
  )
  await avvia()
}

/** Azioni dell'utente sul messaggio. */
export async function rispondiStato(c: Consegna, nuovo: "ok" | "ignorato"): Promise<void> {
  if (!pb) throw new Error("non connesso")
  await pb.collection("consegne").update(c.id, { stato: nuovo })
  stato.inSospeso = rimuovi(stato.inSospeso, c.id)
}
