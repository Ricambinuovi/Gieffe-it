// Dati di prova: gruppi, utenti, modelli e qualche messaggio.
// Uso:  PB_URL=http://127.0.0.1:8090 PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... npm run seed
// Si può rilanciare: ciò che esiste già non viene duplicato.
import PocketBase from "pocketbase"

const url = process.env.PB_URL ?? "http://127.0.0.1:8090"
const email = process.env.PB_ADMIN_EMAIL
const password = process.env.PB_ADMIN_PASSWORD
const PASSWORD_PROVA = "gieffe-prova-123"

if (!email || !password) {
  console.error("Imposta PB_ADMIN_EMAIL e PB_ADMIN_PASSWORD (le credenziali dell'amministratore).")
  process.exit(1)
}

const pb = new PocketBase(url)
pb.autoCancellation(false)
await pb.collection("_superusers").authWithPassword(email, password)

async function trovaOCrea(collezione, filtro, dati) {
  try {
    return await pb.collection(collezione).getFirstListItem(filtro)
  } catch {
    return await pb.collection(collezione).create(dati)
  }
}

const gruppi = {}
for (const nome of ["Ufficio", "Magazzino", "Officina"]) {
  gruppi[nome] = await trovaOCrea("gruppi", pb.filter("nome = {:n}", { n: nome }), { nome })
}

const persone = [
  ["maria", "Maria", "Banco 1", ["Ufficio"]],
  ["luca", "Luca", "Banco 2", ["Ufficio"]],
  ["giulia", "Giulia", "Amministrazione", ["Ufficio"]],
  ["paolo", "Paolo", "Magazzino", ["Magazzino"]],
  ["marco", "Marco", "Officina", ["Officina"]],
  ["sara", "Sara", "Officina", ["Officina", "Magazzino"]],
]
const utenti = {}
for (const [id, name, postazione, g] of persone) {
  const mail = `${id}@gieffecar.test`
  utenti[id] = await trovaOCrea("users", pb.filter("email = {:e}", { e: mail }), {
    email: mail,
    password: PASSWORD_PROVA,
    passwordConfirm: PASSWORD_PROVA,
    emailVisibility: false,
    verified: true,
    name,
    postazione,
    gruppi: g.map((n) => gruppi[n].id),
  })
}

const modelli = [
  ["Cliente al banco", false],
  ["Chiamata in attesa sulla linea 1", false],
  ["Corriere in arrivo, serve qualcuno in magazzino", false],
  ["URGENTE: serve subito un responsabile", true],
]
for (const [i, [testo, urgente]] of modelli.entries()) {
  await trovaOCrea("modelli", pb.filter("testo = {:t}", { t: testo }), { testo, urgente, ordine: i + 1 })
}

// qualche messaggio (solo se non ce ne sono già)
const esistenti = await pb.collection("messaggi").getList(1, 1)
if (esistenti.totalItems === 0) {
  await pb.collection("messaggi").create({
    mittente: utenti.maria.id, urgenza: "normale", testo: "Cliente al banco", gruppi: [gruppi.Officina.id],
  })
  await pb.collection("messaggi").create({
    mittente: utenti.giulia.id, urgenza: "urgente", testo: "Riunione tra 5 minuti in ufficio", a_tutti: true,
  })
  await pb.collection("messaggi").create({
    mittente: utenti.paolo.id, urgenza: "normale", testo: "Il corriere è arrivato", utenti: [utenti.maria.id, utenti.luca.id],
  })
}

console.log("Dati di prova pronti.")
console.log(`Utenti (password per tutti: ${PASSWORD_PROVA}):`)
for (const [id] of persone) console.log(`  ${id}@gieffecar.test`)
