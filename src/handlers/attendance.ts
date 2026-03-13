import { Bot } from "grammy";
import { requireExecutive } from "../middlewares/auth.js";
import {
  getAttendanceByDate,
  getLateByDate,
  getAbsentByDate,
  getEmployeeMonthlyReport,
  getTodayStats,
} from "../repositories/attendance-repo.js";
import { searchByName, overallStats } from "../repositories/employee-repo.js";
import { formatTime, formatDate, formatSalary, todayStr, escapeHtml } from "../utils/formatters.js";

export function registerAttendanceHandlers(bot: Bot) {
  bot.command("attendance", requireExecutive(async (ctx) => {
    const arg = String(ctx.match || "").trim();
    const date = arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : todayStr();

    const records = getAttendanceByDate(date);
    const stats = getTodayStats();

    let message = `📋 <b>${formatDate(date)} 출퇴근 현황</b>\n\n`;

    if (date === todayStr()) {
      message += `출근: ${stats.present}명 | 지각: ${stats.late}명 | 결근: ${stats.absent}명 / 총 ${stats.total}명\n\n`;
    }

    if (records.length === 0) {
      message += `해당 날짜의 출퇴근 기록이 없습니다.`;
    } else {
      for (const r of records.slice(0, 30)) {
        const lateTag = r.is_late ? " 🔴지각" : "";
        message += `• ${escapeHtml((r as any).name)} — 출근 ${formatTime(r.check_in_time)} | 퇴근 ${formatTime(r.check_out_time)}${lateTag}\n`;
      }
      if (records.length > 30) {
        message += `\n... 외 ${records.length - 30}명`;
      }
    }

    await ctx.reply(message, { parse_mode: "HTML" });
  }));

  bot.command("late", requireExecutive(async (ctx) => {
    const date = todayStr();
    const lateList = getLateByDate(date);

    let message = `🔴 <b>${formatDate(date)} 지각자 목록</b> (${lateList.length}명)\n\n`;

    if (lateList.length === 0) {
      message += `오늘 지각자가 없습니다. 👏`;
    } else {
      for (const r of lateList) {
        message += `• ${escapeHtml((r as any).name)} — 출근 ${formatTime(r.check_in_time)}\n`;
      }
    }

    await ctx.reply(message, { parse_mode: "HTML" });
  }));

  bot.command("absent", requireExecutive(async (ctx) => {
    const date = todayStr();
    const absentList = getAbsentByDate(date);

    let message = `⚪ <b>${formatDate(date)} 결근자 목록</b> (${absentList.length}명)\n\n`;

    if (absentList.length === 0) {
      message += `오늘 결근자가 없습니다. 👏`;
    } else {
      for (const r of absentList) {
        message += `• ${escapeHtml(r.name)} — ${r.role} | ${r.department}\n`;
      }
    }

    await ctx.reply(message, { parse_mode: "HTML" });
  }));

  bot.command("report", requireExecutive(async (ctx) => {
    const name = String(ctx.match || "").trim();
    if (!name) {
      await ctx.reply("사용법: /report [이름]\n예시: /report 김철수");
      return;
    }

    const employees = searchByName(name);
    if (employees.length === 0) {
      await ctx.reply(`🔍 "${escapeHtml(name)}" 검색 결과가 없습니다.`, { parse_mode: "HTML" });
      return;
    }

    let message = `📊 <b>"${escapeHtml(name)}" 월간 출퇴근 리포트</b> (최근 30일)\n\n`;

    for (const emp of employees.slice(0, 5)) {
      const report = getEmployeeMonthlyReport(emp.id);
      message += `👤 <b>${escapeHtml(emp.name)}</b> (${emp.role})\n`;
      message += `   출근일수: ${report.totalDays}일\n`;
      message += `   지각: ${report.lateDays}회\n`;
      message += `   조퇴: ${report.earlyLeaveDays}회\n`;
      message += `   평균 출근시간: ${report.avgCheckIn ? formatTime(report.avgCheckIn) : "-"}\n\n`;
    }

    await ctx.reply(message, { parse_mode: "HTML" });
  }));

  bot.command("stats", requireExecutive(async (ctx) => {
    const stats = overallStats();
    const todayS = getTodayStats();

    let message = `📈 <b>${escapeHtml("Nabia")} HR 통계</b>\n\n`;
    message += `<b>👥 전체 직원</b>: ${stats.totalEmployees}명\n`;
    message += `<b>💰 평균 연봉</b>: ${formatSalary(stats.avgSalary)}\n\n`;

    message += `<b>📊 직급별 분포</b>\n`;
    for (const r of stats.roleDistribution) {
      message += `   ${r.role}: ${r.count}명\n`;
    }

    message += `\n<b>📋 오늘 출퇴근</b>\n`;
    message += `   출근: ${todayS.present}명\n`;
    message += `   지각: ${todayS.late}명\n`;
    message += `   결근: ${todayS.absent}명\n`;

    await ctx.reply(message, { parse_mode: "HTML" });
  }));
}
