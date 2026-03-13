import { Context, NextFunction } from "grammy";
import { getUserByTelegramId } from "../repositories/user-repo.js";

export function requireExecutive(handler: (ctx: Context) => Promise<void>) {
  return async (ctx: Context) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const user = getUserByTelegramId(telegramId);
    if (!user || (user.role !== "executive" && user.role !== "superadmin")) {
      await ctx.reply(
        "🔒 이 명령어는 경영진만 사용할 수 있습니다.\n" +
        "/register 명령어로 초대 코드를 입력하여 인증해주세요."
      );
      return;
    }

    return handler(ctx);
  };
}

export function requireSuperadmin(handler: (ctx: Context) => Promise<void>) {
  return async (ctx: Context) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const user = getUserByTelegramId(telegramId);
    if (!user || user.role !== "superadmin") {
      await ctx.reply("🔒 이 명령어는 슈퍼어드민만 사용할 수 있습니다.");
      return;
    }

    return handler(ctx);
  };
}
