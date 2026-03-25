import { getDb } from "../database/connection.js";
import type { Employee } from "../models/employee.js";

export function listEmployees(page: number, pageSize: number): { employees: Employee[]; total: number } {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) as cnt FROM employees WHERE is_active = 1").get() as any).cnt;
  const employees = db.prepare(
    "SELECT * FROM employees WHERE is_active = 1 ORDER BY id LIMIT ? OFFSET ?"
  ).all(pageSize, (page - 1) * pageSize) as Employee[];
  return { employees, total };
}

export function searchByName(name: string): Employee[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM employees WHERE name LIKE ? AND is_active = 1"
  ).all(`%${name}%`) as Employee[];
}

export function getEmployeeById(id: number): Employee | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM employees WHERE id = ?").get(id) as Employee | undefined;
}

export function salaryStatsByRole(): { role: string; avg_salary: number; min_salary: number; max_salary: number; count: number }[] {
  const db = getDb();
  return db.prepare(`
    SELECT role,
           ROUND(AVG(salary)) as avg_salary,
           MIN(salary) as min_salary,
           MAX(salary) as max_salary,
           COUNT(*) as count
    FROM employees
    WHERE is_active = 1
    GROUP BY role
    ORDER BY avg_salary DESC
  `).all() as any[];
}

export function salaryStatsByDepartment(): { department: string; avg_salary: number; min_salary: number; max_salary: number; count: number }[] {
  const db = getDb();
  return db.prepare(`
    SELECT department,
           ROUND(AVG(salary)) as avg_salary,
           MIN(salary) as min_salary,
           MAX(salary) as max_salary,
           COUNT(*) as count
    FROM employees
    WHERE is_active = 1
    GROUP BY department
    ORDER BY avg_salary DESC
  `).all() as any[];
}

export function getEmployeeSalary(name: string): Employee[] {
  return searchByName(name);
}

export function totalEmployeeCount(): number {
  const db = getDb();
  return (db.prepare("SELECT COUNT(*) as cnt FROM employees WHERE is_active = 1").get() as any).cnt;
}

export function findEmployeeInText(text: string): Employee[] {
  const db = getDb();
  const allNames = db.prepare(
    "SELECT DISTINCT name FROM employees WHERE is_active = 1"
  ).all() as { name: string }[];

  const matched = new Set<string>();
  for (const { name } of allNames) {
    if (text.includes(name)) {
      matched.add(name);
    }
  }

  // If no full name match, try surname + partial (2 char minimum)
  if (matched.size === 0) {
    const koreanWords = text.match(/[가-힣]{2,}/g) || [];
    for (const word of koreanWords) {
      const results = searchByName(word);
      for (const emp of results) {
        matched.add(emp.name);
      }
    }
  }

  if (matched.size === 0) return [];
  const placeholders = [...matched].map(() => "?").join(",");
  return db.prepare(
    `SELECT * FROM employees WHERE name IN (${placeholders}) AND is_active = 1`
  ).all(...matched) as Employee[];
}

export function filterEmployees(options: {
  role?: string;
  department?: string;
  sort_by?: string;
  order?: string;
  limit?: number;
}): Employee[] {
  const db = getDb();
  const conditions = ["is_active = 1"];
  const params: any[] = [];

  if (options.role) {
    conditions.push("role = ?");
    params.push(options.role);
  }
  if (options.department) {
    conditions.push("department = ?");
    params.push(options.department);
  }

  const sortCol = ["salary", "hire_date", "name"].includes(options.sort_by || "") ? options.sort_by : "salary";
  const sortOrder = options.order === "ASC" ? "ASC" : "DESC";
  const limit = Math.min(options.limit || 10, 200);

  const sql = `SELECT * FROM employees WHERE ${conditions.join(" AND ")} ORDER BY ${sortCol} ${sortOrder} LIMIT ?`;
  params.push(limit);

  return db.prepare(sql).all(...params) as Employee[];
}

export function overallStats(): {
  totalEmployees: number;
  avgSalary: number;
  roleDistribution: { role: string; count: number }[];
} {
  const db = getDb();
  const totalEmployees = totalEmployeeCount();
  const avgSalary = (db.prepare("SELECT ROUND(AVG(salary)) as avg FROM employees WHERE is_active = 1").get() as any).avg;
  const roleDistribution = db.prepare(
    "SELECT role, COUNT(*) as count FROM employees WHERE is_active = 1 GROUP BY role ORDER BY count DESC"
  ).all() as { role: string; count: number }[];
  return { totalEmployees, avgSalary, roleDistribution };
}
