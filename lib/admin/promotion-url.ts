import "server-only";
import { decryptSensitive } from "./encryption";

export type PromotionUrlField = "cpsUrl" | "appCpsUrl";
type StoredPromotionLinks = { id: string; title: string; cpsUrlEncrypted: string; appCpsUrlEncrypted?: string };

function normalizedUrl(value: string) {
  const url = new URL(value.trim());
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function decryptUrl(value?: string) {
  if (!value) return "";
  try { return normalizedUrl(decryptSensitive(value)); } catch { return ""; }
}

export function findStoredPromotionUrlConflict(rows: StoredPromotionLinks[], value: string, excludeId?: string) {
  const candidate = normalizedUrl(value);
  const match = rows.find(row => row.id !== excludeId && [decryptUrl(row.cpsUrlEncrypted), decryptUrl(row.appCpsUrlEncrypted)].includes(candidate));
  return match ? { id: match.id, title: match.title } : null;
}

export class DuplicatePromotionUrlError extends Error {
  constructor(public readonly field: PromotionUrlField, public readonly dramaTitle: string) {
    super(`Promotion URL already exists on ${dramaTitle}`);
    this.name = "DuplicatePromotionUrlError";
  }
}

export function assertUniquePromotionUrls(rows: StoredPromotionLinks[], values: Partial<Record<PromotionUrlField, string>>, excludeId?: string) {
  for (const field of ["cpsUrl", "appCpsUrl"] as const) {
    const value = values[field];
    if (!value) continue;
    const conflict = findStoredPromotionUrlConflict(rows, value, excludeId);
    if (conflict) throw new DuplicatePromotionUrlError(field, conflict.title);
  }
}
