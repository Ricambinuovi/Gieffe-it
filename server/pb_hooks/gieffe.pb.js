/// <reference path="../pb_data/types.d.ts" />

// Hook server di Gieffe-it.

// Controlli sul nuovo messaggio (destinatari, risposta).
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  lib.validaNuovoMessaggio(e.app, e.record)
  e.next()
}, "messaggi")

// Alla creazione di un messaggio genera una consegna per ogni destinatario effettivo.
// Avviene nella stessa transazione del messaggio: se qualcosa fallisce non resta nulla.
onRecordCreate((e) => {
  const lib = require(`${__hooks}/lib.js`)
  e.next()
  lib.creaConsegne(e.app, e.record)
}, "messaggi")

// Regole sul cambio di stato di una consegna.
onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  lib.validaCambioStato(e.app, e.record)
  e.next()
}, "consegne")

// Rotta di servizio: permette al client di verificare che l'indirizzo sia quello di
// un server Gieffe-it e di conoscere l'ora del server.
routerAdd("GET", "/api/gieffe/info", (e) => {
  return e.json(200, {
    app: "gieffe-it",
    ora: new Date().toISOString(),
  })
})
