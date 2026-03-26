import { getDb } from "../database/connection.js";
import type { Evaluation } from "../models/evaluation.js";

interface EvaluationWithName extends Evaluation {
  name: string;
}

export function getEvaluationsByEmployee(employeeId: number): EvaluationWithName[] {
  const db = getDb();
  return db.prepare(`
    SELECT ev.*, e.name
    FROM evaluations ev
    JOIN employees e ON ev.employee_id = e.id
    WHERE ev.employee_id = ?
    ORDER BY ev.year DESC
  `).all(employeeId) as EvaluationWithName[];
}

export function getEvaluationsByYear(year: number): EvaluationWithName[] {
  const db = getDb();
  return db.prepare(`
    SELECT ev.*, e.name, e.role, e.department
    FROM evaluations ev
    JOIN employees e ON ev.employee_id = e.id
    WHERE ev.year = ?
    ORDER BY ev.grade ASC, e.name ASC
  `).all(year) as any[];
}

export function getEvaluationStatsByYear(year: number): { grade: string; count: number }[] {
  const db = getDb();
  return db.prepare(`
    SELECT grade, COUNT(*) as count
    FROM evaluations
    WHERE year = ?
    GROUP BY grade
    ORDER BY grade ASC
  `).all(year) as any[];
}

export function getEvaluationsByGrade(year: number, grade: string): any[] {
  const db = getDb();
  return db.prepare(`
    SELECT ev.*, e.name, e.role, e.department
    FROM evaluations ev
    JOIN employees e ON ev.employee_id = e.id
    WHERE ev.year = ? AND ev.grade = ?
    ORDER BY e.name ASC
  `).all(year, grade) as any[];
}
