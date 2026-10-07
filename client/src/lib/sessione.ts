import { load, type Store } from "@tauri-apps/plugin-store"
import PocketBase from "pocketbase"
import type { Sessione, Utente } from "./tipi"

let store: Store | null = null

async function apri(): Promise<Store> {
  store ??= await load("sessione.json", { defaults: {}, autoSave: true })
  return store
}

export async function leggiSessione(): Promise<Sessione | null> {
  const s = await apri()
  const server = await s.get<string>("server")
  const token = await s.get<string>("token")
  const utente = await s.get<Utente>("utente")
  if (!server || !token || !utente) return null
  return { server, token, utente }
}

/** Indirizzo usato l'ultima volta, anche dopo l'uscita dall'account. */
export async function ultimoServer(): Promise<string> {
  return (await (await apri()).get<string>("server")) ?? ""
}

export async function salvaSessione(sessione: Sessione): Promise<void> {
  const s = await apri()
  await s.set("server", sessione.server)
  await s.set("token", sessione.token)
  await s.set("utente", sessione.utente)
  await s.save()
}

/** Esce dall'account: si dimentica il token ma si ricorda l'indirizzo del server. */
export async function cancellaSessione(): Promise<void> {
  const s = await apri()
  await s.delete("token")
  await s.delete("utente")
  await s.save()
}

/** Messaggio da mostrare nella finestra di accesso (es. sessione scaduta), una sola volta. */
export async function impostaNotaAccesso(nota: string): Promise<void> {
  const s = await apri()
  await s.set("nota_accesso", nota)
  await s.save()
}

export async function leggiNotaAccesso(): Promise<string> {
  const s = await apri()
  const nota = (await s.get<string>("nota_accesso")) ?? ""
  if (nota) {
    await s.delete("nota_accesso")
    await s.save()
  }
  return nota
}

export async function haImpostatoAvvioAutomatico(): Promise<boolean> {
  return !!(await (await apri()).get<boolean>("avvio_automatico_impostato"))
}

export async function segnaAvvioAutomaticoImpostato(): Promise<void> {
  const s = await apri()
  await s.set("avvio_automatico_impostato", true)
  await s.save()
}

/** Client PocketBase già autenticato con i dati salvati. */
export function clientDaSessione(sessione: Sessione): PocketBase {
  const pb = new PocketBase(sessione.server)
  pb.autoCancellation(false)
  pb.authStore.save(sessione.token, sessione.utente as never)
  return pb
}
