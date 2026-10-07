mod icone;

use icone::{icona, Aspetto};
use std::sync::Mutex;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Manager, PhysicalPosition, RunEvent, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_autostart::MacosLauncher;

const ID_TRAY: &str = "gieffe-tray";
const LARGHEZZA_POSTIT: f64 = 380.0;
const MARGINE: i32 = 24;

/// Stato mostrato dal tray, aggiornato dal frontend.
struct StatoTray {
    in_sospeso: u32,
    connesso: bool,
}

/// Dove sta il post-it: x del bordo sinistro e y del bordo inferiore (pixel fisici).
/// Si ricorda invece di rileggere la posizione, che appena dopo show() può essere ancora vecchia.
struct AncoraPostit(Mutex<Option<(i32, i32)>>);

struct TrayHandle(Mutex<Option<TrayIcon>>);
struct Stato(Mutex<StatoTray>);

/// Caratteristiche delle finestre "normali" (non il post-it).
fn definizione(nome: &str) -> Option<(&'static str, f64, f64, bool)> {
    match nome {
        "login" => Some(("Accedi a Gieffe-it", 420.0, 560.0, false)),
        "nuovo" => Some(("Nuovo messaggio", 540.0, 700.0, true)),
        "inviati" => Some(("Inviati", 680.0, 620.0, true)),
        "storico" => Some(("Storico", 760.0, 660.0, true)),
        "impostazioni" => Some(("Impostazioni", 480.0, 520.0, false)),
        _ => None,
    }
}

fn apri(app: &AppHandle, nome: &str) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(nome) {
        let _ = w.unminimize();
        w.show().map_err(|e| e.to_string())?;
        let _ = w.set_focus();
        return Ok(());
    }
    let (titolo, larghezza, altezza, ridimensionabile) =
        definizione(nome).ok_or_else(|| format!("finestra sconosciuta: {nome}"))?;
    WebviewWindowBuilder::new(app, nome, WebviewUrl::App("index.html".into()))
        .title(titolo)
        .inner_size(larghezza, altezza)
        .min_inner_size(larghezza.min(380.0), 360.0)
        .resizable(ridimensionabile)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Gestisce "--apri <finestra>" dalla riga di comando (es. un collegamento "Nuovo messaggio").
/// Senza argomenti riconosciuti restituisce false.
fn apri_da_argomenti(app: &AppHandle, args: &[String]) -> bool {
    if let Some(i) = args.iter().position(|a| a == "--apri") {
        if let Some(nome) = args.get(i + 1) {
            return apri(app, nome).is_ok();
        }
    }
    false
}

#[tauri::command]
fn apri_finestra(app: AppHandle, nome: String) -> Result<(), String> {
    apri(&app, &nome)
}

/// True se l'app è stata avviata da scripts/istanza.sh (prova con più utenti): in quel caso
/// non si tocca l'avvio automatico del PC.
#[tauri::command]
fn istanza_di_prova() -> bool {
    std::env::var_os("GIEFFE_MULTI").is_some()
}

#[tauri::command]
fn esci(app: AppHandle) {
    app.exit(0);
}

