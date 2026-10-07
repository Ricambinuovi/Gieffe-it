/// <reference path="../pb_data/types.d.ts" />

// Messaggi (post-it). Le regole di lettura dipendono dalla collezione "consegne",
// che non esiste ancora: vengono impostate in 1760000006_regole_messaggi.js.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const gruppi = app.findCollectionByNameOrId("gruppi")

  const messaggi = new Collection({
    type: "base",
    name: "messaggi",
    fields: [
      {
        type: "relation", name: "mittente", required: true,
        collectionId: users.id, maxSelect: 1, cascadeDelete: false,
      },
      { type: "text", name: "testo", required: true, min: 1, max: 1000 },
      {
        type: "select", name: "urgenza", required: true, maxSelect: 1,
        values: ["normale", "urgente"],
      },
      // destinatari scelti: tutti, oppure gruppi e/o singoli utenti
      { type: "bool", name: "a_tutti" },
      {
        type: "relation", name: "gruppi",
        collectionId: gruppi.id, maxSelect: 50, cascadeDelete: false,
      },
      {
        type: "relation", name: "utenti",
        collectionId: users.id, maxSelect: 200, cascadeDelete: false,
      },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE INDEX idx_messaggi_mittente ON messaggi (mittente, created)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })

  app.save(messaggi)

  // risposta_a: relazione verso la stessa collezione, possibile solo dopo il primo salvataggio
  messaggi.fields.add(new RelationField({
    name: "risposta_a",
    collectionId: messaggi.id,
    maxSelect: 1,
    cascadeDelete: false,
  }))

  app.save(messaggi)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("messaggi"))
})
