<script lang="ts">
  import { onMount } from "svelte"
  import { listen, emit } from "@tauri-apps/api/event"
  import { getVersion } from "@tauri-apps/api/app"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart"
  import { cancellaSessione, leggiSessione } from "../lib/sessione"
  import { avvioAutomaticoDisponibile, EVENTO_CHIEDI_STATO, EVENTO_SESSIONE, EVENTO_STATO } from "../lib/tauri"
  import type { Sessione } from "../lib/tipi"

  let sessione: Sessione | null = $state(null)
  let versione = $state("")
  let connessione = $state("…")
  let avvioAutomatico = $state(false)
  let avvioDisponibile = $state(false)
  let errore = $state("")

  const testiFase: Record<string, string> = {
    connesso: "Connesso",
    offline: "Server non raggiungibile: riprovo da solo",
    senza_sessione: "Non hai ancora effettuato l'accesso",
    avvio: "Connessione in corso…",
  }

  onMount(() => {
    let sciogli = () => {}
    void (async () => {
      sessione = await leggiSessione()
      versione = await getVersion()

      // L'avvio automatico si imposta solo nell'app installata, non in prova.
      avvioDisponibile = await avvioAutomaticoDisponibile()
      if (avvioDisponibile) {
        try { avvioAutomatico = await isEnabled() } catch { avvioDisponibile = false }
      }

      const fine = await listen<{ fase: string; inSospeso: number }>(EVENTO_STATO, (e) => {
        connessione = testiFase[e.payload.fase] ?? e.payload.fase
      })
      sciogli = fine
      await emit(EVENTO_CHIEDI_STATO, {})
    })()
    return () => sciogli()
  })

  async function cambiaAvvio() {
    errore = ""
    try {
      if (avvioAutomatico) await enable()
      else await disable()
    } catch {
      errore = "Non sono riuscito a cambiare l'avvio automatico."
      avvioAutomatico = !avvioAutomatico
    }
  }

  async function esciDaAccount() {
    if (!confirm("Vuoi uscire dall'account? Dovrai accedere di nuovo per ricevere i messaggi.")) return
    await cancellaSessione()
    await emit(EVENTO_SESSIONE, {})
    await getCurrentWindow().close()
  }
</script>

<div class="pagina">
  <h1>Impostazioni</h1>

  <h2>Account</h2>
  {#if sessione}
    <p><strong>{sessione.utente.name}</strong>{#if sessione.utente.postazione}{" · " + sessione.utente.postazione}{/if}</p>
    <p class="tenue">Server: {sessione.server}</p>
  {:else}
    <p class="tenue">Non hai ancora effettuato l'accesso.</p>
  {/if}
  <p>Stato: <strong>{connessione}</strong></p>

  <h2 style="margin-top: 18px">Avvio</h2>
  <label class="casella">
    <input type="checkbox" bind:checked={avvioAutomatico} disabled={!avvioDisponibile} onchange={cambiaAvvio} />
    <span>Avvia Gieffe-it all'accensione del PC</span>
  </label>
  {#if !avvioDisponibile}
    <p class="tenue">Disponibile nell'app installata.</p>
  {/if}
  {#if errore}<div class="errore" role="alert">{errore}</div>{/if}

  <div class="spazio"></div>
  <div class="riga">
    <span class="tenue">Gieffe-it {versione}</span>
    <div class="spazio"></div>
    {#if sessione}<button onclick={esciDaAccount}>Esci dall'account</button>{/if}
    <button class="primario" onclick={() => getCurrentWindow().close()}>Chiudi</button>
  </div>
</div>

<style>
  .casella { display: flex; gap: 10px; align-items: center; font-weight: 400; margin: 4px 0; }
</style>
