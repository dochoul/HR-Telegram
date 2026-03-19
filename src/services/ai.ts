import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

// Haiku: 빠르고 저렴하며 인텐트 분류 + 자연어 응답 생성에 충분
const MODEL = "claude-haiku-4-5";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return _client;
}

export type HRAction =
  | { type: "get_employee_salary"; name: string }
  | { type: "get_salary_stats" }
  | { type: "get_late_list" }
  | { type: "get_absent_list" }
  | { type: "get_attendance"; date?: string }
  | { type: "get_employee_report"; name: string }
  | { type: "search_employee"; name: string }
  | { type: "list_employees" }
  | { type: "get_hr_stats" }
  | { type: "unknown" };

/**
 * [툴 정의 배열]
 *
 * Claude API의 "tool use" 기능을 활용한 인텐트 분류기.
 *
 * 동작 원리:
 *   1. 사용자 메시지와 함께 이 tools 배열을 Claude에게 전달
 *   2. Claude가 각 툴의 name/description/input_schema를 보고
 *      "어떤 툴을 호출해야 하는가" + "파라미터는 무엇인가"를 판단
 *   3. Claude는 실제로 함수를 실행하지 않고, 호출 명세(tool_use 블록)만 반환
 *   4. 우리 코드가 그 명세를 받아 실제 DB 조회를 실행
 *
 * 각 툴 구조:
 *   name         - 툴 식별자. Claude가 반환하는 tool_use.name과 일치해야 함
 *   description  - ★ 가장 중요. Claude가 "언제 이 툴을 써야 하는가"를 판단하는 근거.
 *                  설명이 명확할수록 정확도가 높아짐
 *   input_schema - 이 툴을 호출할 때 필요한 파라미터 정의 (JSON Schema 형식)
 *                  Claude가 사용자 메시지에서 값을 추출해 채워줌
 */
