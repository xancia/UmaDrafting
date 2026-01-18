/**
 * Icon Mappings - Maps Global cardIds to Japanese icon cardIds
 *
 * Use this when the Global version cardId doesn't match the Japanese icon filename.
 * Key: Global cardId from data
 * Value: Japanese cardId for icon filename
 */
export const cardIdToIconMapping: Record<number, number> = {
  // Special Week
  100102: 100130, // Global 100102 → JP 100130 icon

  // Maruzensky
  100402: 100430, // Hot☆Summer Night

  // Oguri Cap
  100602: 100646, // Ashen Miracle

  // El Condor Pasa
  101402: 101416, // Kukulkan Warrior

  // Symboli Rudolf
  101702: 101743, // Archer by Moonlight

  // Air Groove
  101802: 101826, // Quercus Civilis

  // Mayano Top Gun
  102402: 102426, // Sunlight Bouquet

  // Gold City
  104002: 104043, // Autumn Cosmos

  // Super Creek
  104502: 104540, // Chiffon-Wrapped Mummy

  // Matikanefukukitaru
  105602: 105623, // Lucky Tidings

  // Grass Wonder
  101102: 101116, // Saintly Jade Cleric

  // Biwa Hayahide
  102302: 102346, // Rouge Caroler

  // Rice Shower
  103002: 103040, // Vampire Makeover

  // Add more mappings as needed
  // Format: globalCardId: japaneseIconCardId,
};

/**
 * Gets the correct icon cardId for a given global cardId
 */
export function getIconCardId(globalCardId: number): number {
  return cardIdToIconMapping[globalCardId] ?? globalCardId;
}
