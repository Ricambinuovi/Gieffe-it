<script lang="ts">
  import { onMount } from "svelte"
  import { messaggioErrore } from "../lib/errori"
  import { formattaOra } from "../lib/consegne"
  import { inizia, quandoArrivaMessaggio, rispondiStato, stato } from "../lib/connessione.svelte"
  import { impostaTray, mostraPostit, nascondiPostit } from "../lib/tauri"
  import type { Consegna } from "../lib/tipi"

  let contenitore: HTMLDivElement | undefined = $state()
  let errore = $state("")

  onMount(() => {
    quandoArrivaMessaggio(() => {})
    void inizia()
  })

  // Icona del tray: messaggi in sospeso / non connesso
  $effect(() => {
    void impostaTray(stato.inSospeso.length, stato.fase === "connesso")
  })

  // Nasconde la finestra quando non c'è nulla; altrimenti la mostra e ne adatta l'altezza al
  // contenuto. L'osservatore rimisura anche dopo che la finestra è comparsa (da nascosta
  // il contenuto va a capo in modo diverso).
  const ALTEZZA_MASSIMA = 520
  $effect(() => {
    if (stato.inSospeso.length === 0) {
      void nascondiPostit()
      return
    }
    const el = contenitore
    if (!el) return
    let ultima = 0
    const adatta = () => {
      const h = Math.min(Math.ceil(el.offsetHeight), ALTEZZA_MASSIMA)
      if (h !== ultima) {
        ultima = h
        void mostraPostit(h)
      }
    }
    adatta()
    const osservatore = new ResizeObserver(adatta)
    osservatore.observe(el)
    return () => osservatore.disconnect()
  })

  async function agisci(c: Consegna, nuovo: "ok" | "ignorato") {
    errore = ""
    try {
      await rispondiStato(c, nuovo)
    } catch (e) {
      errore = messaggioErrore(e)
    }
  }
</script>

<div class="postit">
<div class="contenuto" bind:this={contenitore}>
  {#if stato.inSospeso.length > 1}
    <div class="contatore">{stato.inSospeso.length} messaggi</div>
  {/if}

  {#each stato.inSospeso as c (c.id)}
    {@const m = c.expand?.messaggio}
    <article class="foglietto" class:urgente={m?.urgenza === "urgente"}>
      <header>
        <strong>{m?.expand?.mittente?.name ?? "…"}</strong>
        {#if m?.expand?.mittente?.postazione}<span class="tenue">· {m.expand.mittente.postazione}</span>{/if}
        <span class="spazio"></span>
        <span class="tenue">{formattaOra(m?.created ?? c.created)}</span>
      </header>
      {#if m?.urgenza === "urgente"}<div class="etichetta">URGENTE</div>{/if}
      <p class="testo">{m?.testo ?? ""}</p>
      <footer>
        <button class="primario" onclick={() => agisci(c, "ok")}>OK</button>
        {#if m?.urgenza !== "urgente"}
          <button onclick={() => agisci(c, "ignorato")}>Ignora</button>
        {/if}
      </footer>
    </article>
  {/each}

  {#if errore}<div class="errore" role="alert">{errore}</div>{/if}
</div>
</div>

<style>
  .postit { background: #fff3a0; min-height: 100%; }
  .contenuto { padding: 10px; }
  .contatore { font-weight: 700; margin: 2px 4px 8px; }
  .foglietto { background: var(--giallo); border: 1px solid #d8b800; border-radius: 4px; padding: 10px 12px; margin-bottom: 10px; box-shadow: 0 2px 6px rgba(0,0,0,.2); }
  .foglietto.urgente { background: #ff9fb1; border-color: var(--urgente); }
  header { display: flex; gap: 6px; align-items: baseline; font-size: 0.9rem; }
  .etichetta { font-weight: 800; color: #8a0f2c; margin-top: 4px; }
  .testo { font-size: 1.15rem; margin: 8px 0 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
  footer { display: flex; gap: 8px; }
</style>
