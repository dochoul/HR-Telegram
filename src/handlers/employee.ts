import { Bot } from "grammy";
import { requireExecutive } from "../middlewares/auth.js";
import { listEmployees, searchByName } from "../repositories/employee-repo.js";
import { formatDate, formatSalary, escapeHtml } from "../utils/formatters.js";
import { paginationKeyboard, PAGE_SIZE } from "../utils/keyboards.js";

export function registerEmployeeHandlers(bot: Bot) {
  bot.command("employees", requireExecutive(async (ctx) => {
    await sendEmployeePage(ctx, 1);
  }));

  bot.callbackQuery(/^emp_page:(\d+)$/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();
    await sendEmployeePage(ctx, page, true);
  });

  bot.command("employee", requireExecutive(async (ctx) => {
    const name = String(ctx.match || "").trim();
    if (!name) {
      await ctx.reply("사용법: /employee [이름]\n예시: /employee 김");
      return;
    }

    const results = searchByName(name);
    if (results.length === 0) {
      await ctx.reply(`🔍 "${escapeHtml(name)}" 검색 결과가 없습니다.`, { parse_mode: "HTML" });
      return;
    }

    let message = `🔍 <b>"${escapeHtml(name)}" 검색 결과 (${results.length}명)</b>\n\n`;
    for (const emp of results.slice(0, 20)) {
      message += `👤 <b>${escapeHtml(emp.name)}</b>\n`;
      message += `   직급: ${emp.role}\n`;
      message += `   부서: ${emp.department}\n`;
      message += `   연봉: ${formatSalary(emp.salary)}\n`;
      message += `   입사일: ${formatDate(emp.hire_date)}\n`;
      message += `   📞 ${emp.phone || "-"} | 📧 ${emp.email || "-"}\n\n`;
    }

    if (results.length > 20) {
      message += `... 외 ${results.length - 20}명`;
    }

    await ctx.reply(message, { parse_mode: "HTML" });
  }));
}

async function sendEmployeePage(ctx: any, page: number, edit = false) {
  const { employees, total } = listEmployees(page, PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  let message = `👥 <b>직원 목록</b> (총 ${total}명)\n\n`;
  for (const emp of employees) {
    message += `• <b>${escapeHtml(emp.name)}</b> — ${emp.role} | ${emp.department}\n`;
  }

  const keyboard = paginationKeyboard("emp_page", page, totalPages);

  if (edit) {
    await ctx.editMessageText(message, { parse_mode: "HTML", reply_markup: keyboard });
  } else {
    await ctx.reply(message, { parse_mode: "HTML", reply_markup: keyboard });
  }
}