const tools: Anthropic.Tool[] = [
  {
    // 예: "김민서 연봉", "이예나 월급이 얼마야?", "박지우 급여 알려줘"
    name: "get_employee_salary",
    description: "특정 직원의 연봉/급여/월급을 조회합니다.",
    input_schema: {
      type: "object",
      properties: {
        // Claude가 사용자 메시지에서 직원 이름을 추출해 이 필드에 채워줌
        name: { type: "string", description: "직원 이름 (부분 일치)" },
      },
      required: ["name"], // name이 없으면 이 툴을 호출하지 않음
    },
  },
  {
    // 예: "연봉 통계", "직급별 급여 현황", "평균 연봉이 얼마야?"
    // 특정 직원이 아닌 전체 통계를 물어볼 때 사용
    name: "get_salary_stats",
    description: "전체 직급별 연봉 통계/현황을 조회합니다.",
    // 파라미터 없음 — 조건 없이 전체 통계를 반환
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    // 예: "오늘 지각자", "늦은 사람 누구야?", "지각한 직원 알려줘"
    name: "get_late_list",
    description: "오늘 지각한 직원 목록을 조회합니다.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    // 예: "오늘 결근자", "안 나온 사람", "결근한 직원 누구야?"
    name: "get_absent_list",
    description: "오늘 결근한 직원 목록을 조회합니다.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    // 예: "출퇴근 현황", "오늘 근태", "2026-03-15 출퇴근 알려줘"
    // date가 없으면 오늘 기준으로 조회
    name: "get_attendance",
    description: "출퇴근 현황을 조회합니다. 날짜 미지정 시 오늘 기준.",
    input_schema: {
      type: "object",
      properties: {
        // 선택 파라미터 — 특정 날짜를 언급하면 Claude가 추출해서 채워줌
        // "오늘 현황"처럼 날짜가 없는 경우엔 이 필드가 undefined로 옴
        date: { type: "string", description: "YYYY-MM-DD 형식. 오늘이면 생략." },
      },
      required: [], // date가 없어도 호출 가능
    },
  },
  {
    // 예: "김민서 리포트", "이예나 근태 기록", "박지우 출퇴근 이력"
    // 특정 직원의 한 달치 출퇴근 데이터를 보여줄 때 사용
    name: "get_employee_report",
    description: "특정 직원의 최근 30일 출퇴근 리포트를 조회합니다.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "직원 이름" },
      },
      required: ["name"],
    },
  },
  {
    // 예: "김민서 누구야?", "이예나 정보", "박지우 부서 어디야?", "연락처 알려줘"
    // 연봉/근태가 아닌 직원 프로필 정보를 물어볼 때 사용
    name: "search_employee",
    description: "직원 정보(직급, 부서, 연봉, 입사일, 연락처)를 조회합니다.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "검색할 직원 이름" },
      },
      required: ["name"],
    },
  },
  {
    // 예: "직원 목록", "전체 직원 보여줘", "직원 리스트"
    // 특정 직원이 아닌 전체 목록을 요청할 때 사용
    name: "list_employees",
    description: "전체 직원 목록을 조회합니다.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    // 예: "통계", "HR 현황", "전체 현황 요약해줘"
    // 직원 수, 평균 연봉, 오늘 출퇴근 요약 등 종합 대시보드
    name: "get_hr_stats",
    description: "전체 HR 통계 대시보드(직원 수, 평균 연봉, 출퇴근 요약)를 조회합니다.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

/**
 * DB 조회 결과를 Claude에게 전달해 자연어 응답을 생성.
 *
 * 기존에는 각 핸들러가 정형 포맷(이모지 + HTML)으로 직접 메시지를 조립했으나,
 * 이 함수를 통해 Claude가 데이터를 보고 사람처럼 자연스럽게 답변을 생성함.
 */
export async function generateNaturalResponse(
  userText: string,
  actionType: string,
  data: unknown
): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `당신은 ${config.companyName}의 HR 어시스턴트 봇입니다.
사용자의 질문에 자연스럽게 답변하세요.

가장 중요한 규칙:
- 사용자가 물어본 것만 정확히 답변하세요. 질문하지 않은 정보는 포함하지 마세요.
- 예: "연봉 얼마야?" → 연봉만 답변. 부서, 직급, 연락처 등은 언급하지 않음.
- 예: "오늘 지각자?" → 지각자 이름과 출근 시간만. 부서나 직급은 불필요.

형식 규칙:
- 텔레그램 HTML 형식 사용 (<b>, <i> 태그만 사용)
- 1~2문장으로 간결하게. 목록이 필요하면 최소한으로.
- 금액은 만원 단위 (예: 5,200만원)
- 시간은 HH:MM 형식
- 이모지는 최소한으로`,
    messages: [
      {
        role: "user",
        content: `사용자 질문: ${userText}\n\n조회 결과 (${actionType}):\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  });

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  return textBlock?.text || "응답을 생성할 수 없습니다.";
}

/**
 * 사용자 메시지를 Claude API에 보내 어떤 HR 함수를 호출할지 판단받음.
 *
 * tool_choice: "any" — Claude가 반드시 tools 중 하나를 선택하도록 강제.
 * ("auto"면 Claude가 툴을 안 쓰고 그냥 텍스트로 답할 수도 있음)
 */
export async function parseHRIntent(userText: string): Promise<HRAction> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    // "any": 반드시 툴 중 하나를 골라야 함 (텍스트 응답 불가)
    // → Claude가 tools 배열을 보고 description을 기반으로 가장 적합한 툴을 선택
    tool_choice: { type: "any" },
    tools,
    system: "당신은 HR 봇의 자연어 처리 모듈입니다. 사용자 메시지를 분석해 적절한 HR 함수를 호출하세요.",
    messages: [{ role: "user", content: userText }],
  });

  // Claude 응답에서 tool_use 블록 추출
  // tool_use 블록 = { type: "tool_use", name: "get_employee_salary", input: { name: "김민서" } }
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );

  if (!toolUse) return { type: "unknown" };

  // toolUse.input은 Claude가 input_schema를 보고 사용자 메시지에서 추출한 파라미터
  const input = toolUse.input as Record<string, string>;

  // toolUse.name을 보고 HRAction 타입으로 변환해서 반환
  // natural.ts의 switch문이 이 값을 보고 실제 핸들러 함수를 호출함
  switch (toolUse.name) {
    case "get_employee_salary":
      return { type: "get_employee_salary", name: input.name };
    case "get_salary_stats":
      return { type: "get_salary_stats" };
    case "get_late_list":
      return { type: "get_late_list" };
    case "get_absent_list":
      return { type: "get_absent_list" };
    case "get_attendance":
      return { type: "get_attendance", date: input.date };
    case "get_employee_report":
      return { type: "get_employee_report", name: input.name };
    case "search_employee":
      return { type: "search_employee", name: input.name };
    case "list_employees":
      return { type: "list_employees" };
    case "get_hr_stats":
      return { type: "get_hr_stats" };
    default:
      return { type: "unknown" };
  }
}
