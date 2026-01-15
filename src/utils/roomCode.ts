import { ROOM_CODE_CONFIG } from "../config/multiplayer";

/**
 * Generates a random room code for multiplayer sessions
 * 
 * Room codes are 6 characters long using uppercase letters and numbers,
 * excluding ambiguous characters (I, O, 0, 1) for easier sharing.
 * 
 * @returns A unique 6-character room code
 * 
 * @example
 * const code = generateRoomCode(); // "AB3K7P"
 */
export function generateRoomCode(): string {
  const { LENGTH, CHARSET } = ROOM_CODE_CONFIG;
  let code = "";
  
  for (let i = 0; i < LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * CHARSET.length);
    code += CHARSET[randomIndex];
  }
  
  return code;
}

/**
 * Validates a room code format
 * 
 * Checks if the room code matches the expected format:
 * - Exactly 6 characters
 * - Only uppercase letters and numbers
 * 
 * @param code - The room code to validate
 * @returns true if valid, false otherwise
 * 
 * @example
 * validateRoomCode("AB3K7P"); // true
 * validateRoomCode("abc123"); // false (lowercase)
 * validateRoomCode("ABCD"); // false (too short)
 * validateRoomCode("ABCD12!"); // false (invalid character)
 */
export function validateRoomCode(code: string): boolean {
  if (!code || typeof code !== "string") {
    return false;
  }
  
  return ROOM_CODE_CONFIG.VALIDATION_PATTERN.test(code);
}

/**
 * Normalizes a room code by converting to uppercase and trimming whitespace
 * 
 * Useful for user input where they might enter lowercase or have extra spaces.
 * Does not validate - use validateRoomCode() for validation.
 * 
 * @param code - The room code to normalize
 * @returns Normalized room code
 * 
 * @example
 * normalizeRoomCode("  ab3k7p  "); // "AB3K7P"
 */
export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Formats a room code for display with visual grouping
 * 
 * @param code - The room code to format
 * @returns Formatted room code (e.g., "AB3-K7P")
 * 
 * @example
 * formatRoomCode("AB3K7P"); // "AB3-K7P"
 */
export function formatRoomCode(code: string): string {
  if (code.length !== ROOM_CODE_CONFIG.LENGTH) {
    return code;
  }
  
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}
