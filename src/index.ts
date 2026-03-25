// 회사 SSL inspection 우회 (자체 서명 인증서 허용)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { Bot } from "grammy";
import { config } from "./config.js";
import { initDb, closeDb } from "./database/connection.js";
import { seedDatabase } from "./database/seed.js";
import { registerAuthHandlers } from "./handlers/auth.js";
import { registerEmployeeHandlers } from "./handlers/employee.js";
import { registerSalaryHandlers } from "./handlers/salary.js";
import { registerAttendanceHandlers } from "./handlers/attendance.js";
import { registerAdminHandlers } from "./handlers/admin.js";
import { registerNaturalHandlers } from "./handlers/natural.js";

async function main() {
  // Initialize database and seed data
  console.log("🗄️ 데이터베이스 초기화 중...");
  initDb();
  seedDatabase();

  // Create bot
  const bot = new Bot(config.botToken);

  // Register handlers (order matters: auth text handler must be last)
  registerEmployeeHandlers(bot);
  registerSalaryHandlers(bot);
  registerAttendanceHandlers(bot);
  registerAdminHandlers(bot);
  registerAuthHandlers(bot);  // Registration text handler
  registerNaturalHandlers(bot);  // Must be last — catches all other text

  // Error handling
  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n🛑 봇을 종료합니다...");
    bot.stop();
    closeDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start polling
  console.log(`🚀 ${config.companyName} HR Bot이 시작되었습니다!`);
  await bot.start();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
