<script lang="ts">
  import { onMount } from "svelte"
  import PocketBase from "pocketbase"
  import { emit } from "@tauri-apps/api/event"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { enable } from "@tauri-apps/plugin-autostart"
  import { normalizzaIndirizzo } from "../lib/indirizzo"
  import { messaggioErrore } from "../lib/errori"
  import {
    haImpostatoAvvioAutomatico, leggiNotaAccesso, salvaSessione, segnaAvvioAutomaticoImpostato, ultimoServer,
  } from "../lib/sessione"
  import { avvioAutomaticoDisponibile, EVENTO_SESSIONE } from "../lib/tauri"
  import type { Utente } from "../lib/tipi"

  let server = $state("")
  let email = $state("")
  let password = $state("")
  let errore = $state("")
  let nota = $state("")
  let invio = $state(false)
  let campoServer: HTMLInputElement | undefined = $state()
  let campoEmail: HTMLInputElement | undefined = $state()

  onMount(async () => {
    server = await ultimoServer()
    nota = await leggiNotaAccesso()
    // il cursore va sul primo campo ancora da compilare
    ;(server ? campoEmail : campoServer)?.focus()
  })

  async function accedi(e: Event) {
    e.preventDefault()
    errore = ""

    const indirizzo = normalizzaIndirizzo(server)
    if (!indirizzo) {
      errore = "Scrivi l'indirizzo del server, ad esempio 192.168.1.20."
      return
    }
    if (!email.trim() || !password) {
      errore = "Scrivi email e password."
      return
    }

    invio = true
    try {
      // 1) l'indirizzo è davvero un server Gieffe-it?
      let info: { app?: string } | null = null
      try {
        const r = await fetch(`${indirizzo}/api/gieffe/info`, { signal: AbortSignal.timeout(6000) })
        info = r.ok ? await r.json() : null
      } catch {
        errore = "Impossibile raggiungere il server. Controlla l'indirizzo e che il PC sia collegato alla rete."
        return
      }
      if (info?.app !== "gieffe-it") {
        errore = "A questo indirizzo non c'è un server Gieffe-it. Controlla l'indirizzo."
        return
      }

      // 2) accesso
      const pb = new PocketBase(indirizzo)
      pb.autoCancellation(false)
      const r = await pb.collection("users").authWithPassword(email.trim(), password)
      const utente = r.record as unknown as Utente

      await salvaSessione({ server: indirizzo, token: r.token, utente })

      // Avvio automatico al login del PC: si attiva la prima volta (solo nell'app installata).
      if ((await avvioAutomaticoDisponibile()) && !(await haImpostatoAvvioAutomatico())) {
        try { await enable() } catch { /* si può cambiare dalle Impostazioni */ }
        await segnaAvvioAutomaticoImpostato()
      }

      await emit(EVENTO_SESSIONE, {})
      await getCurrentWindow().close()
    } catch (err) {
      errore = messaggioErrore(err, "accesso")
    } finally {
      invio = false
    }
  }
</script>

<!-- novalidate: i controlli del browser parlano la lingua del sistema; qui si usano messaggi in italiano -->
<form class="pagina" onsubmit={accedi} novalidate>
  <h1>Accedi a Gieffe-it</h1>
  <p class="tenue">Inserisci i dati che ti ha dato l'amministratore.</p>

  {#if nota}<div class="avviso">{nota}</div>{/if}

  <label for="server">Indirizzo del server</label>
  <input id="server" type="text" bind:this={campoServer} bind:value={server} placeholder="es. 192.168.1.20" autocomplete="off" spellcheck="false" />

  <label for="email">Email</label>
  <input id="email" type="email" bind:this={campoEmail} bind:value={email} autocomplete="username" spellcheck="false" />

  <label for="password">Password</label>
  <input id="password" type="password" bind:value={password} autocomplete="current-password" />

  {#if errore}<div class="errore" role="alert">{errore}</div>{/if}

  <div class="spazio"></div>
  <button class="primario" type="submit" disabled={invio}>{invio ? "Accesso in corso…" : "Accedi"}</button>
</form>
