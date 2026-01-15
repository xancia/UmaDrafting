import type { UmaMusume } from "../types";

/**
 * Extracts base Uma name without variation suffix
 * Examples:
 * - "Symboli Rudolf (Festival)" → "Symboli Rudolf"
 * - "Special Week (Summer)" → "Special Week"
 * - "Gold City" → "Gold City"
 * @param fullName - The full Uma Musume name
 * @returns Base name without parenthetical suffix
 */
export function extractBaseUmaName(fullName: string): string {
  // Remove anything in parentheses at the end of the name
  return fullName.replace(/\s*\([^)]+\)\s*$/, "").trim();
}

/**
 * Finds all Uma variations with the same base name
 * @param baseOrFullName - Base name or full name of Uma
 * @param umaList - List of Uma to search through
 * @returns Array of Uma with matching base names
 */
export function findUmaVariations(
  baseOrFullName: string,
  umaList: UmaMusume[]
): UmaMusume[] {
  const baseName = extractBaseUmaName(baseOrFullName);
  
  return umaList.filter((uma) => {
    const umaBaseName = extractBaseUmaName(uma.name);
    return umaBaseName === baseName;
  });
}
