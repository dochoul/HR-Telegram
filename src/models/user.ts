export interface TelegramUser {
  id: number;
  telegram_id: number;
  telegram_username: string | null;
  full_name: string | null;
  role: "pending" | "executive" | "superadmin";
  registered_at: string;
  employee_id: number | null;
}

export interface RegistrationCode {
  id: number;
  code: string;
  role: string;
  used: number;
  created_by: number | null;
  created_at: string;
  used_at: string | null;
  used_by: number | null;
}
