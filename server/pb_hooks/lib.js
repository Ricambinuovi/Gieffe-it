// Funzioni condivise dagli hook di Gieffe-it.
// Nel JSVM di PocketBase ogni handler gira in un contesto isolato: le funzioni
// comuni si caricano con require(`${__hooks}/lib.js`) dentro l'handler.

/**
 * Errore di validazione in italiano. Il testo viaggia anche in data.gieffe.message
 * (con code "errore_gieffe"): il client lo riconosce come proprio e lo mostra così com'è.
 */
function errore(messaggio) {
  return new BadRequestError(messaggio, { gieffe: new ValidationError("errore_gieffe", messaggio) })
}

/**
 * Destinatari effettivi di un messaggio: "tutti", oppure i membri dei gruppi
 * scelti più gli utenti scelti. Senza duplicati e escluso il mittente.
 * @returns {string[]} id degli utenti
 */
function destinatariEffettivi(app, messaggio) {
  const mittente = messaggio.getString("mittente")
  const ids = new Set()

  const utenti = app.findAllRecords("users")

  if (messaggio.getBool("a_tutti")) {
    utenti.forEach((u) => ids.add(u.id))
  } else {
    const gruppi = messaggio.getStringSlice("gruppi")
    if (gruppi.length) {
      utenti.forEach((u) => {
        const suoi = u.getStringSlice("gruppi")
        if (suoi.some((g) => gruppi.indexOf(g) >= 0)) ids.add(u.id)
      })
    }

    const singoli = messaggio.getStringSlice("utenti")
    if (singoli.length) {
      // si accettano solo id di utenti esistenti
      utenti.forEach((u) => {
        if (singoli.indexOf(u.id) >= 0) ids.add(u.id)
      })
    }
  }

  ids.delete(mittente)

  return Array.from(ids)
}

/** Controlli sul messaggio prima del salvataggio. Lancia BadRequestError se non valido. */
function validaNuovoMessaggio(app, messaggio) {
  const testo = (messaggio.getString("testo") || "").trim()
  if (!testo) {
    throw errore("Il messaggio è vuoto.")
  }
  messaggio.set("testo", testo)

  if (destinatariEffettivi(app, messaggio).length === 0) {
    throw errore("Nessun destinatario: scegli almeno una persona diversa da te.")
  }

  // Si può rispondere solo a messaggi che si sono inviati o ricevuti.
  const rispostaA = messaggio.getString("risposta_a")
  if (rispostaA) {
    const mittente = messaggio.getString("mittente")
    let originale
    try {
      originale = app.findRecordById("messaggi", rispostaA)
    } catch (_) {
      throw errore("Il messaggio a cui rispondi non esiste.")
    }

    let coinvolto = originale.getString("mittente") === mittente
    if (!coinvolto) {
      const consegne = app.findRecordsByFilter(
        "consegne",
        "messaggio = {:m} && destinatario = {:d}",
        "", 1, 0,
        { m: originale.id, d: mittente }
      )
      coinvolto = consegne.length > 0
    }
    if (!coinvolto) {
      throw errore("Non puoi rispondere a questo messaggio.")
    }
  }
}

/** Crea una consegna "in_attesa" per ogni destinatario effettivo. */
function creaConsegne(app, messaggio) {
  const collezione = app.findCollectionByNameOrId("consegne")

  destinatariEffettivi(app, messaggio).forEach((destinatario) => {
    const consegna = new Record(collezione)
    consegna.set("messaggio", messaggio.id)
    consegna.set("destinatario", destinatario)
    consegna.set("stato", "in_attesa")
    app.save(consegna)
  })
}

/**
 * Controlla il cambio di stato di una consegna da parte del destinatario.
 *  - ok e ignorato sono stati finali
 *  - dallo stato "in_attesa"/"posticipato" non si torna a "in_attesa"
 *  - i messaggi urgenti si chiudono solo con "ok" (niente ignora, niente posticipo)
 *  - "posticipato" richiede la data in cui ripresentare il messaggio
 * Imposta la data dell'azione lato server.
 */
function validaCambioStato(app, consegna) {
  const precedente = consegna.original().getString("stato")
  const nuovo = consegna.getString("stato")

  if (precedente === "ok" || precedente === "ignorato") {
    throw errore("Questo messaggio è già stato chiuso.")
  }

  if (nuovo === "in_attesa" && precedente !== "in_attesa") {
    throw errore("Stato non valido.")
  }

  if (nuovo === "posticipato" || nuovo === "ignorato") {
    const messaggio = app.findRecordById("messaggi", consegna.getString("messaggio"))
    if (messaggio.getString("urgenza") === "urgente") {
      throw errore("I messaggi urgenti si chiudono solo con OK.")
    }
  }

  if (nuovo === "posticipato") {
    if (consegna.getDateTime("posticipato_fino_a").isZero()) {
      throw errore("Indica quando ricordare il messaggio.")
    }
  } else {
    consegna.set("posticipato_fino_a", "")
  }

  if (nuovo !== "in_attesa") {
    consegna.set("azione_il", new DateTime())
  }
}

module.exports = {
  errore,
  destinatariEffettivi,
  validaNuovoMessaggio,
  creaConsegne,
  validaCambioStato,
}
