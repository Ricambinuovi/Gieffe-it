// Avvia un server PocketBase con database temporaneo, migrazioni e hook del progetto.
import { spawn, spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import net from "node:net"
import PocketBase from "pocketbase"

const qui = dirname(fileURLToPath(import.meta.url))
export const serverDir = resolve(qui, "..")

export const ADMIN = { email: "admin@test.local", password: "admin-test-123" }
export const PASSWORD = "password-prova-123"

function binario() {
  const candidati = [process.env.PB_BIN, join(serverDir, "bin", "pocketbase")].filter(Boolean)
  const trovato = candidati.find((p) => existsSync(p))
  if (!trovato) {
    throw new Error("PocketBase non trovato: imposta PB_BIN oppure esegui scripts/scarica-pocketbase.sh bin")
  }
  return trovato
}

function portaLibera() {
  return new Promise((ok, ko) => {
    const s = net.createServer()
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address()
      s.close(() => ok(port))
    })
    s.on("error", ko)
  })
}

export async function avviaServer() {
  const bin = binario()
  const dir = mkdtempSync(join(tmpdir(), "gieffe-test-"))
  const porta = await portaLibera()
  const base = [
    `--dir=${dir}`,
    `--migrationsDir=${join(serverDir, "pb_migrations")}`,
    `--hooksDir=${join(serverDir, "pb_hooks")}`,
  ]

  const r = spawnSync(bin, ["superuser", "upsert", ADMIN.email, ADMIN.password, ...base])
  if (r.status !== 0) throw new Error("superuser upsert fallito: " + r.stderr + r.stdout)

  const proc = spawn(bin, ["serve", `--http=127.0.0.1:${porta}`, ...base], { stdio: "ignore" })
  const url = `http://127.0.0.1:${porta}`

  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`${url}/api/health`)
      if (res.ok) break
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }

  const admin = new PocketBase(url)
  admin.autoCancellation(false)
  await admin.collection("_superusers").authWithPassword(ADMIN.email, ADMIN.password)

  return {
    url,
    admin,
    async accedi(email) {
      const pb = new PocketBase(url)
      pb.autoCancellation(false)
      await pb.collection("users").authWithPassword(email, PASSWORD)
      return pb
    },
    async ferma() {
      proc.kill()
      await new Promise((r) => proc.once("exit", r))
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

/** Crea gruppi e utenti di prova. Restituisce { gruppi, utenti } indicizzati per nome. */
export async function creaScenario(admin) {
  const gruppi = {}
  for (const nome of ["Ufficio", "Magazzino", "Officina"]) {
    gruppi[nome] = await admin.collection("gruppi").create({ nome })
  }

  const definizioni = [
    ["anna", "Anna", "Banco 1", ["Ufficio"]],
    ["bruno", "Bruno", "Banco 2", ["Ufficio"]],
    ["carla", "Carla", "Magazzino", ["Magazzino"]],
    ["dario", "Dario", "Officina", ["Officina"]],
    ["elisa", "Elisa", "Officina", ["Officina", "Magazzino"]],
  ]
  const utenti = {}
  for (const [id, name, postazione, g] of definizioni) {
    utenti[id] = await admin.collection("users").create({
      email: `${id}@test.local`,
      password: PASSWORD,
      passwordConfirm: PASSWORD,
      name,
      postazione,
      gruppi: g.map((n) => gruppi[n].id),
      verified: true,
    })
  }
  return { gruppi, utenti }
}
