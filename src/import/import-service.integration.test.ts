// Test d'intégration · import réel dans PocketBase (chemin d'écriture complet :
// upserts, relations, idempotence). Démarre une instance PocketBase éphémère.
//
// Optionnel : ne s'exécute que si PB_INTEGRATION=1 (le binaire PocketBase doit
// être présent dans src-tauri/binaries/). `pnpm test` standard l'ignore.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { connect } from "node:net";
import PocketBase from "pocketbase";
import { LOCAL_AUTH } from "../lib/config";
import { runImport } from "./import-service";

const RUN = process.env.PB_INTEGRATION === "1";
const PORT = 8092;
const BIN = fileURLToPath(
  new URL(
    "../../src-tauri/binaries/pocketbase-aarch64-apple-darwin",
    import.meta.url,
  ),
);
const MIGRATIONS = fileURLToPath(
  new URL("../../pocketbase/pb_migrations", import.meta.url),
);
const DATA_DIR = fileURLToPath(new URL("../../.pb_integration_data", import.meta.url));
const SAMPLE = fileURLToPath(
  new URL(
    "../../samples/manar/ETAT DES INSRUMENTS SAISIS SUR MANAR-ANONYME.xlsx",
    import.meta.url,
  ),
);

function waitForPort(port: number, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() > deadline) reject(new Error("PocketBase timeout"));
        else setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}

describe.runIf(RUN)("import-service · intégration PocketBase", () => {
  let pb: ChildProcess;
  let client: PocketBase;

  beforeAll(async () => {
    rmSync(DATA_DIR, { recursive: true, force: true });
    pb = spawn(
      BIN,
      [
        "serve",
        "--dir",
        DATA_DIR,
        "--migrationsDir",
        MIGRATIONS,
        "--http",
        `127.0.0.1:${PORT}`,
      ],
      { stdio: "ignore" },
    );
    await waitForPort(PORT);
    client = new PocketBase(`http://127.0.0.1:${PORT}`);
    client.autoCancellation(false);
    await client
      .collection("users")
      .authWithPassword(LOCAL_AUTH.email, LOCAL_AUTH.password);
  }, 30000);

  afterAll(() => {
    pb?.kill("SIGKILL");
    rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it("importe l'échantillon et matérialise les entités", async () => {
    const data = new Uint8Array(readFileSync(SAMPLE));
    const result = await runImport(client, {
      fileName: "ANONYME.xlsx",
      data,
    });
    expect(result.status).toBe("REUSSI");
    if (result.status !== "REUSSI") return;

    expect(result.counts.clients).toBe(80);
    expect(result.counts.instruments).toBe(59);
    expect(result.counts.emetteurs).toBe(10);
    expect(result.counts.portefeuilles).toBe(80);

    // Comptages réels en base.
    const clients = await client.collection("clients").getList(1, 1);
    const instruments = await client.collection("instruments").getList(1, 1);
    const positions = await client.collection("positions").getList(1, 1);
    const operations = await client.collection("manar_operations").getList(1, 1);
    expect(clients.totalItems).toBe(80);
    expect(instruments.totalItems).toBe(59);
    expect(positions.totalItems).toBe(129);
    expect(operations.totalItems).toBe(166);
  }, 60000);

  it("refuse un réimport du même fichier (idempotence)", async () => {
    const data = new Uint8Array(readFileSync(SAMPLE));
    const result = await runImport(client, {
      fileName: "ANONYME.xlsx",
      data,
    });
    expect(result.status).toBe("DEJA_IMPORTE");
  }, 30000);

  it("réimporte avec remplacement sans dupliquer les entités", async () => {
    const data = new Uint8Array(readFileSync(SAMPLE));
    const result = await runImport(client, {
      fileName: "ANONYME.xlsx",
      data,
      replace: true,
    });
    expect(result.status).toBe("REUSSI");
    // Upsert : pas de duplication malgré le réimport.
    const clients = await client.collection("clients").getList(1, 1);
    const operations = await client.collection("manar_operations").getList(1, 1);
    expect(clients.totalItems).toBe(80);
    expect(operations.totalItems).toBe(166); // ancien import supprimé en cascade
  }, 60000);
});
