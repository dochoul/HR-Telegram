import { Bot, Context } from "grammy";
import { config } from "../config.js";
import { getUserByTelegramId } from "../repositories/user-repo.js";
import { searchByName, salaryStatsByRole, getEmployeeSalary, listEmployees, overallStats } from "../repositories/employee-repo.js";
import { getAttendanceByDate, getLateByDate, getAbsentByDate, getEmployeeMonthlyReport, getTodayStats } from "../repositories/attendance-repo.js";
import { formatSalary, formatSalaryFull, formatDate, formatTime, todayStr, escapeHtml } from "../utils/formatters.js";
import { paginationKeyboard, PAGE_SIZE } from "../utils/keyboards.js";
import { parseHRIntent } from "../services/ai.js";
import { Employee } from "../models/employee.js";

// ─────────────────────────────────────────────
// 동명이인 선택 대기 상태 관리
// ─────────────────────────────────────────────

type PendingAction = "salary" | "report" | "search";

interface PendingSelection {
  action: PendingAction;       // 뭘 조회하려 했는지
  candidates: Employee[];      // 동명이인 후보 목록
}

// 키: telegram_id, 값: 선택 대기 상태
// 사용자가 번호를 입력할 때까지 여기에 저장해둠
const pendingSelection = new Map<number, PendingSelection>();

// 선택지 메시지를 보내고 Map에 상태 저장
async function askToChoose(ctx: Context, telegramId: number, action: PendingAction, candidates: Employee[]) {
  pendingSelection.set(telegramId, { action, candidates });

  let message = `🔍 <b>"${escapeHtml(candidates[0].name)}"이(가) ${candidates.length}명 있습니다. 번호를 입력해주세요.</b>\n\n`;
  candidates.forEach((emp, i) => {
    message += `${i + 1}. ${escapeHtml(emp.name)} — ${emp.role} | ${emp.department}\n`;
  });

  await ctx.reply(message, { parse_mode: "HTML" });
}

// 사용자가 번호를 입력했을 때 처리
// 반환값: true면 처리 완료(다음 로직 실행 불필요), false면 대기 상태 없음
async function handlePendingSelection(ctx: Context, telegramId: number, text: string): Promise<boolean> {
  const pending = pendingSelection.get(telegramId);
  if (!pending) return false;

  const num = parseInt(text.trim());

  // 유효하지 않은 번호 입력 시
  if (isNaN(num) || num < 1 || num > pending.candidates.length) {
    await ctx.reply(
      `1~${pending.candidates.length} 사이의 번호를 입력해주세요.\n취소하려면 /cancel 을 입력하세요.`
    );
    return true;
  }

  const selected = pending.candidates[num - 1];
  pendingSelection.delete(telegramId);

  // 원래 하려던 액션을 선택된 직원으로 실행
  switch (pending.action) {
    case "salary":
      await replySalary(ctx, [selected]);
      break;
    case "report":
      await replyReport(ctx, [selected]);
      break;
    case "search":
      await replySearch(ctx, [selected]);
      break;
  }

  return true;
}

// ─────────────────────────────────────────────
// 실제 응답 생성 함수 (핸들러에서 공유)
// ─────────────────────────────────────────────

async function replySalary(ctx: Context, employees: Employee[]) {
  let message = `💰 <b>연봉 정보</b>\n\n`;
  for (const emp of employees) {
    message += `👤 <b>${escapeHtml(emp.name)}</b>\n`;
    message += `   직급: ${emp.role}\n`;
    message += `   부서: ${emp.department}\n`;
    message += `   연봉: <b>${formatSalaryFull(emp.salary)}</b> (${formatSalary(emp.salary)})\n\n`;
  }
  await ctx.reply(message, { parse_mode: "HTML" });
}

async function replyReport(ctx: Context, employees: Employee[]) {
  let message = `📊 <b>월간 출퇴근 리포트</b> (최근 30일)\n\n`;
  for (const emp of employees.slice(0, 5)) {
    const report = getEmployeeMonthlyReport(emp.id);
    message += `👤 <b>${escapeHtml(emp.name)}</b> (${emp.role})\n`;
    message += `   출근일수: ${report.totalDays}일\n`;
    message += `   지각: ${report.lateDays}회\n`;
    message += `   조퇴: ${report.earlyLeaveDays}회\n`;
    message += `   평균 출근시간: ${report.avgCheckIn ? formatTime(report.avgCheckIn) : "-"}\n\n`;
  }
  await ctx.reply(message, { parse_mode: "HTML" });
}

async function replySearch(ctx: Context, employees: Employee[]) {
  let message = `🔍 <b>직원 정보 (${employees.length}명)</b>\n\n`;
  for (const emp of employees.slice(0, 20)) {
    message += `👤 <b>${escapeHtml(emp.name)}</b>\n`;
    message += `   직급: ${emp.role}\n`;
    message += `   부서: ${emp.department}\n`;
    message += `   연봉: ${formatSalary(emp.salary)}\n`;
    message += `   입사일: ${formatDate(emp.hire_date)}\n`;
    message += `   📞 ${emp.phone || "-"} | 📧 ${emp.email || "-"}\n\n`;
  }
  await ctx.reply(message, { parse_mode: "HTML" });
}

// ─────────────────────────────────────────────
// HR 액션 핸들러
// ─────────────────────────────────────────────

async function handleEmployeeSalary(ctx: Context, telegramId: number, name: string) {
  const employees = getEmployeeSalary(name);
  if (employees.length === 0) {
    await ctx.reply(`🔍 "${escapeHtml(name)}" 검색 결과가 없습니다.`, { parse_mode: "HTML" });
    return;
  }
  // 동명이인 감지: 2명 이상이면 선택지 제시
  if (employees.length > 1) {
    await askToChoose(ctx, telegramId, "salary", employees);
    return;
  }
  await replySalary(ctx, employees);
}

