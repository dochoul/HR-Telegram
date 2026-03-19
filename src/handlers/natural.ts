import { Bot, Context } from "grammy";
import { config } from "../config.js";
import { getUserByTelegramId } from "../repositories/user-repo.js";
import { searchByName, salaryStatsByRole, getEmployeeSalary, listEmployees, overallStats } from "../repositories/employee-repo.js";
import { getAttendanceByDate, getLateByDate, getAbsentByDate, getEmployeeMonthlyReport, getTodayStats } from "../repositories/attendance-repo.js";
import { todayStr, escapeHtml } from "../utils/formatters.js";
import { paginationKeyboard, PAGE_SIZE } from "../utils/keyboards.js";
import { parseHRIntent, generateNaturalResponse } from "../services/ai.js";
import { Employee } from "../models/employee.js";

// ─────────────────────────────────────────────
// 동명이인 선택 대기 상태 관리
// ─────────────────────────────────────────────

type PendingAction = "salary" | "report" | "search";

interface PendingSelection {
  action: PendingAction;       // 뭘 조회하려 했는지
  candidates: Employee[];      // 동명이인 후보 목록
  userText: string;            // 원래 사용자 질문 (자연어 응답 생성용)
}

// 키: telegram_id, 값: 선택 대기 상태
// 사용자가 번호를 입력할 때까지 여기에 저장해둠
const pendingSelection = new Map<number, PendingSelection>();

// 선택지 메시지를 보내고 Map에 상태 저장
async function askToChoose(ctx: Context, telegramId: number, action: PendingAction, candidates: Employee[], userText: string) {
  pendingSelection.set(telegramId, { action, candidates, userText });

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
      await replySalary(ctx, [selected], pending.userText);
      break;
    case "report":
      await replyReport(ctx, [selected], pending.userText);
      break;
    case "search":
      await replySearch(ctx, [selected], pending.userText);
      break;
  }

  return true;
}

// ─────────────────────────────────────────────
// 실제 응답 생성 함수 (핸들러에서 공유)
// ─────────────────────────────────────────────

async function replySalary(ctx: Context, employees: Employee[], userText: string) {
  const data = employees.map(emp => ({
    name: emp.name, role: emp.role, department: emp.department, salary: emp.salary,
  }));
  await ctx.replyWithChatAction("typing");
  const response = await generateNaturalResponse(userText, "employee_salary", data);
  await ctx.reply(response, { parse_mode: "HTML" });
}

async function replyReport(ctx: Context, employees: Employee[], userText: string) {
  const data = employees.slice(0, 5).map(emp => {
    const report = getEmployeeMonthlyReport(emp.id);
    return {
      name: emp.name, role: emp.role,
      totalDays: report.totalDays, lateDays: report.lateDays,
      earlyLeaveDays: report.earlyLeaveDays, avgCheckIn: report.avgCheckIn,
    };
  });
  await ctx.replyWithChatAction("typing");
  const response = await generateNaturalResponse(userText, "employee_report", data);
  await ctx.reply(response, { parse_mode: "HTML" });
}

async function replySearch(ctx: Context, employees: Employee[], userText: string) {
  const data = employees.slice(0, 20).map(emp => ({
    name: emp.name, role: emp.role, department: emp.department,
    salary: emp.salary, hire_date: emp.hire_date, phone: emp.phone, email: emp.email,
  }));
  await ctx.replyWithChatAction("typing");
  const response = await generateNaturalResponse(userText, "employee_search", data);
  await ctx.reply(response, { parse_mode: "HTML" });
}

// ─────────────────────────────────────────────
// HR 액션 핸들러
// ─────────────────────────────────────────────

async function handleEmployeeSalary(ctx: Context, telegramId: number, name: string, userText: string) {
  const employees = getEmployeeSalary(name);
  if (employees.length === 0) {
    await ctx.reply(`🔍 "${escapeHtml(name)}" 검색 결과가 없습니다.`, { parse_mode: "HTML" });
    return;
  }
  if (employees.length > 1) {
    await askToChoose(ctx, telegramId, "salary", employees, userText);
    return;
  }
  await replySalary(ctx, employees, userText);
}

