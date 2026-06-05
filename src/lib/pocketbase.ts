// Client PocketBase partagé + auto-login mono-poste.
//
// Le client est créé une fois l'URL résolue (config-driven). L'auto-login utilise
// l'utilisateur local amorcé par migration. Le frontend réessaie la connexion si
// le sidecar n'est pas encore prêt (le Rust attend déjà la disponibilité, mais on
// double la robustesse côté webview).

import PocketBase from "pocketbase";
import { LOCAL_AUTH, resolvePocketBaseUrl } from "./config";

let clientPromise: Promise<PocketBase> | null = null;

async function createClient(): Promise<PocketBase> {
  const url = await resolvePocketBaseUrl();
  const pb = new PocketBase(url);
  // Mono-poste : pas d'auto-annulation des requêtes concurrentes identiques.
  pb.autoCancellation(false);
  // Ne jamais faire confiance à un token persisté (localStorage) : il peut
  // référencer un utilisateur d'une base précédente (token non expiré mais
  // périmé côté serveur → relations cassées). Identifiants fixes mono-poste :
  // on (ré)authentifie toujours proprement.
  pb.authStore.clear();
  await ensureAuth(pb);
  return pb;
}

/** Authentifie le client comme utilisateur local, avec quelques tentatives. */
async function ensureAuth(pb: PocketBase, attempts = 10): Promise<void> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await pb
        .collection("users")
        .authWithPassword(LOCAL_AUTH.email, LOCAL_AUTH.password);
      return;
    } catch (err) {
      lastError = err;
      // Le sidecar n'est peut-être pas encore prêt : petite attente puis réessai.
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(
    `Échec de l'authentification locale après ${attempts} tentatives : ${String(lastError)}`,
  );
}

/** Retourne le client PocketBase partagé (créé et authentifié à la demande). */
export function getPocketBase(): Promise<PocketBase> {
  if (!clientPromise) {
    clientPromise = createClient().catch((err) => {
      // Réinitialiser pour permettre une nouvelle tentative au prochain appel.
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}
