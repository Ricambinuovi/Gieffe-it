import { invoke } from "@tauri-apps/api/core"

export type NomeFinestra = "login" | "nuovo" | "inviati" | "storico" | "impostazioni"

export const apriFinestra = (nome: NomeFinestra) => invoke<void>("apri_finestra", { nome })
export const istanzaDiProva = () => invoke<boolean>("istanza_di_prova")

/** L'avvio automatico si gestisce solo nell'app installata, non in sviluppo né nelle istanze di prova. */
export async function avvioAutomaticoDisponibile(): Promise<boolean> {
  return import.meta.env.PROD && !(await istanzaDiProva())
}
export const esci = () => invoke<void>("esci")
export const mostraPostit = (altezza: number) => invoke<void>("postit_mostra", { altezza })
export const nascondiPostit = () => invoke<void>("postit_nascondi")
export const impostaTray = (inSospeso: number, connesso: boolean) =>
  invoke<void>("imposta_tray", { inSospeso, connesso })

// Eventi tra finestre
export const EVENTO_SESSIONE = "sessione-cambiata"
export const EVENTO_CHIEDI_STATO = "chiedi-stato"
export const EVENTO_STATO = "stato-connessione"
