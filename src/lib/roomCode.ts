// Exclude confusing characters: 0, O, 1, I, 5, S
const UNAMBIGUOUS_CHARS = "2346789ABCDEFGHJKLMNPQRTUVWXYZ";

export function generateRoomCode(): string {
  let part1 = "";
  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * UNAMBIGUOUS_CHARS.length);
    part1 += UNAMBIGUOUS_CHARS[randomIndex];
  }

  let part2 = "";
  for (let i = 0; i < 2; i++) {
    const randomIndex = Math.floor(Math.random() * UNAMBIGUOUS_CHARS.length);
    part2 += UNAMBIGUOUS_CHARS[randomIndex];
  }

  return `${part1}-${part2}`;
}

export function formatRoomCodeInput(input: string): string {
  // Strip non-alphanumeric
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (cleaned.length <= 4) {
    return cleaned;
  }
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}`;
}

export function isValidRoomCodeFormat(code: string): boolean {
  const pattern = /^[2346789ABCDEFGHJKLMNPQRTUVWXYZ]{4}-[2346789ABCDEFGHJKLMNPQRTUVWXYZ]{2}$/;
  return pattern.test(code.toUpperCase());
}

export function formatTimeRemaining(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.max(0, seconds) % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

