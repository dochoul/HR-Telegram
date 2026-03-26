import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const config = {
  botToken: process.env.BOT_TOKEN || "",
  superadminCode: process.env.SUPERADMIN_CODE || "nabia-super-2026-xxxx",
  dbPath: path.resolve(process.env.DB_PATH || "data/nabia_hr.db"),
  companyName: process.env.COMPANY_NAME || "Nabia",
  workStartTime: "09:00",       // 출근 시작
  workStartDeadline: "10:00",   // 출근 마감 (이후 지각)
  lunchStart: "12:00",          // 점심 시작
  lunchEnd: "13:00",            // 점심 종료
  workHours: 8,                 // 일일 근무시간 (점심 제외)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
};

if (!config.botToken) {
  console.error("❌ BOT_TOKEN이 .env 파일에 설정되지 않았습니다.");
  process.exit(1);
}
