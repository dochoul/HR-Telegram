import { Bot } from "grammy";
import { requireSuperadmin } from "../middlewares/auth.js";
import {
  createInviteCode,
  getAllUsers,
  getUserByTelegramId,
  updateUserRole,
} from "../repositories/user-repo.js";

export function registerAdminHandlers(bot: Bot) {
  bot.command("add_executive", requireSuperadmin(async (ctx) => {
    const telegramId = ctx.from!.id;
    const user = getUserByTelegramId(telegramId)!;
    const code = createInviteCode("executive", user.id);

    await ctx.reply(
      `🎫 <b>경영진 초대 코드가 생성되었습니다</b>\n\n` +
      `코드: <code>${code}</code>\n\n` +
      `이 코드를 경영진에게 전달해주세요.\n` +
      `코드는 1회만 사용 가능합니다.`,
      { parse_mode: "HTML" }
    );
  }));

  bot.command("revoke", requireSuperadmin(async (ctx) => {
    const arg = String(ctx.match || "").trim();
    if (!arg) {
      await ctx.reply("사용법: /revoke [telegram_id]\n예시: /revoke 123456789");
      return;
    }

    const targetId = parseInt(arg);
    if (isNaN(targetId)) {
      await ctx.reply("❌ 유효한 Telegram ID를 입력해주세요.");
      return;
    }

    const target = getUserByTelegramId(targetId);
    if (!target) {
      await ctx.reply("❌ 해당 사용자를 찾을 수 없습니다.");
      return;
    }

    if (target.role === "superadmin") {
      await ctx.reply("❌ 슈퍼어드민의 권한은 회수할 수 없습니다.");
      return;
    }

    updateUserRole(targetId, "pending");
    await ctx.reply(
      `✅ <b>${target.full_name || target.telegram_username || targetId}</b>의 권한이 회수되었습니다.`,
      { parse_mode: "HTML" }
    );
  }));

  bot.command("users", requireSuperadmin(async (ctx) => {
    const users = getAllUsers();

    if (users.length === 0) {
      await ctx.reply("등록된 사용자가 없습니다.");
      return;
    }

    let message = `👥 <b>등록 사용자 목록</b> (${users.length}명)\n\n`;
    for (const u of users) {
      const roleEmoji = u.role === "superadmin" ? "🛡️" : u.role === "executive" ? "👔" : "⏳";
      message += `${roleEmoji} <b>${u.full_name || "-"}</b>\n`;
      message += `   @${u.telegram_username || "-"} | ID: <code>${u.telegram_id}</code>\n`;
      message += `   권한: ${u.role} | 등록: ${u.registered_at.split("T")[0]}\n\n`;
    }

    await ctx.reply(message, { parse_mode: "HTML" });
  }));
}
