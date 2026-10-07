<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window"

  let { titolo }: { titolo: string } = $props()
</script>

<div class="pagina">
  <h1>{titolo}</h1>
  <p class="tenue">Questa sezione sarà disponibile in una prossima versione.</p>
  <div class="spazio"></div>
  <div class="riga">
    <div class="spazio"></div>
    <button onclick={() => getCurrentWindow().close()}>Chiudi</button>
  </div>
</div>
