// Commandes d'entrée/sortie binaire pour la webview.
//
// Le dialogue natif (plugin-dialog, côté JS) fournit le chemin choisi par
// l'utilisateur ; ces commandes lisent/écrivent les octets efficacement
// (Response = ArrayBuffer natif côté webview, pas un tableau JSON volumineux).

use std::fs;
use tauri::ipc::Response;

/// Lit le contenu binaire d'un fichier (ex. le .xls Manar sélectionné).
#[tauri::command]
pub fn read_file_bytes(path: String) -> Result<Response, String> {
    let bytes = fs::read(&path).map_err(|e| format!("lecture de « {path} » : {e}"))?;
    Ok(Response::new(bytes))
}

/// Écrit un contenu binaire sur disque (ex. un PDF produit, jalon 3).
#[tauri::command]
pub fn write_file_bytes(path: String, contents: Vec<u8>) -> Result<(), String> {
    fs::write(&path, &contents).map_err(|e| format!("écriture de « {path} » : {e}"))
}
