/// <reference path="../pb_data/types.d.ts" />

// Gruppi di colleghi (Ufficio, Magazzino, Officina...). Li gestisce l'amministratore.
migrate((app) => {
  const gruppi = new Collection({
    type: "base",
    name: "gruppi",
    fields: [
      { type: "text", name: "nome", required: true, min: 1, max: 60 },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_gruppi_nome ON gruppi (nome COLLATE NOCASE)",
    ],
    // lettura per ogni utente collegato; scrittura solo dal pannello admin
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })

  app.save(gruppi)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("gruppi"))
})