async function handleSalaryStats(ctx: Context) {
  const stats = salaryStatsByRole();
  let message = `💰 <b>직급별 연봉 통계</b>\n\n`;
  for (const s of stats) {
    message += `📊 <b>${s.role}</b> (${s.count}명)\n`;
    message += `   평균: ${formatSalary(s.avg_salary)}\n`;
    message += `   최소: ${formatSalary(s.min_salary)}\n`;
    message += `   최대: ${formatSalary(s.max_salary)}\n\n`;
  }
  await ctx.reply(message, { parse_mode: "HTML" });
}

async function handleLateList(ctx: Context) {
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
}

async function handleAbsentList(ctx: Context) {
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
}

async function handleAttendance(ctx: Context, date?: string) {
  const targetDate = date || todayStr();
  const records = getAttendanceByDate(targetDate);
  const stats = getTodayStats();
  let message = `📋 <b>${formatDate(targetDate)} 출퇴근 현황</b>\n\n`;
  if (!date) {
    message += `출근: ${stats.present}명 | 지각: ${stats.late}명 | 결근: ${stats.absent}명 / 총 ${stats.total}명\n\n`;
  }
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
}

async function handleEmployeeReport(ctx: Context, telegramId: number, name: string) {
  const employees = searchByName(name);
  if (employees.length === 0) {
    await ctx.reply(`🔍 "${escapeHtml(name)}" 검색 결과가 없습니다.`, { parse_mode: "HTML" });
    return;
  }
  if (employees.length > 1) {
    await askToChoose(ctx, telegramId, "report", employees);
    return;
  }
  await replyReport(ctx, employees);
}

async function handleSearchEmployee(ctx: Context, telegramId: number, name: string) {
  const results = searchByName(name);
  if (results.length === 0) {
    await ctx.reply(`🔍 "${escapeHtml(name)}" 검색 결과가 없습니다.`, { parse_mode: "HTML" });
    return;
  }
  if (results.length > 1) {
    await askToChoose(ctx, telegramId, "search", results);
    return;
  }
  await replySearch(ctx, results);
}

async function handleListEmployees(ctx: Context) {
  const { employees, total } = listEmployees(1, PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  let message = `👥 <b>직원 목록</b> (총 ${total}명)\n\n`;
  for (const emp of employees) {
    message += `• <b>${escapeHtml(emp.name)}</b> — ${emp.role} | ${emp.department}\n`;
  }
  const keyboard = paginationKeyboard("emp_page", 1, totalPages);
  await ctx.reply(message, { parse_mode: "HTML", reply_markup: keyboard });
}

async function handleHrStats(ctx: Context) {
  const stats = overallStats();
  const todayS = getTodayStats();
  let message = `📈 <b>${config.companyName} HR 통계</b>\n\n`;
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
}

// ─────────────────────────────────────────────
// 봇 핸들러 등록
// ─────────────────────────────────────────────

export function registerNaturalHandlers(bot: Bot) {
  // /cancel 명령어로 선택 대기 상태 취소
  bot.command("cancel", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (telegramId && pendingSelection.has(telegramId)) {
      pendingSelection.delete(telegramId);
      await ctx.reply("❌ 취소되었습니다.");
    }
  });

  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text;

    if (text.startsWith("/")) return next();

    const telegramId = ctx.from?.id;
    if (!telegramId) return next();

    const user = getUserByTelegramId(telegramId);
    if (!user || (user.role !== "executive" && user.role !== "superadmin")) {
      await ctx.reply("🔒 경영진 인증이 필요합니다. /register 로 인증해주세요.");
      return;
    }

    // 동명이인 선택 대기 중이면 번호 처리 후 종료
    const handled = await handlePendingSelection(ctx, telegramId, text);
    if (handled) return;

    if (!config.anthropicApiKey) {
      await ctx.reply("⚠️ AI 자연어 처리가 설정되지 않았습니다. .env에 ANTHROPIC_API_KEY를 추가해주세요.");
      return;
    }

    await ctx.replyWithChatAction("typing");

    try {
      const action = await parseHRIntent(text);

      switch (action.type) {
        case "get_employee_salary":
          await handleEmployeeSalary(ctx, telegramId, action.name);
          break;
        case "get_salary_stats":
          await handleSalaryStats(ctx);
          break;
        case "get_late_list":
          await handleLateList(ctx);
          break;
        case "get_absent_list":
          await handleAbsentList(ctx);
          break;
        case "get_attendance":
          await handleAttendance(ctx, action.date);
          break;
        case "get_employee_report":
          await handleEmployeeReport(ctx, telegramId, action.name);
          break;
        case "search_employee":
          await handleSearchEmployee(ctx, telegramId, action.name);
          break;
        case "list_employees":
          await handleListEmployees(ctx);
          break;
        case "get_hr_stats":
          await handleHrStats(ctx);
          break;
        default:
          await ctx.reply(
            "🤔 이해하지 못했습니다. 이렇게 말해보세요:\n\n" +
            `• "이예나 언제 입사했어?"\n` +
            `• "김민서 연봉 얼마야?"\n` +
            `• "오늘 지각자 알려줘"\n` +
            `• "결근자 누구야"\n` +
            `• "출퇴근 현황 보여줘"\n` +
            `• "전체 직원 목록"\n` +
            `• "HR 통계 보여줘"\n\n` +
            `/help 로 슬래시 명령어도 확인할 수 있습니다.`
          );
      }
    } catch (err) {
      console.error("AI 처리 오류:", err);
      await ctx.reply("⚠️ AI 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
  });
}
