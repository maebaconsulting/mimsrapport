// -*- coding: utf-8 -*-
// Vue « Clients » · données importées présentées en table dense avec bandeau
// d'indicateurs (composant ClientsTable). Inspiration poste de travail MIMS,
// exécutée avec les tokens MoWoBank.

import { ClientsTable } from "./ClientsTable";
import { ProvenanceBanner } from "../ui/ProvenanceBanner";

export function ClientsView({
  onGenerateReport,
}: {
  onGenerateReport?: (clientId: string) => void;
}) {
  return (
    <>
      <header className="app-header">
        <h1 className="app-header__title">Clients</h1>
        <p className="app-header__subtitle">
          Données consolidées issues du dernier import · comptes, positions et
          encours par client
        </p>
      </header>

      <section className="app-content">
        <ProvenanceBanner />
        <ClientsTable showKpis onGenerateReport={onGenerateReport} />
      </section>
    </>
  );
}
