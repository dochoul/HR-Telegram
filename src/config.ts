import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const config = {
  botToken: process.env.BOT_TOKEN || "",
  superadminCode: process.env.SUPERADMIN_CODE || "nabia-super-2026-xxxx",
  dbPath: path.resolve(process.env.DB_PATH || "data/nabia_hr.db"),
  companyName: process.env.COMPANY_NAME || "Nabia",
  workStartTime: process.env.WORK_START_TIME || "09:00",
  workEndTime: process.env.WORK_END_TIME || "18:00",
};

if (!config.botToken) {
  console.error("❌ BOT_TOKEN이 .env 파일에 설정되지 않았습니다.");
  process.exit(1);
}
