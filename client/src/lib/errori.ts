import { ClientResponseError } from "pocketbase"

/**
 * Trasforma un errore (di rete o di PocketBase) in una frase in italiano.
 * Gli errori generati dai nostri hook server arrivano già in italiano
 * dentro response.data.gieffe.message e si mostrano così come sono.
 */
export function messaggioErrore(e: unknown, durante: "accesso" | "altro" = "altro"): string {
  if (e instanceof ClientResponseError) {
    if (e.isAbort) return "Operazione annullata."

    if (e.status === 0) {
      return "Impossibile raggiungere il server. Controlla l'indirizzo e che il PC sia collegato alla rete."
    }

    const nostro = (e.response?.data as { gieffe?: { message?: string } } | undefined)?.gieffe?.message
    if (nostro) return nostro

    if (durante === "accesso" && (e.status === 400 || e.status === 401)) {
      return "Email o password non corretti."
    }
    switch (true) {
      case e.status === 400:
        return "I dati inseriti non sono validi."
      case e.status === 401:
        return "Accesso scaduto o non valido. Esci dall'account e accedi di nuovo."
      case e.status === 403:
        return "Non hai il permesso di eseguire questa operazione."
      case e.status === 404:
        return "Elemento non trovato: potrebbe essere stato rimosso."
      case e.status === 429:
        return "Troppe richieste ravvicinate. Riprova tra qualche secondo."
      case e.status >= 500:
        return "Il server ha avuto un problema. Riprova tra poco."
    }
    return "Operazione non riuscita. Riprova."
  }

  if (e instanceof TypeError) {
    return "Impossibile raggiungere il server. Controlla l'indirizzo e che il PC sia collegato alla rete."
  }
  return "Si è verificato un errore imprevisto."
}

/** True se l'errore indica che il server non si raggiunge (rete assente o server spento). */
export function erroreDiRete(e: unknown): boolean {
  if (e instanceof ClientResponseError) return e.status === 0 && !e.isAbort
  return e instanceof TypeError
}

/** True se il token non è più valido e serve rifare il login. */
export function sessioneNonValida(e: unknown): boolean {
  return e instanceof ClientResponseError && (e.status === 401 || e.status === 403)
}
