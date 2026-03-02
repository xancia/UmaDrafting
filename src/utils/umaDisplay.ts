import { getEntryByOutfitId, getReleaseIndex } from "../data/releaseorder";

type UmaLike = {
  id: string | number;
  name: string;
  title?: string;
};

export function getUmaVariantNickname(umaId: string | number): string | undefined {
  const entry = getEntryByOutfitId(String(umaId));
  const variant = entry?.variant?.trim();
  return variant ? variant : undefined;
}

export function formatUmaName(uma: UmaLike): string {
  const nickname = getUmaVariantNickname(uma.id) || uma.title?.trim();
  return nickname ? `${nickname} ${uma.name}` : uma.name;
}

export function formatUmaNameFromParts(name: string, nickname?: string): string {
  const trimmed = nickname?.trim();
  return trimmed ? `${trimmed} ${name}` : name;
}

export function compareUmasByRelease(a: UmaLike, b: UmaLike): number {
  const aIdx = getReleaseIndex(String(a.id));
  const bIdx = getReleaseIndex(String(b.id));

  if (aIdx === -1 && bIdx === -1) {
    return a.name.localeCompare(b.name);
  }
  if (aIdx === -1) return 1;
  if (bIdx === -1) return -1;
  return aIdx - bIdx;
}
