import { mount } from "svelte"
import { getCurrentWindow } from "@tauri-apps/api/window"
import "./styles/base.css"
import Login from "./windows/Login.svelte"
import Nuovo from "./windows/Nuovo.svelte"
import Impostazioni from "./windows/Impostazioni.svelte"
import PostIt from "./windows/PostIt.svelte"
import Segnaposto from "./windows/Segnaposto.svelte"

// Un solo frontend per tutte le finestre: quale mostrare lo decide l'etichetta della finestra.
const etichetta = getCurrentWindow().label
const target = document.getElementById("app")!

const titoli: Record<string, string> = { inviati: "Inviati", storico: "Storico" }

switch (etichetta) {
  case "postit": mount(PostIt, { target }); break
  case "login": mount(Login, { target }); break
  case "nuovo": mount(Nuovo, { target }); break
  case "impostazioni": mount(Impostazioni, { target }); break
  default: mount(Segnaposto, { target, props: { titolo: titoli[etichetta] ?? "Gieffe-it" } })
}
