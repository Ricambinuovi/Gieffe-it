<script lang="ts">
  import { onMount } from "svelte"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import type PocketBase from "pocketbase"
  import { messaggioErrore } from "../lib/errori"
  import { destinatariEffettivi, riepilogoDestinatari } from "../lib/rubrica"
  import { clientDaSessione, leggiSessione } from "../lib/sessione"
  import { apriFinestra } from "../lib/tauri"
  import type { Gruppo, Sessione, Urgenza, Utente } from "../lib/tipi"

  const MAX = 1000

  let sessione = $state<Sessione | null>(null)
  let pb: PocketBase | null = null
  let gruppi: Gruppo[] = $state([])
  let rubrica: Utente[] = $state([])
  let caricamento = $state(true)
  let erroreCaricamento = $state("")

  let testo = $state("")
  let urgenza: Urgenza = $state("normale")
  let tutti = $state(false)
  let gruppiScelti: string[] = $state([])
  let utentiScelti: string[] = $state([])
  let cerca = $state("")

  let invio = $state(false)
  let errore = $state("")
  let inviato = $state(false)

  const mioId = $derived(sessione?.utente.id ?? "")
  const destinatari = $derived(
    mioId ? destinatariEffettivi({ tutti, gruppi: gruppiScelti, utenti: utentiScelti }, rubrica, mioId) : [],
  )
  const altri = $derived(rubrica.filter((u) => u.id !== mioId))
  const visibili = $derived(
    altri.filter((u) => `${u.name} ${u.postazione ?? ""}`.toLowerCase().includes(cerca.trim().toLowerCase())),
  )
  const puoInviare = $derived(!invio && !inviato && testo.trim().length > 0 && destinatari.length > 0)

  onMount(async () => {
    sessione = await leggiSessione()
    if (!sessione) {
      await apriFinestra("login")
      await getCurrentWindow().close()
      return
    }
    pb = clientDaSessione(sessione)
    try {
      ;[gruppi, rubrica] = await Promise.all([
        pb.collection("gruppi").getFullList<Gruppo>({ sort: "nome" }),
        pb.collection("users").getFullList<Utente>({ sort: "name" }),
      ])
    } catch (e) {
      erroreCaricamento = messaggioErrore(e)
    } finally {
      caricamento = false
    }
  })

  function alterna(lista: string[], id: string): string[] {
    return lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]
  }

  async function invia() {
    if (!pb || !sessione || !puoInviare) return
    errore = ""
    invio = true
    try {
      await pb.collection("messaggi").create({
        mittente: sessione.utente.id,
        testo: testo.trim(),
        urgenza,
        a_tutti: tutti,
        gruppi: tutti ? [] : gruppiScelti,
        utenti: tutti ? [] : utentiScelti,
      })
      inviato = true
      setTimeout(() => void getCurrentWindow().close(), 1200)
    } catch (e) {
      errore = messaggioErrore(e)
    } finally {
      invio = false
    }
  }

  function tasto(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void invia()
    }
  }
</script>

<svelte:window onkeydown={tasto} />

<div class="pagina nuovo">
  <h1>Nuovo messaggio</h1>

  {#if caricamento}
    <p class="tenue">Caricamento…</p>
  {:else if erroreCaricamento}
    <div class="errore" role="alert">{erroreCaricamento}</div>
  {:else}
    <label for="testo">Messaggio</label>
    <!-- svelte-ignore a11y_autofocus -->
    <textarea id="testo" bind:value={testo} maxlength={MAX} placeholder="Scrivi il messaggio…" autofocus></textarea>
    <div class="tenue contatore">{testo.length}/{MAX}</div>

    <h2>Destinatari</h2>
    <div class="catene">
      <button type="button" class="scelta" class:attiva={tutti} aria-pressed={tutti} onclick={() => (tutti = !tutti)}>
        Tutti
      </button>
      {#each gruppi as g (g.id)}
        {@const attivo = gruppiScelti.includes(g.id)}
        <button
          type="button" class="scelta" class:attiva={attivo && !tutti} aria-pressed={attivo && !tutti}
          disabled={tutti} onclick={() => (gruppiScelti = alterna(gruppiScelti, g.id))}
        >
          {g.nome}
        </button>
      {/each}
    </div>

    {#if !tutti}
      <label for="cerca">Persone</label>
      <input id="cerca" type="text" bind:value={cerca} placeholder="Cerca per nome o postazione" autocomplete="off" />
      <ul class="persone">
        {#each visibili as u (u.id)}
          <li>
            <label class="persona">
              <input
                type="checkbox" checked={utentiScelti.includes(u.id)}
                onchange={() => (utentiScelti = alterna(utentiScelti, u.id))}
              />
              <span>{u.name}</span>
              {#if u.postazione}<span class="tenue">{u.postazione}</span>{/if}
            </label>
          </li>
        {:else}
          <li class="tenue">Nessuna persona trovata.</li>
        {/each}
      </ul>
    {/if}

    <p class="tenue riepilogo">{riepilogoDestinatari(destinatari.length)}</p>

    <h2>Urgenza</h2>
    <div class="catene">
      <button type="button" class="scelta" class:attiva={urgenza === "normale"} aria-pressed={urgenza === "normale"} onclick={() => (urgenza = "normale")}>Normale</button>
      <button type="button" class="scelta urgente" class:attiva={urgenza === "urgente"} aria-pressed={urgenza === "urgente"} onclick={() => (urgenza = "urgente")}>Urgente</button>
    </div>
    {#if urgenza === "urgente"}
      <p class="tenue">Un messaggio urgente può essere chiuso dal destinatario solo con «OK».</p>
    {/if}

    {#if errore}<div class="errore" role="alert">{errore}</div>{/if}
    {#if inviato}<div class="riuscito" role="status">Messaggio inviato.</div>{/if}

    <div class="riga azioni">
      <span class="tenue">Ctrl + Invio per inviare</span>
      <div class="spazio"></div>
      <button type="button" onclick={() => getCurrentWindow().close()}>Annulla</button>
      <button type="button" class="primario" disabled={!puoInviare} onclick={invia}>
        {invio ? "Invio…" : "Invia"}
      </button>
    </div>
  {/if}
</div>

<style>
  .nuovo { overflow-y: auto; }
  .contatore { text-align: right; margin-top: 2px; }
  .catene { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
  .scelta { border-radius: 999px; padding: 6px 14px; }
  .scelta.attiva { background: var(--primario); border-color: var(--primario); color: #fff; }
  .scelta.urgente.attiva { background: var(--urgente); border-color: var(--urgente); }
  .persone { list-style: none; margin: 8px 0 0; padding: 0; max-height: 180px; overflow-y: auto; border: 1px solid var(--bordo); border-radius: var(--raggio); background: var(--carta); }
  .persone li { padding: 0; }
  .persona { display: flex; gap: 10px; align-items: center; margin: 0; padding: 7px 11px; font-weight: 400; cursor: pointer; }
  .persona:hover { background: #f0ede2; }
  .riepilogo { margin: 8px 0 14px; }
  .azioni { margin-top: auto; padding-top: 16px; }
</style>
