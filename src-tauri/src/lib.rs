// Coque Tauri · point d'entrée du noyau Rust.
//
// Le Rust ne contient aucune logique métier (ni parsing, ni agrégation, ni
// rendu PDF). Il orchestre le cycle de vie du sidecar PocketBase, exposera les
// dialogues fichiers natifs et la validation de licence aux jalons suivants.

mod sidecar;

use tauri::RunEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![sidecar::get_pocketbase_url])
        .setup(|app| {
            // Démarrage du sidecar PocketBase avant le chargement effectif de
            // l'UI. En cas d'échec, on log et on laisse l'app afficher l'erreur
            // (le frontend réessaie la connexion).
            if let Err(err) = sidecar::start(app.handle()) {
                eprintln!("[reporting-manar] échec du démarrage de PocketBase : {err}");
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("erreur au lancement de l'application Tauri");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            sidecar::stop(app_handle);
        }
    });
}
