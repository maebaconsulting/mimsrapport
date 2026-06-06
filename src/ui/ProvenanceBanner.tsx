// -*- coding: utf-8 -*-
// Bandeau de provenance des données : « Source : <fichier Manar> · importé le
// <date> ». Auto-chargé, donc réutilisable tel quel en tête de Clients, des
// tableaux de bord et de l'accueil. N'affiche rien tant qu'aucun import.

import { useEffect, useState } from "react";
import { getPocketBase } from "../lib/pocketbase";
import { loadProvenance, type Provenance } from "../lib/provenance";
import { useT, useLocale } from "../i18n";
import "./provenance.css";

function fmtDate(iso: string, locale: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ProvenanceBanner({ reloadKey = 0 }: { reloadKey?: number }) {
  const t = useT();
  const locale = useLocale();
  const [prov, setProv] = useState<Provenance | null>(null);

  useEffect(() => {
    let annule = false;
    void (async () => {
      try {
        const pb = await getPocketBase();
        const p = await loadProvenance(pb);
        if (!annule) setProv(p);
      } catch {
        // silencieux : un échec de provenance ne doit pas perturber la vue.
      }
    })();
    return () => {
      annule = true;
    };
  }, [reloadKey]);

  if (!prov) return null;

  return (
    <p className="provenance">
      <svg
        className="provenance__icon"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
      <span className="small-caps">{t("provenance.source")}</span>
      <span className="provenance__file" title={prov.fileName}>
        {prov.fileName}
      </span>
      {prov.importedAt && (
        <>
          <span aria-hidden="true">·</span>
          <span>{t("provenance.imported-on", { date: fmtDate(prov.importedAt, locale) })}</span>
        </>
      )}
    </p>
  );
}
