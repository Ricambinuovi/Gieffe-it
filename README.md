# Gieffe-it

Post-it digitali per la comunicazione interna di Gieffecar: i messaggi compaiono sui PC dei
colleghi della sede, in rete locale, senza servizi cloud.

- `server/`: PocketBase (database, regole di accesso, hook, tempo reale)
- `client/`: app desktop Tauri + Svelte (dalla fase 2)

> Stato: **fase 1 (server)** completata. Il README completo (installazione dei client,
> backup, ecc.) arriva con la fase 6.

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