async function handleSalaryStats(ctx: Context, userText: string) {
  const stats = salaryStatsByRole();
  const data = stats.map(s => ({
    role: s.role, count: s.count,
    avg_salary: s.avg_salary, min_salary: s.min_salary, max_salary: s.max_salary,
  }));
  const response = await generateNaturalResponse(userText, "salary_stats", data);
  await ctx.reply(response, { parse_mode: "HTML" });
}

async function handleLateList(ctx: Context, userText: string) {
  const date = todayStr();
  const lateList = getLateByDate(date);
  const data = {
    date,
    count: lateList.length,
    list: lateList.map(r => ({ name: (r as any).name, check_in_time: r.check_in_time })),
  };
  const response = await generateNaturalResponse(userText, "late_list", data);
  await ctx.reply(response, { parse_mode: "HTML" });
}

async function handleAbsentList(ctx: Context, userText: string) {
  const date = todayStr();
  const absentList = getAbsentByDate(date);
  const data = {
    date,
    count: absentList.length,
    list: absentList.map(r => ({ name: r.name, role: r.role, department: r.department })),
  };
  const response = await generateNaturalResponse(userText, "absent_list", data);
  await ctx.reply(response, { parse_mode: "HTML" });
}

async function handleAttendance(ctx: Context, userText: string, date?: string) {
  const targetDate = date || todayStr();
  const records = getAttendanceByDate(targetDate);
  const stats = getTodayStats();
  const data = {
    date: targetDate,
    stats: !date ? { present: stats.present, late: stats.late, absent: stats.absent, total: stats.total } : undefined,
    totalRecords: records.length,
    records: records.slice(0, 30).map(r => ({
      name: (r as any).name, check_in_time: r.check_in_time,
      check_out_time: r.check_out_time, is_late: r.is_late,
    })),
  };
  const response = await generateNaturalResponse(userText, "attendance", data);
  await ctx.reply(response, { parse_mode: "HTML" });
}

async function handleEmployeeReport(ctx: Context, telegramId: number, name: string, userText: string) {
  const employees = searchByName(name);
  if (employees.length === 0) {
    await ctx.reply(`🔍 "${escapeHtml(name)}" 검색 결과가 없습니다.`, { parse_mode: "HTML" });
    return;
  }
  if (employees.length > 1) {
    await askToChoose(ctx, telegramId, "report", employees, userText);
    return;
  }
  await replyReport(ctx, employees, userText);
}

async function handleSearchEmployee(ctx: Context, telegramId: number, name: string, userText: string) {
  const results = searchByName(name);
  if (results.length === 0) {
    await ctx.reply(`🔍 "${escapeHtml(name)}" 검색 결과가 없습니다.`, { parse_mode: "HTML" });
    return;
  }
  if (results.length > 1) {
    await askToChoose(ctx, telegramId, "search", results, userText);
    return;
  }
  await replySearch(ctx, results, userText);
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

async function handleHrStats(ctx: Context, userText: string) {
  const stats = overallStats();
  const todayS = getTodayStats();
  const data = {
    companyName: config.companyName,
    totalEmployees: stats.totalEmployees,
    avgSalary: stats.avgSalary,
    roleDistribution: stats.roleDistribution,
    today: { present: todayS.present, late: todayS.late, absent: todayS.absent },
  };
  const response = await generateNaturalResponse(userText, "hr_stats", data);
  await ctx.reply(response, { parse_mode: "HTML" });
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
          await handleEmployeeSalary(ctx, telegramId, action.name, text);
          break;
        case "get_salary_stats":
          await handleSalaryStats(ctx, text);
          break;
        case "get_late_list":
          await handleLateList(ctx, text);
          break;
        case "get_absent_list":
          await handleAbsentList(ctx, text);
          break;
        case "get_attendance":
          await handleAttendance(ctx, text, action.date);
          break;
        case "get_employee_report":
          await handleEmployeeReport(ctx, telegramId, action.name, text);
          break;
        case "search_employee":
          await handleSearchEmployee(ctx, telegramId, action.name, text);
          break;
        case "list_employees":
          await handleListEmployees(ctx);
          break;
        case "get_hr_stats":
          await handleHrStats(ctx, text);
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
