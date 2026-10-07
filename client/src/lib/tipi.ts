export type Urgenza = "normale" | "urgente"
export type StatoConsegna = "in_attesa" | "ok" | "ignorato" | "posticipato"

export interface Utente {
  id: string
  name: string
  postazione?: string
  gruppi: string[]
  email?: string
}

export interface Gruppo {
  id: string
  nome: string
}

export interface Messaggio {
  id: string
  mittente: string
  testo: string
  urgenza: Urgenza
  a_tutti: boolean
  gruppi: string[]
  utenti: string[]
  risposta_a?: string
  created: string
  expand?: { mittente?: Utente }
}

export interface Consegna {
  id: string
  messaggio: string
  destinatario: string
  stato: StatoConsegna
  posticipato_fino_a: string
  azione_il: string
  created: string
  expand?: { messaggio?: Messaggio }
}

/** Dati salvati sul PC per ricordare l'accesso. */
export interface Sessione {
  server: string
  token: string
  utente: Utente
}
