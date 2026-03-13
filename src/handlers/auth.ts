import { Bot, Context } from "grammy";
import { config } from "../config.js";
import {
  getUserByTelegramId,
  registerUser,
  getCodeByValue,
  markCodeUsed,
  updateUserRole,
} from "../repositories/user-repo.js";

const pendingRegistrations = new Map<number, boolean>();

export function registerAuthHandlers(bot: Bot) {
  bot.command("start", async (ctx) => {
    await ctx.reply(
      `🏢 <b>${config.companyName} HR Bot</b>에 오신 것을 환영합니다!\n\n` +
      `이 봇은 ${config.companyName} 경영진 전용 HR 데이터 조회 시스템입니다.\n\n` +
      `📋 <b>사용 방법:</b>\n` +
      `1. /register — 초대 코드로 인증\n` +
      `2. 인증 후 HR 데이터 조회 가능\n\n` +
      `/help 명령어로 전체 명령어를 확인하세요.`,
      { parse_mode: "HTML" }
    );
  });

  bot.command("help", async (ctx) => {
    const telegramId = ctx.from?.id;
    const user = telegramId ? getUserByTelegramId(telegramId) : undefined;

    let message = `📖 <b>${config.companyName} HR Bot 명령어</b>\n\n`;
    message += `<b>🔓 공개 명령어</b>\n`;
    message += `/start — 봇 소개\n`;
    message += `/help — 명령어 목록\n`;
    message += `/register — 초대 코드 인증\n`;

    if (user && (user.role === "executive" || user.role === "superadmin")) {
      message += `\n<b>👔 경영진 명령어</b>\n`;
      message += `/employees — 직원 목록\n`;
      message += `/employee [이름] — 직원 검색\n`;
      message += `/salary — 직급별 연봉 통계\n`;
      message += `/salary [이름] — 개인 연봉 조회\n`;
      message += `/attendance — 오늘 출퇴근 현황\n`;
      message += `/attendance [날짜] — 특정 날짜 현황\n`;
      message += `/late — 오늘 지각자\n`;
      message += `/absent — 오늘 결근자\n`;
      message += `/report [이름] — 월간 출퇴근 리포트\n`;
      message += `/stats — 전체 HR 통계\n`;
    }

    if (user && user.role === "superadmin") {
      message += `\n<b>🛡️ 슈퍼어드민 명령어</b>\n`;
      message += `/add_executive — 경영진 초대 코드 생성\n`;
      message += `/revoke [telegram_id] — 권한 회수\n`;
      message += `/users — 등록 사용자 목록\n`;
    }

    await ctx.reply(message, { parse_mode: "HTML" });
  });

  bot.command("register", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const existing = getUserByTelegramId(telegramId);
    if (existing && existing.role !== "pending") {
      await ctx.reply(`✅ 이미 ${existing.role}로 등록되어 있습니다.`);
      return;
    }

    const args = String(ctx.match || "").trim();
    if (!args) {
      pendingRegistrations.set(telegramId, true);
      await ctx.reply(
        "🔑 초대 코드를 입력해주세요.\n취소하려면 /cancel 을 입력하세요."
      );
      return;
    }

    await processRegistration(ctx, args);
  });

  bot.command("cancel", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (telegramId && pendingRegistrations.has(telegramId)) {
      pendingRegistrations.delete(telegramId);
      await ctx.reply("❌ 등록이 취소되었습니다.");
    }
  });

  // Handle text input for registration code
  bot.on("message:text", async (ctx, next) => {
    const telegramId = ctx.from?.id;
    if (!telegramId || !pendingRegistrations.has(telegramId)) {
      return next();
    }

    pendingRegistrations.delete(telegramId);
    await processRegistration(ctx, ctx.message.text.trim());
  });
}

async function processRegistration(ctx: Context, code: string) {
  const telegramId = ctx.from!.id;
  const username = ctx.from!.username || null;
  const fullName = [ctx.from!.first_name, ctx.from!.last_name].filter(Boolean).join(" ");

  // Check superadmin code
  if (code === config.superadminCode) {
    const existing = getUserByTelegramId(telegramId);
    if (existing) {
      updateUserRole(telegramId, "superadmin");
    } else {
      registerUser(telegramId, username, fullName, "superadmin");
    }
    await ctx.reply(
      "🛡️ <b>슈퍼어드민</b>으로 등록되었습니다!\n/help 명령어로 사용 가능한 명령어를 확인하세요.",
      { parse_mode: "HTML" }
    );
    return;
  }

  // Check invite code
  const inviteCode = getCodeByValue(code);
  if (!inviteCode) {
    await ctx.reply("❌ 유효하지 않은 코드입니다. 다시 확인해주세요.");
    return;
  }

  const existing = getUserByTelegramId(telegramId);
  let user;
  if (existing) {
    updateUserRole(telegramId, inviteCode.role);
    user = getUserByTelegramId(telegramId)!;
  } else {
    user = registerUser(telegramId, username, fullName, inviteCode.role);
  }

  markCodeUsed(inviteCode.id, user.id);

  await ctx.reply(
    `✅ <b>${inviteCode.role}</b>로 등록되었습니다!\n/help 명령어로 사용 가능한 명령어를 확인하세요.`,
    { parse_mode: "HTML" }
  );
}
