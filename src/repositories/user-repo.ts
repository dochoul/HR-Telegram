import { getDb } from "../database/connection.js";
import type { TelegramUser, RegistrationCode } from "../models/user.js";

export function getUserByTelegramId(telegramId: number): TelegramUser | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM telegram_users WHERE telegram_id = ?").get(telegramId) as TelegramUser | undefined;
}

export function registerUser(
  telegramId: number,
  username: string | null,
  fullName: string | null,
  role: string
): TelegramUser {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO telegram_users (telegram_id, telegram_username, full_name, role, registered_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(telegramId, username, fullName, role, now);
  return getUserByTelegramId(telegramId)!;
}

export function updateUserRole(telegramId: number, role: string): void {
  const db = getDb();
  db.prepare("UPDATE telegram_users SET role = ? WHERE telegram_id = ?").run(role, telegramId);
}

export function getAllUsers(): TelegramUser[] {
  const db = getDb();
  return db.prepare("SELECT * FROM telegram_users ORDER BY registered_at DESC").all() as TelegramUser[];
}

export function getCodeByValue(code: string): RegistrationCode | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM registration_codes WHERE code = ? AND used = 0").get(code) as RegistrationCode | undefined;
}

export function markCodeUsed(codeId: number, userId: number): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE registration_codes SET used = 1, used_at = ?, used_by = ? WHERE id = ?").run(now, userId, codeId);
}

export function createInviteCode(role: string, createdBy: number): string {
  const db = getDb();
  const code = `nabia-${role.substring(0, 4)}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO registration_codes (code, role, created_by, created_at) VALUES (?, ?, ?, ?)"
  ).run(code, role, createdBy, now);
  return code;
}
