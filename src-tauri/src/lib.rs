// Coque Tauri · point d'entrée du noyau Rust.
//
// Le Rust ne contient aucune logique métier (ni parsing, ni agrégation, ni
// rendu PDF). Il orchestrera, aux jalons suivants : le cycle de vie du sidecar
// PocketBase, les dialogues fichiers natifs et la validation de licence.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l'application Tauri");
}
