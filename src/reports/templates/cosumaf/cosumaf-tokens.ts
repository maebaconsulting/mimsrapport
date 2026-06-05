// Tokens DS v2.2 pour gabarits PDF COSUMAF. Porté verbatim de MIMS
// lib/integrations/pdf/templates/cosumaf/_shared/cosumaf-tokens.ts. LOCKED.

export const COSUMAF_TOKENS = {
  INK: "#11191F",
  GRAY_50: "#FAFAF9",
  GRAY_200: "#E5E4DC",
  GRAY_600: "#6B7280",
  GRAY_700: "#4A4F4D",
  ACCENT: "#FFED90",
  SUCCESS: "#5C7C5C",
  SUCCESS_SOFT: "#E3EBE2",
  DANGER: "#A65151",
  DANGER_SOFT: "#EFD6D2",
  INFO: "#3A6B7C",
  WATERMARK: "#A65151", // rouge pour RECTIFICATIF
} as const;

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
}

export function fmtNombre(n: number): string {
  return n.toLocaleString("fr-FR");
}

export function fmtXAF(n: number): string {
  // Espace insécable U+00A0 entre nombre et devise.
  return `${fmtNombre(Math.round(n))} XAF`;
}

export function fmtHashCourt(hash: string): string {
  if (!hash || hash.length < 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}
