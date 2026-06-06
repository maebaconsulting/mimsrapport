// -*- coding: utf-8 -*-
// Vue « Clients » · données importées présentées en table dense avec bandeau
// d'indicateurs (composant ClientsTable). Le nom d'un client ouvre sa fiche de
// contact (coordonnées saisies manuellement, conservées hors import).

import { useState } from "react";
import { ClientsTable } from "./ClientsTable";
import { ClientContactPanel } from "./ClientContactPanel";
import { ProvenanceBanner } from "../ui/ProvenanceBanner";
import { useT } from "../i18n";

export function ClientsView({
  onGenerateReport,
}: {
  onGenerateReport?: (clientId: string) => void;
}) {
  const t = useT();
  const [fiche, setFiche] = useState<{ id: string; nom: string } | null>(null);
  // Incrémenté après enregistrement d'un contact pour rafraîchir l'indicateur.
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <>
      <header className="app-header">
        <h1 className="app-header__title">{t("clients.titre")}</h1>
        <p className="app-header__subtitle">{t("clients.sous-titre")}</p>
      </header>

      <section className="app-content">
        <ProvenanceBanner />
        <ClientsTable
          showKpis
          reloadKey={reloadKey}
          onGenerateReport={onGenerateReport}
          onOpenClient={(id, nom) => setFiche({ id, nom })}
        />
      </section>

      {fiche && (
        <ClientContactPanel
          clientId={fiche.id}
          clientName={fiche.nom}
          onClose={() => setFiche(null)}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
    </>
  );
}
