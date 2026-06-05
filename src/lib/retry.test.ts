// -*- coding: utf-8 -*-
// Tests du réessai sur erreur transitoire.

import { describe, expect, it } from "vitest";
import { isTransient, withRetry } from "./retry";

describe("isTransient", () => {
  it("status 0 (serveur injoignable) est transitoire", () => {
    expect(isTransient({ status: 0 })).toBe(true);
  });
  it("status 5xx est transitoire", () => {
    expect(isTransient({ status: 503 })).toBe(true);
  });
  it("une annulation volontaire n'est pas transitoire", () => {
    expect(isTransient({ status: 0, isAbort: true })).toBe(false);
  });
  it("les 4xx ne sont pas transitoires", () => {
    expect(isTransient({ status: 404 })).toBe(false);
    expect(isTransient({ status: 403 })).toBe(false);
  });
  it("une erreur réseau brute (TypeError) est transitoire", () => {
    expect(isTransient(new TypeError("Failed to fetch"))).toBe(true);
  });
  it("une erreur applicative ordinaire n'est pas transitoire", () => {
    expect(isTransient(new Error("boom"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("réessaie une erreur transitoire puis réussit", async () => {
    let appels = 0;
    const res = await withRetry(
      async () => {
        appels++;
        if (appels < 3) throw { status: 0 };
        return "ok";
      },
      { delayMs: 0 },
    );
    expect(res).toBe("ok");
    expect(appels).toBe(3);
  });

  it("relance immédiatement une erreur non transitoire (pas de réessai)", async () => {
    let appels = 0;
    await expect(
      withRetry(
        async () => {
          appels++;
          throw { status: 404 };
        },
        { delayMs: 0 },
      ),
    ).rejects.toEqual({ status: 404 });
    expect(appels).toBe(1);
  });

  it("relance la dernière erreur après épuisement des tentatives", async () => {
    let appels = 0;
    await expect(
      withRetry(
        async () => {
          appels++;
          throw { status: 0 };
        },
        { tries: 3, delayMs: 0 },
      ),
    ).rejects.toEqual({ status: 0 });
    expect(appels).toBe(3);
  });
});
