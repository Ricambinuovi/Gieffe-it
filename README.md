# Gieffe-it

Post-it digitali per la comunicazione interna di Gieffecar: i messaggi compaiono sui PC dei
colleghi della sede, in rete locale, senza servizi cloud.

- `server/`: PocketBase (database, regole di accesso, hook, tempo reale)
- `client/`: app desktop Tauri + Svelte (dalla fase 2)

> Stato: **fase 2 (client base)** completata: accesso, tray, invio e ricezione in tempo reale.
> Il post-it senza focus, il rinvio, la grafica, gli inviati e lo storico arrivano nelle fasi
> successive. Il README completo (installazione dei client, backup, ecc.) arriva con la fase 6.

## Server (Linux)

### Provarlo sul proprio PC

```bash
cd server
./dev.sh                  # scarica PocketBase la prima volta e lo avvia su http://localhost:8090
```

Al primo avvio PocketBase stampa un link `http://127.0.0.1:8090/_/#/pbinstal/...` per creare
l'amministratore. Per caricare utenti e messaggi di prova:

```bash
cd server && npm install
PB_ADMIN_EMAIL=tua@email PB_ADMIN_PASSWORD=la-tua-password npm run seed
```

Gli utenti di prova sono `maria@`, `luca@`, `giulia@`, `paolo@`, `marco@`, `sara@gieffecar.test`,
password `gieffe-prova-123`.

### Installarlo come servizio (avvio automatico)

```bash
cd server
sudo ./install-server.sh
```

Crea l'utente di servizio `gieffe`, installa tutto in `/opt/gieffe-it`, tiene i dati in
`/var/lib/gieffe-it/pb_data` e abilita il servizio systemd `gieffe-it` (porta 8090).
Dopo l'installazione: pannello admin su `http://<ip-server>:8090/_/`.

Comandi utili: `systemctl status gieffe-it`, `journalctl -u gieffe-it -f`.

### Backup

PocketBase salva ogni notte alle 03:00 un backup completo in
`/var/lib/gieffe-it/pb_data/backups/` (ne tiene 14). Copia ogni tanto quella cartella su un
altro disco o PC.

### Test

```bash
cd server && npm install
PB_BIN=/percorso/di/pocketbase npm test    # oppure: ./scripts/scarica-pocketbase.sh bin
```

Avvia un server temporaneo e verifica hook, regole di accesso, stati, urgenti, risposte,
tempo reale e durata della sessione.

## Client (prova in sviluppo)

Requisiti su Linux Mint: Node.js 20+, Rust (https://rustup.rs) e le librerie di sistema di Tauri:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential libxdo-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev patchelf
```

```bash
cd client
npm install
npm run tauri dev                              # avvia l'app (la prima volta compila per qualche minuto)
```

Al primo avvio si apre la finestra di accesso: indirizzo del server (es. `localhost` oppure
l'IP del PC server), email e password di un utente creato dal pannello admin. L'app poi vive
nel tray (icona del foglietto giallo): menu **Nuovo messaggio, Inviati, Storico,
Impostazioni, Esci**.

### Provare con due utenti sullo stesso PC

```bash
cd client
npm run tauri build -- --debug --no-bundle     # una volta, e dopo ogni modifica al codice
scripts/istanza.sh maria                       # primo utente
scripts/istanza.sh luca --apri nuovo           # secondo utente, con la finestra "Nuovo messaggio"
```

Ogni nome ha sessione e impostazioni separate; l'avvio automatico non viene toccato.
`--apri nuovo|inviati|storico|impostazioni` apre direttamente una finestra (utile anche per
un collegamento sul desktop).

### Test automatici del client

```bash
cd client
npm test                                       # logica (errori in italiano, date, destinatari...)
npm run check                                  # controllo dei tipi
PB_BIN=/percorso/pocketbase e2e/prova-x11.sh   # prova completa su schermo virtuale (Linux)
```

## Schema dati

| Collezione | Contenuto |
|---|---|
| `users` (auth) | `name` (nome visualizzato), `postazione`, `gruppi` |
| `gruppi` | `nome` |
| `messaggi` | `mittente`, `testo`, `urgenza` (normale/urgente), `a_tutti`, `gruppi`, `utenti`, `risposta_a`, `created` |
| `consegne` | `messaggio`, `destinatario`, `stato` (in_attesa/ok/ignorato/posticipato), `posticipato_fino_a`, `azione_il` |
| `modelli` | `testo`, `urgente`, `ordine` |

Utenti, gruppi e modelli si gestiscono dal pannello admin. Le consegne le crea il server
quando arriva un messaggio (`server/pb_hooks`).
