import { Bot, Context } from "grammy";
import { getUserByTelegramId } from "../repositories/user-repo.js";
import { searchByName, salaryStatsByRole, getEmployeeSalary, listEmployees, overallStats, findEmployeeInText } from "../repositories/employee-repo.js";
import { getAttendanceByDate, getLateByDate, getAbsentByDate, getEmployeeMonthlyReport, getTodayStats } from "../repositories/attendance-repo.js";
import { formatSalary, formatSalaryFull, formatDate, formatTime, todayStr, escapeHtml } from "../utils/formatters.js";
import { paginationKeyboard, PAGE_SIZE } from "../utils/keyboards.js";

type Intent = "salary" | "hire_date" | "department" | "contact" | "role" | "general";

function detectIntent(text: string): Intent {
  if (/연봉|급여|월급|얼마.*받|salary/i.test(text)) return "salary";
  if (/입사|언제.*들어|합류|입사일/.test(text)) return "hire_date";
  if (/부서|어디.*소속|팀/.test(text)) return "department";
  if (/연락처|전화|번호|이메일|메일/.test(text)) return "contact";
  if (/직급|직책|포지션|역할/.test(text)) return "role";
  return "general";
}

interface Route {
  patterns: RegExp[];
  handler: (ctx: Context, match: RegExpMatchArray) => Promise<void>;
  requireAuth: boolean;
}

const routes: Route[] = [
  // 연봉 (개인)
  {
    patterns: [
      /(.{1,10})\s*연봉/,
      /(.{1,10})\s*급여/,
      /(.{1,10})\s*월급/,
      /연봉\s*(.{1,10})/,
      /급여\s*(.{1,10})/,
    ],
    requireAuth: true,
    handler: async (ctx, match) => {
      const name = match[1].trim();
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
    },
  },

  // 연봉 통계
  {
    patterns: [/연봉\s*통계/, /급여\s*통계/, /연봉\s*현황/],
    requireAuth: true,
    handler: async (ctx) => {
      const stats = salaryStatsByRole();
      let message = `💰 <b>직급별 연봉 통계</b>\n\n`;
      for (const s of stats) {
        message += `📊 <b>${s.role}</b> (${s.count}명)\n`;
        message += `   평균: ${formatSalary(s.avg_salary)}\n`;
        message += `   최소: ${formatSalary(s.min_salary)}\n`;
        message += `   최대: ${formatSalary(s.max_salary)}\n\n`;
      }
      await ctx.reply(message, { parse_mode: "HTML" });
    },
  },

  // 지각자
  {
    patterns: [/지각/, /늦은\s*사람/, /지각자/],
    requireAuth: true,
    handler: async (ctx) => {
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
    },
  },

  // 결근자
  {
    patterns: [/결근/, /안\s*나온\s*사람/, /결근자/],
    requireAuth: true,
    handler: async (ctx) => {
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
    },
  },

  // 출퇴근 현황 (특정 날짜)
  {
    patterns: [
      /(\d{4}-\d{2}-\d{2})\s*출퇴근/,
      /출퇴근\s*(\d{4}-\d{2}-\d{2})/,
    ],
    requireAuth: true,
    handler: async (ctx, match) => {
      const date = match[1];
      const records = getAttendanceByDate(date);
      let message = `📋 <b>${formatDate(date)} 출퇴근 현황</b>\n\n`;
      if (records.length === 0) {
        message += `해당 날짜의 출퇴근 기록이 없습니다.`;
      } else {
        for (const r of records.slice(0, 30)) {
          const lateTag = r.is_late ? " 🔴지각" : "";
          message += `• ${escapeHtml((r as any).name)} — 출근 ${formatTime(r.check_in_time)} | 퇴근 ${formatTime(r.check_out_time)}${lateTag}\n`;
        }
        if (records.length > 30) message += `\n... 외 ${records.length - 30}명`;
      }
      await ctx.reply(message, { parse_mode: "HTML" });
    },
  },

  // 출퇴근 현황 (오늘)
  {
    patterns: [/출퇴근/, /출근\s*현황/, /근태/],
    requireAuth: true,
    handler: async (ctx) => {
      const date = todayStr();
      const records = getAttendanceByDate(date);
      const stats = getTodayStats();
      let message = `📋 <b>${formatDate(date)} 출퇴근 현황</b>\n\n`;
      message += `출근: ${stats.present}명 | 지각: ${stats.late}명 | 결근: ${stats.absent}명 / 총 ${stats.total}명\n\n`;
      if (records.length === 0) {
        message += `해당 날짜의 출퇴근 기록이 없습니다.`;
      } else {
        for (const r of records.slice(0, 30)) {
          const lateTag = r.is_late ? " 🔴지각" : "";
          message += `• ${escapeHtml((r as any).name)} — 출근 ${formatTime(r.check_in_time)} | 퇴근 ${formatTime(r.check_out_time)}${lateTag}\n`;
        }
        if (records.length > 30) message += `\n... 외 ${records.length - 30}명`;
      }
      await ctx.reply(message, { parse_mode: "HTML" });
    },
  },

  // 개인 리포트
  {
    patterns: [
      /(.{1,10})\s*리포트/,
      /(.{1,10})\s*출퇴근\s*기록/,
      /(.{1,10})\s*근태/,
    ],
    requireAuth: true,
    handler: async (ctx, match) => {
      const name = match[1].trim();
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
    },
  },

  // 직원 검색
  {
    patterns: [
      /(.{1,10})\s*정보/,
      /(.{1,10})\s*누구/,
      /(.{1,10})\s*검색/,
      /(.{1,10})\s*찾아/,
    ],
    requireAuth: true,
    handler: async (ctx, match) => {
      const name = match[1].trim();
      if (name.length < 1) return;
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
      await ctx.reply(message, { parse_mode: "HTML" });
    },
  },

  // 직원 목록
  {
    patterns: [/직원\s*목록/, /전체\s*직원/, /직원\s*리스트/],
    requireAuth: true,
    handler: async (ctx) => {
      const { employees, total } = listEmployees(1, PAGE_SIZE);
      const totalPages = Math.ceil(total / PAGE_SIZE);
      let message = `👥 <b>직원 목록</b> (총 ${total}명)\n\n`;
      for (const emp of employees) {
        message += `• <b>${escapeHtml(emp.name)}</b> — ${emp.role} | ${emp.department}\n`;
      }
      const keyboard = paginationKeyboard("emp_page", 1, totalPages);
      await ctx.reply(message, { parse_mode: "HTML", reply_markup: keyboard });
    },
  },

  // 통계
  {
    patterns: [/통계/, /현황\s*요약/, /HR\s*현황/i],
    requireAuth: true,
    handler: async (ctx) => {
      const stats = overallStats();
      const todayS = getTodayStats();
      let message = `📈 <b>Nabia HR 통계</b>\n\n`;
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
    },
  },
];

