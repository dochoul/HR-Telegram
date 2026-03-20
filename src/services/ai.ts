import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { searchByName, salaryStatsByRole, listEmployees, overallStats } from "../repositories/employee-repo.js";
import { getAttendanceByDate, getLateByDate, getAbsentByDate, getEmployeeMonthlyReport, getTodayStats } from "../repositories/attendance-repo.js";
import { todayStr } from "../utils/formatters.js";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 1024;
const MAX_HISTORY = 20; // 사용자당 최근 N개 메시지만 유지

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return _client;
}

// ─────────────────────────────────────────────
// 도구 정의 — Claude가 직접 호출하고 결과를 받아 답변 생성
// ─────────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: "search_employee",
    description: "직원을 이름으로 검색합니다. 직원 정보(이름, 직급, 부서, 연봉, 입사일, 연락처)를 반환합니다.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "검색할 직원 이름 (부분 일치)" },
      },
      required: ["name"],
    },
  },
  {
    name: "get_salary_stats",
    description: "전체 직급별 연봉 통계(평균/최소/최대/인원수)를 조회합니다.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_late_list",
    description: "특정 날짜에 지각한 직원 목록을 조회합니다.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD 형식. 생략 시 오늘." },
      },
      required: [],
    },
  },
  {
    name: "get_absent_list",
    description: "특정 날짜에 결근한 직원 목록을 조회합니다.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD 형식. 생략 시 오늘." },
      },
      required: [],
    },
  },
  {
    name: "get_attendance",
    description: "특정 날짜의 전체 출퇴근 현황과 통계를 조회합니다.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD 형식. 생략 시 오늘." },
      },
      required: [],
    },
  },
  {
    name: "get_employee_report",
    description: "특정 직원의 최근 30일 출퇴근 리포트(출근일수, 지각, 조퇴, 평균출근시간)를 조회합니다.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "직원 이름" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_employees",
    description: "전체 직원 목록을 페이지 단위로 조회합니다.",
    input_schema: {
      type: "object",
      properties: {
        page: { type: "number", description: "페이지 번호 (1부터). 기본값 1." },
      },
      required: [],
    },
  },
  {
    name: "get_hr_stats",
    description: "전체 HR 통계 대시보드(직원 수, 평균 연봉, 직급 분포, 오늘 출퇴근 요약)를 조회합니다.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

// ─────────────────────────────────────────────
// 도구 실행 — Claude의 tool_use 요청을 받아 실제 DB 조회
// ─────────────────────────────────────────────

function executeTool(name: string, input: Record<string, any>): string {
  switch (name) {
    case "search_employee": {
      const employees = searchByName(input.name);
      if (employees.length === 0) return JSON.stringify({ result: "검색 결과 없음", query: input.name });
      return JSON.stringify(employees.map(e => ({
        id: e.id, name: e.name, role: e.role, department: e.department,
        salary: e.salary, hire_date: e.hire_date, phone: e.phone, email: e.email,
      })));
    }
    case "get_salary_stats":
      return JSON.stringify(salaryStatsByRole());
    case "get_late_list": {
      const date = input.date || todayStr();
      const list = getLateByDate(date);
      return JSON.stringify({
        date, count: list.length,
        list: list.map(r => ({ name: (r as any).name, check_in_time: r.check_in_time })),
      });
    }
    case "get_absent_list": {
      const date = input.date || todayStr();
      const list = getAbsentByDate(date);
      return JSON.stringify({
        date, count: list.length,
        list: list.map(r => ({ name: r.name, role: r.role, department: r.department })),
      });
    }
    case "get_attendance": {
      const date = input.date || todayStr();
      const records = getAttendanceByDate(date);
      const stats = getTodayStats();
      return JSON.stringify({
        date,
        stats: { present: stats.present, late: stats.late, absent: stats.absent, total: stats.total },
        totalRecords: records.length,
        records: records.slice(0, 30).map(r => ({
          name: (r as any).name, check_in_time: r.check_in_time,
          check_out_time: r.check_out_time, is_late: r.is_late,
        })),
      });
    }
    case "get_employee_report": {
      const employees = searchByName(input.name);
      if (employees.length === 0) return JSON.stringify({ result: "검색 결과 없음", query: input.name });
      return JSON.stringify(employees.map(emp => {
        const report = getEmployeeMonthlyReport(emp.id);
        return { name: emp.name, role: emp.role, department: emp.department, ...report };
      }));
    }
    case "list_employees": {
      const page = input.page || 1;
      const { employees, total } = listEmployees(page, 10);
      return JSON.stringify({
        page, totalPages: Math.ceil(total / 10), total,
        employees: employees.map(e => ({ name: e.name, role: e.role, department: e.department })),
      });
    }
    case "get_hr_stats": {
      const stats = overallStats();
      const todayS = getTodayStats();
      return JSON.stringify({
        totalEmployees: stats.totalEmployees, avgSalary: stats.avgSalary,
        roleDistribution: stats.roleDistribution,
        today: { present: todayS.present, late: todayS.late, absent: todayS.absent },
      });
    }
    default:
      return JSON.stringify({ error: "알 수 없는 도구" });
  }
}

// ─────────────────────────────────────────────
// 대화 히스토리 관리
// ─────────────────────────────────────────────

export type MessageParam = Anthropic.MessageParam;

const conversations = new Map<number, MessageParam[]>();

export function clearConversation(telegramId: number): void {
  conversations.delete(telegramId);
}

// ─────────────────────────────────────────────
// 채팅 — 에이전트 루프 (tool_use → tool_result 반복)
// ─────────────────────────────────────────────

export async function chat(telegramId: number, userText: string): Promise<string> {
  const client = getClient();

  if (!conversations.has(telegramId)) {
    conversations.set(telegramId, []);
  }
  const history = conversations.get(telegramId)!;

  // 사용자 메시지 추가
  history.push({ role: "user", content: userText });

  // 히스토리 제한
  while (history.length > MAX_HISTORY) {
    history.shift();
  }

  // API 호출용 메시지 복사 (tool_use 루프에서 중간 메시지 추가)
  const messages: MessageParam[] = [...history];

  const systemPrompt = `당신은 ${config.companyName}의 HR 어시스턴트 봇입니다.
경영진이 텔레그램으로 직원 정보, 급여, 출퇴근 현황 등을 물어봅니다.

규칙:
- 도구를 사용해 데이터를 조회한 뒤, 자연스러운 한국어로 답변하세요.
- 질문한 내용만 간결하게 답변하세요. 불필요한 정보는 포함하지 마세요.
- 텔레그램 HTML 형식 사용 (<b>, <i> 태그만)
- 금액은 만원 단위 (예: 5,200만원), 시간은 HH:MM 형식
- 동명이인이 여러 명이면 목록을 보여주고 누구인지 물어보세요.
- HR과 관련 없는 질문에는 정중히 HR 관련 질문만 가능하다고 안내하세요.
- 오늘 날짜: ${todayStr()}`;

  // 에이전트 루프: Claude가 텍스트 응답을 줄 때까지 tool_use 반복
  const MAX_ITERATIONS = 5;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools,
      messages,
    });

    // tool_use가 있으면 실행하고 결과를 돌려줌
    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = executeTool(block.name, block.input as Record<string, any>);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // 텍스트 응답 추출
    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    const reply = textBlock?.text || "응답을 생성할 수 없습니다.";

    // 대화 히스토리에는 최종 텍스트만 저장 (중간 tool 호출은 제외)
    history.push({ role: "assistant", content: reply });

    while (history.length > MAX_HISTORY) {
      history.shift();
    }

    return reply;
  }

  return "처리 시간이 초과되었습니다. 다시 시도해주세요.";
}
