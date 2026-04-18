import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, savedKey] = storedHash.split(":");
  if (!salt || !savedKey) {
    return false;
  }

  const calculated = scryptSync(password, salt, KEY_LENGTH);
  const saved = Buffer.from(savedKey, "hex");

  if (saved.length !== calculated.length) {
    return false;
  }

  return timingSafeEqual(saved, calculated);
}
