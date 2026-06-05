// Validation hors ligne de la licence.
//
// Une licence est un fichier JSON { "payload": "<json>", "signature": "<b64>" }.
// La signature Ed25519 porte sur les octets EXACTS de la chaîne `payload`. La
// clé publique est embarquée ici ; la vérification est purement locale (aucun
// appel réseau, cohérent avec le mono-poste hors ligne). YAGNI : pas de serveur
// de licences, pas d'activation en ligne en v1.

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

/// Clé publique Ed25519 (32 octets) de l'émetteur de licences (Maeba Consulting).
/// La clé privée correspondante n'est jamais distribuée avec l'application.
const LICENSE_PUBLIC_KEY: [u8; 32] = [
    15, 50, 206, 211, 113, 244, 92, 206, 19, 69, 92, 82, 67, 3, 116, 48, 150, 125, 86, 223, 190,
    236, 169, 237, 4, 65, 102, 231, 226, 132, 251, 251,
];

#[derive(Debug, Deserialize)]
struct LicenseFile {
    payload: String,
    signature: String,
}

#[derive(Debug, Deserialize)]
struct LicensePayload {
    sdb: String,
    sdb_code: String,
    expires_at: String, // ISO YYYY-MM-DD
    #[allow(dead_code)]
    scope: String,
}

/// État de licence renvoyé au frontend.
#[derive(Debug, Serialize)]
pub struct LicenseStatus {
    pub valid: bool,
    pub reason: Option<String>,
    pub sdb: Option<String>,
    pub sdb_code: Option<String>,
    pub expires_at: Option<String>,
}

impl LicenseStatus {
    fn invalid(reason: &str) -> Self {
        LicenseStatus {
            valid: false,
            reason: Some(reason.to_string()),
            sdb: None,
            sdb_code: None,
            expires_at: None,
        }
    }
}

fn license_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| format!("dossier de données : {e}"))?
        .join("license.json"))
}

/// Date du jour au format YYYY-MM-DD (heure système, hors ligne).
fn today() -> String {
    // Évite une dépendance date : on formate depuis l'horloge système.
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Conversion epoch -> date civile (algorithme de Howard Hinnant).
    let days = (secs / 86_400) as i64;
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{:04}-{:02}-{:02}", y, m, d)
}

/// Vérifie une licence (signature + expiration) à partir du contenu du fichier.
fn verify(content: &str) -> LicenseStatus {
    let file: LicenseFile = match serde_json::from_str(content) {
        Ok(f) => f,
        Err(_) => return LicenseStatus::invalid("Fichier de licence illisible"),
    };

    let sig_bytes = match BASE64.decode(file.signature.as_bytes()) {
        Ok(b) => b,
        Err(_) => return LicenseStatus::invalid("Signature illisible"),
    };
    let signature = match <[u8; 64]>::try_from(sig_bytes.as_slice()) {
        Ok(arr) => Signature::from_bytes(&arr),
        Err(_) => return LicenseStatus::invalid("Signature de taille invalide"),
    };

    let verifying_key = match VerifyingKey::from_bytes(&LICENSE_PUBLIC_KEY) {
        Ok(k) => k,
        Err(_) => return LicenseStatus::invalid("Clé publique invalide"),
    };

    if verifying_key
        .verify_strict(file.payload.as_bytes(), &signature)
        .is_err()
    {
        return LicenseStatus::invalid("Signature de licence non valide");
    }

    let payload: LicensePayload = match serde_json::from_str(&file.payload) {
        Ok(p) => p,
        Err(_) => return LicenseStatus::invalid("Contenu de licence illisible"),
    };

    // Expiration (comparaison lexicographique sur YYYY-MM-DD).
    if payload.expires_at < today() {
        return LicenseStatus {
            valid: false,
            reason: Some(format!("Licence expirée le {}", payload.expires_at)),
            sdb: Some(payload.sdb),
            sdb_code: Some(payload.sdb_code),
            expires_at: Some(payload.expires_at),
        };
    }

    LicenseStatus {
        valid: true,
        reason: None,
        sdb: Some(payload.sdb),
        sdb_code: Some(payload.sdb_code),
        expires_at: Some(payload.expires_at),
    }
}

/// Commande : état de la licence installée (lue du dossier de données).
#[tauri::command]
pub fn get_license_status(app: AppHandle) -> LicenseStatus {
    let path = match license_path(&app) {
        Ok(p) => p,
        Err(e) => return LicenseStatus::invalid(&e),
    };
    let status = match std::fs::read_to_string(&path) {
        Ok(content) => verify(&content),
        Err(_) => LicenseStatus::invalid("Aucune licence installée"),
    };
    println!(
        "[license] {} · {}",
        if status.valid { "VALIDE" } else { "BLOQUÉE" },
        status
            .reason
            .clone()
            .unwrap_or_else(|| status.sdb_code.clone().unwrap_or_default())
    );
    status
}

/// Commande : ouvre un dialogue pour choisir un fichier de licence, le vérifie ;
/// si valide, l'installe (copie dans le dossier de données) et retourne l'état.
///
/// `async` requis : `blocking_pick_file()` interbloque sur le thread principal
/// (cf. `fileio::pick_manar_file`).
#[tauri::command]
pub async fn install_license(app: AppHandle) -> Result<LicenseStatus, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Licence", &["license", "json"])
        .blocking_pick_file();

    let Some(file) = picked else {
        return Err("Sélection annulée".to_string());
    };
    let path = file
        .into_path()
        .map_err(|e| format!("chemin de la licence : {e}"))?;
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("lecture de la licence : {e}"))?;

    let status = verify(&content);
    if status.valid {
        let dest = license_path(&app)?;
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("création du dossier de données : {e}"))?;
        }
        std::fs::write(&dest, &content)
            .map_err(|e| format!("installation de la licence : {e}"))?;
    }
    Ok(status)
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID: &str = include_str!("../tests/fixtures/valid.license");
    const EXPIRED: &str = include_str!("../tests/fixtures/expired.license");

    #[test]
    fn accepte_une_licence_valide() {
        let status = verify(VALID);
        assert!(status.valid, "raison : {:?}", status.reason);
        assert_eq!(status.sdb_code.as_deref(), Some("CCAB"));
        assert_eq!(status.expires_at.as_deref(), Some("2099-12-31"));
    }

    #[test]
    fn refuse_une_licence_expiree() {
        let status = verify(EXPIRED);
        assert!(!status.valid);
        assert!(status.reason.unwrap().contains("expirée"));
    }

    #[test]
    fn refuse_une_licence_falsifiee() {
        // Altère le payload signé : la signature ne correspond plus.
        let tampered = VALID.replace("CCA Bourse", "EVIL Bourse");
        let status = verify(&tampered);
        assert!(!status.valid);
        assert!(status.reason.unwrap().contains("Signature"));
    }

    #[test]
    fn refuse_un_fichier_illisible() {
        assert!(!verify("pas un json").valid);
    }
}
