/// <reference path="../pb_data/types.d.ts" />

// Modelli: testi predefiniti riutilizzabili (es. "Cliente al banco").
// Li gestisce l'amministratore dal pannello admin.
migrate((app) => {
  const modelli = new Collection({
    type: "base",
    name: "modelli",
    fields: [
      { type: "text", name: "testo", required: true, min: 1, max: 1000 },
      { type: "bool", name: "urgente" },
      { type: "number", name: "ordine", onlyInt: true },
    ],
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })

  app.save(modelli)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("modelli"))
})
