import { faker } from "@faker-js/faker/locale/ko";
import { getDb, initDb } from "./connection.js";

const ROLES = [
  { role: "개발자", count: 40, salaryMin: 45000000, salaryMax: 90000000 },
  { role: "기획자", count: 25, salaryMin: 40000000, salaryMax: 70000000 },
  { role: "디자이너", count: 20, salaryMin: 38000000, salaryMax: 65000000 },
  { role: "이사 및 경영진", count: 15, salaryMin: 80000000, salaryMax: 200000000 },
];

const DEPARTMENTS: Record<string, string[]> = {
  "개발자": ["프론트엔드팀", "백엔드팀", "모바일팀", "인프라팀", "데이터팀"],
  "기획자": ["서비스기획팀", "전략기획팀", "PM팀"],
  "디자이너": ["UX팀", "UI팀", "브랜드팀"],
  "이사 및 경영진": ["경영지원실", "전략실", "CTO실"],
};

const SURNAMES = ["김", "이", "박", "최", "정", "송", "허", "원", "한"];

const FIRST_NAMES = [
  "민준", "서준", "도윤", "예준", "시우", "하준", "주원", "지호", "지후", "준서",
  "준우", "현우", "도현", "건우", "우진", "선우", "서진", "민재", "현준", "연우",
  "유준", "정우", "승현", "승우", "지훈", "유찬", "준혁", "도훈", "이준", "은우",
  "서윤", "서연", "지우", "하은", "하린", "수아", "지아", "서아", "윤서", "채원",
  "지윤", "은서", "수빈", "예린", "민서", "하윤", "지유", "소율", "예은", "지민",
  "채은", "윤아", "시은", "예나", "소은", "다은", "아린", "수현", "예서", "민지",
  "태영", "성민", "재원", "영호", "진수", "상현", "동혁", "세훈", "기훈", "용준",
  "보람", "나래", "다솜", "가영", "혜진", "수정", "유리", "미래", "세영", "은비",
];

const usedNames = new Set<string>();

function generateName(): string {
  for (let i = 0; i < 100; i++) {
    const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const name = surname + firstName;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  // Fallback: add a number suffix
  const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  return surname + firstName;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function roundToTenThousand(n: number): number {
  return Math.round(n / 10000) * 10000;
}

function seedEmployees(db: ReturnType<typeof getDb>) {
  const insert = db.prepare(`
    INSERT INTO employees (name, role, department, salary, hire_date, phone, email, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const insertMany = db.transaction(() => {
    for (const { role, count, salaryMin, salaryMax } of ROLES) {
      const depts = DEPARTMENTS[role];
      for (let i = 0; i < count; i++) {
        const name = generateName();
        const dept = depts[randomInt(0, depts.length - 1)];
        const salary = roundToTenThousand(randomInt(salaryMin, salaryMax));
        const hireDate = faker.date.between({
          from: "2018-01-01",
          to: "2025-12-31",
        }).toISOString().split("T")[0];
        const phone = faker.phone.number({ style: "national" });
        const email = `${faker.internet.username().toLowerCase()}@nabia.co.kr`;

        insert.run(name, role, dept, salary, hireDate, phone, email);
      }
    }
  });

  insertMany();
  console.log("✅ 직원 100명 시드 데이터 생성 완료");
}

function seedAttendance(db: ReturnType<typeof getDb>) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO attendance (employee_id, work_date, check_in_time, check_out_time, is_late, is_early_leave)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const employees = db.prepare("SELECT id FROM employees").all() as { id: number }[];
  const today = new Date();

  // Generate 90 days of workdays
  const workdays: string[] = [];
  const d = new Date(today);
  d.setDate(d.getDate() - 90);
  while (d <= today) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      workdays.push(d.toISOString().split("T")[0]);
    }
    d.setDate(d.getDate() + 1);
  }

  const insertMany = db.transaction(() => {
    for (const emp of employees) {
      for (const workDate of workdays) {
        const rand = Math.random();

        // 5% absent
        if (rand < 0.05) continue;

        let checkIn: string;
        let isLate = 0;

        if (rand < 0.15) {
          // 10% late (09:01 ~ 10:30)
          const minutes = randomInt(1, 90);
          const hour = 9 + Math.floor(minutes / 60);
          const min = minutes % 60;
          checkIn = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
          isLate = 1;
        } else {
          // 85% normal (08:30 ~ 09:00)
          const min = randomInt(30, 59);
          checkIn = `08:${String(min).padStart(2, "0")}:00`;
        }

        // Checkout: 18:00 ~ 19:30
        const coMin = randomInt(0, 90);
        const coHour = 18 + Math.floor(coMin / 60);
        const coMinute = coMin % 60;
        const checkOut = `${String(coHour).padStart(2, "0")}:${String(coMinute).padStart(2, "0")}:00`;

        const isEarlyLeave = coHour < 18 ? 1 : 0;

        insert.run(emp.id, workDate, checkIn, checkOut, isLate, isEarlyLeave);
      }
    }
  });

  insertMany();
  console.log(`✅ 출퇴근 데이터 생성 완료 (${workdays.length}일 × ${employees.length}명)`);
}

export function seedDatabase() {
  const db = getDb();

  const count = (db.prepare("SELECT COUNT(*) as cnt FROM employees").get() as any).cnt;
  if (count > 0) {
    console.log("ℹ️ 이미 시드 데이터가 존재합니다. 건너뜁니다.");
    return;
  }

  seedEmployees(db);
  seedAttendance(db);
}

// Direct execution
if (process.argv[1]?.includes("seed")) {
  initDb();
  seedDatabase();
  console.log("🎉 시드 데이터 생성이 완료되었습니다.");
}