/// Mostra la finestra del post-it in basso a destra, con l'altezza richiesta.
/// Se è già visibile ne cambia l'altezza tenendo fermo il bordo inferiore.
#[tauri::command]
fn postit_mostra(app: AppHandle, altezza: f64) -> Result<(), String> {
    let w = app.get_webview_window("postit").ok_or("post-it non trovato")?;
    let scala = w.scale_factor().map_err(|e| e.to_string())?;
    let altezza = altezza.max(120.0);
    let nuova_h = (altezza * scala).round() as i32;

    let visibile = w.is_visible().unwrap_or(false);
    let ancora_salvata = *app.state::<AncoraPostit>().0.lock().unwrap();

    let (x, basso) = match (visibile, ancora_salvata) {
        (true, Some(a)) => a,
        _ => {
            // prima apertura: in basso a destra dell'area di lavoro
            let (mut x, mut basso) = (0, nuova_h);
            if let Ok(Some(m)) = w.primary_monitor() {
                let area = m.work_area();
                let l = (LARGHEZZA_POSTIT * scala).round() as i32;
                x = area.position.x + area.size.width as i32 - l - MARGINE;
                basso = area.position.y + area.size.height as i32 - MARGINE;
            }
            (x, basso)
        }
    };
    *app.state::<AncoraPostit>().0.lock().unwrap() = Some((x, basso));

    w.set_size(tauri::LogicalSize::new(LARGHEZZA_POSTIT, altezza))
        .map_err(|e| e.to_string())?;
    let _ = w.set_position(PhysicalPosition::new(x, basso - nuova_h));
    if !visibile {
        w.show().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn postit_nascondi(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("postit") {
        w.hide().map_err(|e| e.to_string())?;
    }
    *app.state::<AncoraPostit>().0.lock().unwrap() = None;
    Ok(())
}

/// Aggiorna icona e descrizione del tray.
#[tauri::command]
fn imposta_tray(app: AppHandle, in_sospeso: u32, connesso: bool) -> Result<(), String> {
    {
        let stato = app.state::<Stato>();
        let mut s = stato.0.lock().unwrap();
        s.in_sospeso = in_sospeso;
        s.connesso = connesso;
    }
    aggiorna_tray(&app);
    Ok(())
}

fn aggiorna_tray(app: &AppHandle) {
    let (in_sospeso, connesso) = {
        let s = app.state::<Stato>();
        let g = s.0.lock().unwrap();
        (g.in_sospeso, g.connesso)
    };
    let (aspetto, testo) = if in_sospeso > 0 {
        let t = if in_sospeso == 1 {
            "Gieffe-it: 1 messaggio in sospeso".to_string()
        } else {
            format!("Gieffe-it: {in_sospeso} messaggi in sospeso")
        };
        (Aspetto::InSospeso, t)
    } else if !connesso {
        (Aspetto::NonConnesso, "Gieffe-it: server non raggiungibile".to_string())
    } else {
        (Aspetto::Normale, "Gieffe-it".to_string())
    };

    if let Some(tray) = app.state::<TrayHandle>().0.lock().unwrap().as_ref() {
        let _ = tray.set_icon(Some(icona(aspetto)));
        let _ = tray.set_tooltip(Some(testo));
    }
}

fn crea_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .item(&MenuItemBuilder::with_id("nuovo", "Nuovo messaggio").build(app)?)
        .item(&MenuItemBuilder::with_id("inviati", "Inviati").build(app)?)
        .item(&MenuItemBuilder::with_id("storico", "Storico").build(app)?)
        .item(&MenuItemBuilder::with_id("impostazioni", "Impostazioni").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("esci", "Esci").build(app)?)
        .build()?;

    let tray = TrayIconBuilder::with_id(ID_TRAY)
        .icon(icona(Aspetto::NonConnesso))
        .tooltip("Gieffe-it")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, evento| match evento.id().as_ref() {
            "esci" => app.exit(0),
            id => {
                let _ = apri(app, id);
            }
        })
        .build(app)?;

    *app.state::<TrayHandle>().0.lock().unwrap() = Some(tray);
    Ok(())
}

fn crea_postit(app: &AppHandle) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, "postit", WebviewUrl::App("index.html".into()))
        .title("Gieffe-it")
        .inner_size(LARGHEZZA_POSTIT, 260.0)
        .decorations(false)
        // Su Linux (GTK) le finestre non ridimensionabili ignorano set_size: la finestra
        // senza bordi non si può comunque trascinare per allargarla.
        .resizable(true)
        .maximizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .focused(false)
        .build()?;
    Ok(())
}

pub fn run() {
    let mut builder = tauri::Builder::default();

    // Una sola istanza per PC. Per provare due utenti sullo stesso PC si imposta
    // GIEFFE_MULTI=1 (vedi client/scripts/istanza.sh).
    if std::env::var_os("GIEFFE_MULTI").is_none() {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // un secondo avvio apre la finestra richiesta, o "Nuovo messaggio"
            if !apri_da_argomenti(app, &args) {
                let _ = apri(app, "nuovo");
            }
        }));
    }

    builder
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--nascosto"]),
        ))
        .manage(TrayHandle(Mutex::new(None)))
        .manage(AncoraPostit(Mutex::new(None)))
        .manage(Stato(Mutex::new(StatoTray { in_sospeso: 0, connesso: false })))
        .invoke_handler(tauri::generate_handler![
            apri_finestra,
            istanza_di_prova,
            esci,
            postit_mostra,
            postit_nascondi,
            imposta_tray
        ])
        .setup(|app| {
            crea_tray(app.handle())?;
            crea_postit(app.handle())?;
            let args: Vec<String> = std::env::args().collect();
            apri_da_argomenti(app.handle(), &args);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("errore nell'avvio di Gieffe-it")
        .run(|_app, evento| {
            // L'app vive nel tray: chiudere l'ultima finestra non la termina.
            if let RunEvent::ExitRequested { api, code, .. } = evento {
                if code.is_none() {
                    api.prevent_exit();
                }
            }
        });
}
