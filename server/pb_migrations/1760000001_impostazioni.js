/// <reference path="../pb_data/types.d.ts" />

// Impostazioni generali: nome dell'app e backup automatico notturno.
// I backup (file .zip) finiscono in pb_data/backups e se ne tengono gli ultimi 14.
migrate((app) => {
  const settings = app.settings()

  settings.meta.appName = "Gieffe-it"
  settings.backups.cron = "0 3 * * *"
  settings.backups.cronMaxKeep = 14

  app.save(settings)
}, (app) => {
  const settings = app.settings()

  settings.backups.cron = ""
  settings.backups.cronMaxKeep = 3

  app.save(settings)
})
