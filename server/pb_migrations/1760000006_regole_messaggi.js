/// <reference path="../pb_data/types.d.ts" />

// Regole dei messaggi, ora che esiste la collezione "consegne":
// si vede un messaggio se lo si è inviato o se si è tra i destinatari.
migrate((app) => {
  const messaggi = app.findCollectionByNameOrId("messaggi")

  const visibile = 'mittente = @request.auth.id || consegne_via_messaggio.destinatario ?= @request.auth.id'

  messaggi.listRule = visibile
  messaggi.viewRule = visibile
  // Si può scrivere solo a proprio nome. Destinatari e risposta_a sono verificati nell'hook.
  messaggi.createRule = '@request.auth.id != "" && @request.body.mittente = @request.auth.id'
  // I messaggi inviati non si modificano né si cancellano dai client.
  messaggi.updateRule = null
  messaggi.deleteRule = null

  app.save(messaggi)
}, (app) => {
  const messaggi = app.findCollectionByNameOrId("messaggi")

  messaggi.listRule = null
  messaggi.viewRule = null
  messaggi.createRule = null

  app.save(messaggi)
})
