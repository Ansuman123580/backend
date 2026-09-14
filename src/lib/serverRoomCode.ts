import crypto from "crypto";

// Exclude ambiguous characters: 0, O, 1, I, 5, S
const SECURE_CHARS = "2346789ABCDEFGHJKLMNPQRTUVWXYZ";

export function generateSecureRoomCode(): string {
  let part1 = "";
  for (let i = 0; i < 4; i++) {
    const idx = crypto.randomInt(0, SECURE_CHARS.length);
    part1 += SECURE_CHARS[idx];
  }

  let part2 = "";
  for (let i = 0; i < 2; i++) {
    const idx = crypto.randomInt(0, SECURE_CHARS.length);
    part2 += SECURE_CHARS[idx];
  }

  return `${part1}-${part2}`;
}

