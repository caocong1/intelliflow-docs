import { DEFAULT_PPT_STYLE_PACK_ID as SHARED_DEFAULT_PPT_STYLE_PACK_ID } from "../../../shared/src/types";

export const DEFAULT_PPT_STYLE_PACK_ID = SHARED_DEFAULT_PPT_STYLE_PACK_ID;

export function normalizePptStylePackId(stylePackId?: string | null): string {
  return stylePackId ?? DEFAULT_PPT_STYLE_PACK_ID;
}

export function isPptExportResultStale(
  selectedStylePackId?: string | null,
  resultStylePackId?: string | null,
): boolean {
  return normalizePptStylePackId(selectedStylePackId) !== normalizePptStylePackId(resultStylePackId);
}
