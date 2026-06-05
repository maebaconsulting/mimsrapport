// Auto-test du pipeline PDF · BUILD NAVIGATEUR.
//
// Rend l'attestation via pdf().toBlob() avec polices par URL, exactement comme en
// production, et vérifie que le résultat commence par %PDF. Permet de valider le
// rendu react-pdf dans les moteurs de webview cibles (WebView2/Chromium côté
// Windows, WKWebView/WebKit côté Mac), point de risque identifié dans les specs.

import { pdf } from "@react-pdf/renderer";
import { registerPdfFonts } from "./pdf-fonts";
import { AttestationPortefeuillePdf } from "./templates/AttestationPortefeuillePdf";

export interface SelfTestResult {
  ok: boolean;
  head: string;
  size: number;
  error?: string;
}

/** Rend un PDF d'exemple (build navigateur) et contrôle l'en-tête %PDF. */
export async function runPdfSelfTest(): Promise<SelfTestResult> {
  try {
    registerPdfFonts();
    const blob = await pdf(
      <AttestationPortefeuillePdf
        sdb={{ nom: "CCA Bourse", code: "CCAB" }}
        client={{
          code: "CT-MNR-A1B2C3",
          nom_complet: "DUPONT Jean",
          type: "PP",
        }}
        numero_compte="PORT-CT-MNR-A1B2C3"
        date_arrete="2026-06-05"
        lignes={[
          {
            libelle: "Obligation État du Gabon 6% 2029",
            quantite: 1500,
            valorisation_xaf: 15_000_000,
          },
          { libelle: "Action CCA Bank", quantite: 320, valorisation_xaf: 4_800_000 },
        ]}
        hash_sha256={"0".repeat(64)}
        timestamp_rfc3161_mock="2026-06-05T10:30:00.000Z"
        ville="Douala"
      />,
    ).toBlob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, 5));
    return { ok: head === "%PDF-", head, size: bytes.length };
  } catch (err) {
    return { ok: false, head: "", size: 0, error: String(err) };
  }
}
