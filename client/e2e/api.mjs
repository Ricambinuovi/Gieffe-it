// Piccolo aiuto per la prova end-to-end: parla col server come amministratore o come utente.
//   node api.mjs invia <da> <a> "<testo>" [urgenza]    (da/a: nomi, es. paolo Maria)
//   node api.mjs stati <Nome>                          (stato delle consegne di quella persona)
import PocketBase from "pocketbase"

const URL_SERVER = process.env.PB_URL ?? "http://127.0.0.1:18095"
const [, , comando, ...a] = process.argv

const pb = new PocketBase(URL_SERVER)
pb.autoCancellation(false)

if (comando === "invia") {
  const [da, verso, testo, urgenza = "normale"] = a
  const me = (await pb.collection("users").authWithPassword(`${da.toLowerCase()}@gieffecar.test`, "gieffe-prova-123")).record
  const dest = await pb.collection("users").getFirstListItem(pb.filter("name = {:n}", { n: verso }))
  const m = await pb.collection("messaggi").create({ mittente: me.id, testo, urgenza, utenti: [dest.id] })
  console.log(m.id)
} else if (comando === "stati") {
  await pb.collection("_superusers").authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD)
  const lista = await pb.collection("consegne").getFullList({
    filter: pb.filter("destinatario.name = {:n}", { n: a[0] }), expand: "messaggio", sort: "created",
  })
  for (const c of lista) console.log(`${c.stato}\t${c.expand.messaggio.testo}`)
} else {
  console.error("comando sconosciuto")
  process.exit(2)
}
