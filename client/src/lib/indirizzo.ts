const PORTA_PREDEFINITA = "8090"

/**
 * Rende utilizzabile ciò che l'utente scrive come indirizzo del server:
 *  "192.168.1.20"        -> "http://192.168.1.20:8090"
 *  "pc-server:8090/"     -> "http://pc-server:8090"
 *  "https://gieffe.lan"  -> "https://gieffe.lan"
 * Restituisce null se non è un indirizzo valido.
 */
export function normalizzaIndirizzo(scritto: string): string | null {
  let s = scritto.trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = "http://" + s
  try {
    const u = new URL(s)
    if (!u.hostname) return null
    if (u.protocol === "http:" && !u.port) u.port = PORTA_PREDEFINITA
    return u.origin
  } catch {
    return null
  }
}
