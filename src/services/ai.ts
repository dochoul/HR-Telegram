import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { searchByName, salaryStatsByRole, salaryStatsByDepartment, listEmployees, filterEmployees, overallStats } from "../repositories/employee-repo.js";
import { getAttendanceByDate, getLateByDate, getAbsentByDate, getEmployeeMonthlyReport, getTodayStats } from "../repositories/attendance-repo.js";
import { getEvaluationsByEmployee, getEvaluationsByYear, getEvaluationStatsByYear, getEvaluationsByGrade } from "../repositories/evaluation-repo.js";
import { getDb } from "../database/connection.js";
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
    description: "직원을 이름으로 검색합니다. 직원 정보(이름, 직급, 부서, 연봉, 입사일, 생일, 연락처)를 반환합니다.",
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
    name: "get_salary_stats_by_department",
    description: "부서별 연봉 통계(평균/최소/최대/인원수)를 조회합니다.",
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
    description: "전체 직원 목록을 조회합니다. page_size를 크게 하면 한 번에 많이 볼 수 있습니다.",
    input_schema: {
      type: "object",
      properties: {
        page: { type: "number", description: "페이지 번호 (1부터). 기본값 1." },
        page_size: { type: "number", description: "한 페이지당 인원수. 기본값 10, 최대 200." },
      },
      required: [],
    },
  },
  {
    name: "filter_employees",
    description: "직원을 직급/부서로 필터링하고 연봉/입사일/이름 기준으로 정렬하여 조회합니다. 예: 개발자 중 연봉 TOP 5, 모바일팀에서 가장 먼저 입사한 사람, 연봉이 가장 낮은 직원 등.",
    input_schema: {
      type: "object",
      properties: {
        role: { type: "string", description: "직급 필터: 개발자, 기획자, 디자이너, 이사 및 경영진, 부장" },
        department: { type: "string", description: "부서 필터: CTO실, PM팀, UI팀, UX팀, 경영지원실, 데이터팀, 모바일팀, 백엔드팀, 브랜드팀, 서비스기획팀, 인프라팀, 전략기획팀, 전략실, 프론트엔드팀" },
        sort_by: { type: "string", description: "정렬 기준: salary, hire_date, name. 기본값 salary" },
        order: { type: "string", description: "정렬 방향: DESC(내림차순), ASC(오름차순). 기본값 DESC" },
        limit: { type: "number", description: "결과 수 제한. 기본값 10, 최대 200" },
      },
      required: [],
    },
  },
  {
    name: "get_hr_stats",
    description: "전체 HR 통계 대시보드(직원 수, 평균 연봉, 직급 분포, 오늘 출퇴근 요약)를 조회합니다.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_birthdays_by_month",
    description: "특정 월에 생일인 직원 목록을 조회합니다. 이번 달, 다음 달 생일자 등을 확인할 수 있습니다.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "number", description: "조회할 월 (1~12). 생략 시 이번 달." },
      },
      required: [],
    },
  },
  {
    name: "get_employee_evaluations",
    description: "특정 직원의 연도별 평가 등급(A~E) 이력을 조회합니다.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "직원 이름" },
      },
      required: ["name"],
    },
  },
  {
    name: "get_evaluations_by_year",
    description: "특정 연도의 전체 평가 결과를 조회합니다. 등급별 인원수 통계와 직원 목록을 반환합니다.",
    input_schema: {
      type: "object",
      properties: {
        year: { type: "number", description: "조회할 연도 (예: 2025)" },
        grade: { type: "string", description: "특정 등급만 필터링 (A, B, C, D, E). 생략 시 전체." },
      },
      required: ["year"],
    },
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
        salary: e.salary, hire_date: e.hire_date, birth_date: e.birth_date, phone: e.phone, email: e.email,
      })));
    }
    case "get_salary_stats":
      return JSON.stringify(salaryStatsByRole());
    case "get_salary_stats_by_department":
      return JSON.stringify(salaryStatsByDepartment());
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
      const pageSize = Math.min(input.page_size || 10, 200);
      const { employees, total } = listEmployees(page, pageSize);
      return JSON.stringify({
        page, pageSize, totalPages: Math.ceil(total / pageSize), total,
        employees: employees.map(e => ({ name: e.name, role: e.role, department: e.department })),
      });
    }
    case "filter_employees": {
      const employees = filterEmployees({
        role: input.role,
        department: input.department,
        sort_by: input.sort_by,
        order: input.order,
        limit: input.limit,
      });
      return JSON.stringify({
        count: employees.length,
        filters: { role: input.role, department: input.department, sort_by: input.sort_by || "salary", order: input.order || "DESC" },
        employees: employees.map(e => ({
          name: e.name, role: e.role, department: e.department,
          salary: e.salary, hire_date: e.hire_date,
        })),
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
    case "get_birthdays_by_month": {
      const month = input.month || new Date().getMonth() + 1;
      const mm = String(month).padStart(2, "0");
      const db = getDb();
      const rows = db.prepare(`
        SELECT name, role, department, birth_date
        FROM employees
        WHERE is_active = 1 AND substr(birth_date, 6, 2) = ?
        ORDER BY substr(birth_date, 9, 2) ASC
      `).all(mm) as any[];
      return JSON.stringify({
        month,
        count: rows.length,
        employees: rows.map((e: any) => ({
          name: e.name, role: e.role, department: e.department,
          birth_date: e.birth_date,
        })),
      });
    }
    case "get_employee_evaluations": {
      const employees = searchByName(input.name);
      if (employees.length === 0) return JSON.stringify({ result: "검색 결과 없음", query: input.name });
      return JSON.stringify(employees.map(emp => {
        const evals = getEvaluationsByEmployee(emp.id);
        return {
          name: emp.name, role: emp.role, department: emp.department,
          evaluations: evals.map(ev => ({ year: ev.year, grade: ev.grade })),
        };
      }));
    }
    case "get_evaluations_by_year": {
      const year = input.year;
      const stats = getEvaluationStatsByYear(year);
      if (input.grade) {
        const list = getEvaluationsByGrade(year, input.grade.toUpperCase());
        return JSON.stringify({
          year, grade: input.grade.toUpperCase(), count: list.length,
          stats,
          employees: list.map((e: any) => ({ name: e.name, role: e.role, department: e.department })),
        });
      }
      const all = getEvaluationsByYear(year);
      return JSON.stringify({
        year, totalCount: all.length, stats,
        employees: all.slice(0, 50).map((e: any) => ({ name: e.name, role: e.role, department: e.department, grade: e.grade })),
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
- 사용자 입력에 오타가 있을 수 있습니다. "아번달"="이번달", "담달"="다음달" 등 문맥으로 판단하세요.
- 오늘 날짜: ${todayStr()} (이번 달 = ${new Date().getMonth() + 1}월)`;

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
