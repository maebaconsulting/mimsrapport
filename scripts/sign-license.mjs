// Outil d'émission de licence (dev / émetteur). Signe un payload avec la clé
// privée Ed25519 et produit un fichier de licence vérifiable par l'application.
//
// Usage :
//   node scripts/sign-license.mjs --sdb "CCA Bourse" --code CCAB \
//     --expires 2027-12-31 --out cca-bourse.license
//
// La clé privée (scripts/license-private-key.pem) n'est jamais distribuée.

import { readFileSync, writeFileSync } from "node:fs";
import { sign, createPrivateKey } from "node:crypto";
import { fileURLToPath } from "node:url";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const sdb = arg("sdb", "Société de bourse");
const code = arg("code", "SDB");
const expires = arg("expires", "2027-12-31");
const scope = arg("scope", "reporting-manar");
const out = arg("out", "reporting-manar.license");

if (!/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
  console.error("--expires doit être au format YYYY-MM-DD");
  process.exit(1);
}

const keyPath = fileURLToPath(
  new URL("./license-private-key.pem", import.meta.url),
);
const privateKey = createPrivateKey(readFileSync(keyPath));

// Le payload est une CHAÎNE JSON compacte : la signature porte sur ses octets
// exacts (évite toute ambiguïté de canonicalisation côté vérificateur Rust).
const today = new Date().toISOString().slice(0, 10);
const payload = JSON.stringify({
  sdb,
  sdb_code: code,
  expires_at: expires,
  scope,
  issued_at: today,
});

// Ed25519 : algorithme null (la clé porte l'algorithme).
const signature = sign(null, Buffer.from(payload, "utf8"), privateKey);

const license = JSON.stringify(
  { payload, signature: signature.toString("base64") },
  null,
  2,
);

writeFileSync(out, license);
console.log(`Licence émise : ${out}`);
console.log(`  SDB        : ${sdb} (${code})`);
console.log(`  Expiration : ${expires}`);