export function registerNaturalHandlers(bot: Bot) {
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text;

    // Skip commands
    if (text.startsWith("/")) return next();

    const telegramId = ctx.from?.id;
    if (!telegramId) return next();

    for (const route of routes) {
      for (const pattern of route.patterns) {
        const match = text.match(pattern);
        if (match) {
          if (route.requireAuth) {
            const user = getUserByTelegramId(telegramId);
            if (!user || (user.role !== "executive" && user.role !== "superadmin")) {
              await ctx.reply("🔒 경영진 인증이 필요합니다. /register 로 인증해주세요.");
              return;
            }
          }
          await route.handler(ctx, match);
          return;
        }
      }
    }

    // Fallback: try to find employee name in the text
    const user = getUserByTelegramId(telegramId);
    if (user && (user.role === "executive" || user.role === "superadmin")) {
      const results = findEmployeeInText(text);
      if (results.length > 0) {
        const intent = detectIntent(text);
        let message = "";

        for (const emp of results.slice(0, 10)) {
          switch (intent) {
            case "salary":
              message += `💰 <b>${escapeHtml(emp.name)}</b>의 연봉: <b>${formatSalaryFull(emp.salary)}</b> (${formatSalary(emp.salary)})\n`;
              break;
            case "hire_date":
              message += `📅 <b>${escapeHtml(emp.name)}</b>의 입사일: <b>${formatDate(emp.hire_date)}</b>\n`;
              break;
            case "department":
              message += `🏢 <b>${escapeHtml(emp.name)}</b>의 부서: <b>${emp.department}</b> (${emp.role})\n`;
              break;
            case "contact":
              message += `📇 <b>${escapeHtml(emp.name)}</b>\n`;
              message += `   📞 ${emp.phone || "-"}\n`;
              message += `   📧 ${emp.email || "-"}\n\n`;
              break;
            case "role":
              message += `👤 <b>${escapeHtml(emp.name)}</b>의 직급: <b>${emp.role}</b>\n`;
              break;
            default:
              message += `👤 <b>${escapeHtml(emp.name)}</b>\n`;
              message += `   직급: ${emp.role}\n`;
              message += `   부서: ${emp.department}\n`;
              message += `   연봉: ${formatSalary(emp.salary)}\n`;
              message += `   입사일: ${formatDate(emp.hire_date)}\n`;
              message += `   📞 ${emp.phone || "-"} | 📧 ${emp.email || "-"}\n\n`;
              break;
          }
        }

        await ctx.reply(message, { parse_mode: "HTML" });
        return;
      }
    }

    // No match at all
    await ctx.reply(
      "🤔 이해하지 못했습니다. 이렇게 말해보세요:\n\n" +
      `• "이예나 언제 입사했어?"\n` +
      `• "김민서 연봉"\n` +
      `• "오늘 지각자"\n` +
      `• "결근자"\n` +
      `• "출퇴근 현황"\n` +
      `• "직원 목록"\n` +
      `• "통계"\n\n` +
      `직원 이름이 포함되면 자동으로 정보를 보여드립니다.\n` +
      `/help 로 전체 명령어를 확인할 수도 있습니다.`
    );
  });
}
