/// <reference path="../pb_data/types.d.ts" />

// Consegne: una per ogni destinatario di ogni messaggio. Le crea l'hook
// pb_hooks/gieffe.pb.js, i client possono solo leggerle e cambiarne lo stato.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const messaggi = app.findCollectionByNameOrId("messaggi")

  const consegne = new Collection({
    type: "base",
    name: "consegne",
    fields: [
      {
        type: "relation", name: "messaggio", required: true,
        collectionId: messaggi.id, maxSelect: 1, cascadeDelete: true,
      },
      {
        type: "relation", name: "destinatario", required: true,
        collectionId: users.id, maxSelect: 1, cascadeDelete: true,
      },
      {
        type: "select", name: "stato", required: true, maxSelect: 1,
        values: ["in_attesa", "ok", "ignorato", "posticipato"],
      },
      { type: "date", name: "posticipato_fino_a" },
      { type: "date", name: "azione_il" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_consegne_unica ON consegne (messaggio, destinatario)",
      "CREATE INDEX idx_consegne_destinatario ON consegne (destinatario, stato)",
    ],
    // Il destinatario vede le proprie consegne; il mittente vede quelle dei suoi messaggi.
    listRule: 'destinatario = @request.auth.id || messaggio.mittente = @request.auth.id',
    viewRule: 'destinatario = @request.auth.id || messaggio.mittente = @request.auth.id',
    createRule: null,
    // Solo il destinatario, e solo i campi di stato. Le transizioni valide
    // (urgenti, stati finali...) sono controllate in pb_hooks/gieffe.pb.js.
    updateRule: 'destinatario = @request.auth.id'
      + ' && @request.body.messaggio:isset = false'
      + ' && @request.body.destinatario:isset = false'
      + ' && @request.body.created:isset = false'
      + ' && @request.body.azione_il:isset = false',
    deleteRule: null,
  })

  app.save(consegne)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("consegne"))
})
