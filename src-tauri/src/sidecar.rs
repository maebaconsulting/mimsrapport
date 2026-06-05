// Gestion du cycle de vie du sidecar PocketBase.
//
// Responsabilités (le Rust orchestre, sans logique métier) :
//  - choisir le port (8090 par défaut, repli sur un port libre si occupé) ;
//  - résoudre le dossier de données utilisateur et le dossier des migrations ;
//  - lancer le binaire PocketBase en sidecar et attendre qu'il réponde ;
//  - drainer ses logs ; l'arrêter proprement à la fermeture de l'app.

use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const DEFAULT_PORT: u16 = 8090;
const STARTUP_TIMEOUT: Duration = Duration::from_secs(20);

/// État partagé : handle du process PocketBase et port retenu.
pub struct PocketBaseState {
    pub child: Mutex<Option<CommandChild>>,
    pub port: u16,
}

/// Choisit un port d'écoute : le port par défaut s'il est libre, sinon un port
/// libre attribué par l'OS.
fn choose_port() -> u16 {
    if TcpListener::bind((Ipv4Addr::LOCALHOST, DEFAULT_PORT)).is_ok() {
        return DEFAULT_PORT;
    }
    // Repli : laisser l'OS attribuer un port libre, puis le réutiliser.
    match TcpListener::bind((Ipv4Addr::LOCALHOST, 0)) {
        Ok(listener) => listener
            .local_addr()
            .map(|addr| addr.port())
            .unwrap_or(DEFAULT_PORT),
        Err(_) => DEFAULT_PORT,
    }
}

/// Résout le dossier des migrations : source du dépôt en dev, ressource bundlée
/// en production.
fn migrations_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if tauri::is_dev() {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("pocketbase")
            .join("pb_migrations");
        Ok(dir)
    } else {
        app.path()
            .resolve("pb_migrations", tauri::path::BaseDirectory::Resource)
            .map_err(|e| format!("résolution du dossier de migrations : {e}"))
    }
}

/// Attend que le port accepte les connexions (PocketBase a fini d'appliquer les
/// migrations et sert l'API).
fn wait_until_ready(port: u16) -> Result<(), String> {
    let addr = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
    let deadline = Instant::now() + STARTUP_TIMEOUT;
    while Instant::now() < deadline {
        if TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok() {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    Err(format!(
        "PocketBase n'a pas répondu sur le port {port} dans le délai imparti"
    ))
}

/// Démarre le sidecar PocketBase et enregistre son état dans l'application.
/// Bloque jusqu'à ce que le serveur réponde (ou expiration du délai).
pub fn start(app: &AppHandle) -> Result<(), String> {
    let port = choose_port();

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("dossier de données application : {e}"))?
        .join("pb_data");
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("création du dossier de données : {e}"))?;

    let migrations = migrations_dir(app)?;

    let sidecar = app
        .shell()
        .sidecar("pocketbase")
        .map_err(|e| format!("résolution du binaire sidecar : {e}"))?
        .args([
            "serve",
            "--dir",
            data_dir.to_string_lossy().as_ref(),
            "--migrationsDir",
            migrations.to_string_lossy().as_ref(),
            "--http",
            &format!("127.0.0.1:{port}"),
        ]);

    let (mut rx, child) = sidecar
        .spawn()
        .map_err(|e| format!("lancement du sidecar PocketBase : {e}"))?;

    // Drainer les logs du sidecar pour éviter de bloquer son flux de sortie.
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    print!("[pocketbase] {}", String::from_utf8_lossy(&bytes));
                }
                CommandEvent::Stderr(bytes) => {
                    eprint!("[pocketbase] {}", String::from_utf8_lossy(&bytes));
                }
                CommandEvent::Error(err) => {
                    eprintln!("[pocketbase] erreur : {err}");
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!("[pocketbase] terminé : code={:?}", payload.code);
                }
                _ => {}
            }
        }
    });

    app.manage(PocketBaseState {
        child: Mutex::new(Some(child)),
        port,
    });

    wait_until_ready(port)?;
    println!("[reporting-manar] PocketBase prêt sur 127.0.0.1:{port}");
    Ok(())
}

/// Arrête proprement le sidecar (à la fermeture de l'application).
pub fn stop(app: &AppHandle) {
    if let Some(state) = app.try_state::<PocketBaseState>() {
        if let Ok(mut guard) = state.child.lock() {
            if let Some(child) = guard.take() {
                let _ = child.kill();
                println!("[reporting-manar] sidecar PocketBase arrêté");
            }
        }
    }
}

/// Commande exposée au frontend : URL de base de PocketBase (jamais codée en dur
/// côté frontend, lue de cette configuration).
#[tauri::command]
pub fn get_pocketbase_url(state: tauri::State<PocketBaseState>) -> String {
    format!("http://127.0.0.1:{}", state.port)
}
