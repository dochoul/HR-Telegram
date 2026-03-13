import { Bot } from "grammy";
import { requireExecutive } from "../middlewares/auth.js";
import { salaryStatsByRole, getEmployeeSalary } from "../repositories/employee-repo.js";
import { formatSalary, formatSalaryFull, escapeHtml } from "../utils/formatters.js";

export function registerSalaryHandlers(bot: Bot) {
  bot.command("salary", requireExecutive(async (ctx) => {
    const name = String(ctx.match || "").trim();

    if (name) {
      // Individual salary lookup
      const employees = getEmployeeSalary(name);
      if (employees.length === 0) {
        await ctx.reply(`🔍 "${escapeHtml(name)}" 검색 결과가 없습니다.`, { parse_mode: "HTML" });
        return;
      }

      let message = `💰 <b>"${escapeHtml(name)}" 연봉 정보</b>\n\n`;
      for (const emp of employees) {
        message += `👤 <b>${escapeHtml(emp.name)}</b>\n`;
        message += `   직급: ${emp.role}\n`;
        message += `   부서: ${emp.department}\n`;
        message += `   연봉: <b>${formatSalaryFull(emp.salary)}</b> (${formatSalary(emp.salary)})\n\n`;
      }

      await ctx.reply(message, { parse_mode: "HTML" });
      return;
    }

    // Overall salary stats
    const stats = salaryStatsByRole();

    let message = `💰 <b>직급별 연봉 통계</b>\n\n`;
    for (const s of stats) {
      message += `📊 <b>${s.role}</b> (${s.count}명)\n`;
      message += `   평균: ${formatSalary(s.avg_salary)}\n`;
      message += `   최소: ${formatSalary(s.min_salary)}\n`;
      message += `   최대: ${formatSalary(s.max_salary)}\n\n`;
    }

    await ctx.reply(message, { parse_mode: "HTML" });
  }));
}
