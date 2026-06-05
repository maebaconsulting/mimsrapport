// Entrées/sorties fichiers · dialogues natifs côté Rust.
//
// Sécurité : aucun chemin arbitraire ne traverse l'IPC. Le dialogue natif
// (ouverture / enregistrement) est piloté par le Rust ; le chemin choisi est
// conservé dans l'état de l'application et n'est jamais accepté depuis le
// frontend. La webview ne peut donc pas demander la lecture/écriture d'un chemin
// quelconque (défense en profondeur si la webview était compromise).

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::ipc::Response;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

/// Chemin du dernier fichier choisi via le dialogue Rust (jamais fourni par le JS).
#[derive(Default)]
pub struct PickedPath(pub Mutex<Option<PathBuf>>);

/// Ouvre le dialogue de sélection d'un fichier Manar. Mémorise le chemin choisi
/// côté Rust et retourne seulement le nom du fichier (ou null si annulé).
#[tauri::command]
pub fn pick_manar_file(
    app: AppHandle,
    state: State<PickedPath>,
) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Fichier Manar", &["xls", "xlsx"])
        .blocking_pick_file();

    match picked {
        Some(file) => {
            let path = file
                .into_path()
                .map_err(|e| format!("chemin du fichier choisi : {e}"))?;
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "manar.xlsx".to_string());
            *state.0.lock().map_err(|_| "verrou empoisonné".to_string())? = Some(path);
            Ok(Some(name))
        }
        None => Ok(None),
    }
}

/// Lit le contenu binaire du fichier précédemment choisi (chemin stocké côté
/// Rust). Renvoie les octets efficacement (ArrayBuffer côté webview).
#[tauri::command]
pub fn read_picked_file(state: State<PickedPath>) -> Result<Response, String> {
    let guard = state.0.lock().map_err(|_| "verrou empoisonné".to_string())?;
    let path = guard
        .as_ref()
        .ok_or_else(|| "aucun fichier sélectionné".to_string())?;
    let bytes = std::fs::read(path).map_err(|e| format!("lecture du fichier : {e}"))?;
    Ok(Response::new(bytes))
}

/// Ouvre le dialogue d'enregistrement et écrit le contenu (ex. un PDF produit).
/// Retourne true si enregistré, false si annulé. Le chemin est choisi côté Rust.
#[tauri::command]
pub fn save_pdf(
    app: AppHandle,
    contents: Vec<u8>,
    default_name: String,
) -> Result<bool, String> {
    let picked = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("Document PDF", &["pdf"])
        .blocking_save_file();

    match picked {
        Some(file) => {
            let path = file
                .into_path()
                .map_err(|e| format!("chemin d'enregistrement : {e}"))?;
            std::fs::write(&path, &contents)
                .map_err(|e| format!("écriture du PDF : {e}"))?;
            Ok(true)
        }
        None => Ok(false),
    }
}
