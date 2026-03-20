import { Bot } from "grammy";
import { config } from "../config.js";
import { getUserByTelegramId } from "../repositories/user-repo.js";
import { chat, clearConversation } from "../services/ai.js";

export function registerNaturalHandlers(bot: Bot) {
  // /clear — 대화 히스토리 초기화
  bot.command("clear", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (telegramId) {
      clearConversation(telegramId);
      await ctx.reply("🔄 대화가 초기화되었습니다.");
    }
  });

  // 모든 텍스트 메시지 → AI 채팅
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text;

    // 슬래시 커맨드는 다른 핸들러로 넘김
    if (text.startsWith("/")) return next();

    const telegramId = ctx.from?.id;
    if (!telegramId) return next();

    // 권한 확인
    const user = getUserByTelegramId(telegramId);
    if (!user || (user.role !== "executive" && user.role !== "superadmin")) {
      await ctx.reply("🔒 경영진 인증이 필요합니다. /register 로 인증해주세요.");
      return;
    }

    if (!config.anthropicApiKey) {
      await ctx.reply("⚠️ AI가 설정되지 않았습니다. .env에 ANTHROPIC_API_KEY를 추가해주세요.");
      return;
    }

    console.log(`[natural] 메시지 수신: "${text}" (user: ${telegramId})`);
    await ctx.replyWithChatAction("typing");

    try {
      const response = await chat(telegramId, text);
      console.log(`[natural] 응답 생성 완료`);
      await ctx.reply(response, { parse_mode: "HTML" });
    } catch (err) {
      console.error("[natural] AI 처리 오류:", err);
      await ctx.reply("⚠️ AI 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
  });
}
