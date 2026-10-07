/// <reference path="../pb_data/types.d.ts" />

// Estende la collezione "users" (auth):
//  - name        = nome visualizzato (campo già presente in PocketBase)
//  - postazione  = es. "Banco 1", "Magazzino"
//  - gruppi      = gruppi di appartenenza
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const gruppi = app.findCollectionByNameOrId("gruppi")

  users.fields.add(new TextField({ name: "postazione", max: 60 }))
  users.fields.add(new RelationField({
    name: "gruppi",
    collectionId: gruppi.id,
    maxSelect: 50,
    cascadeDelete: false,
  }))

  // Il nome visualizzato è obbligatorio.
  const name = users.fields.getByName("name")
  name.required = true

  // Rubrica: ogni utente collegato vede gli altri (l'email resta nascosta).
  // Gli utenti si creano e modificano solo dal pannello admin.
  users.listRule = '@request.auth.id != ""'
  users.viewRule = '@request.auth.id != ""'
  users.createRule = null
  users.updateRule = null
  users.deleteRule = null

  // Sessione lunga (365 giorni): il client rinnova il token a ogni avvio,
  // quindi i colleghi non devono rifare il login.
  users.authToken.duration = 31536000

  // Niente registrazione, OTP, accesso OAuth2: solo email + password.
  users.passwordAuth.enabled = true
  users.oauth2.enabled = false
  users.otp.enabled = false
  users.mfa.enabled = false

  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId("users")

  users.fields.removeByName("postazione")
  users.fields.removeByName("gruppi")
  users.authToken.duration = 604800

  app.save(users)
})
