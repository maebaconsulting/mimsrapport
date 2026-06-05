import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Environnement Node par défaut ; les tests de rendu PDF (jalon 3) pourront
    // basculer sur jsdom au cas par cas via un commentaire @vitest-environment.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: true,
  },
});
