import { getDb } from "../database/connection.js";
import type { Attendance } from "../models/attendance.js";
import { todayStr } from "../utils/formatters.js";

interface AttendanceWithName extends Attendance {
  name: string;
}

export function getAttendanceByDate(date: string): AttendanceWithName[] {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, e.name
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE a.work_date = ?
    ORDER BY e.name
  `).all(date) as AttendanceWithName[];
}

export function getLateByDate(date: string): AttendanceWithName[] {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, e.name
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE a.work_date = ? AND a.is_late = 1
    ORDER BY a.check_in_time DESC
  `).all(date) as AttendanceWithName[];
}

export function getAbsentByDate(date: string): { id: number; name: string; role: string; department: string }[] {
  const db = getDb();
  return db.prepare(`
    SELECT e.id, e.name, e.role, e.department
    FROM employees e
    WHERE e.is_active = 1
      AND e.id NOT IN (
        SELECT employee_id FROM attendance WHERE work_date = ?
      )
    ORDER BY e.name
  `).all(date) as any[];
}

export function getEmployeeAttendance(employeeId: number, days: number = 30): Attendance[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM attendance
    WHERE employee_id = ?
    ORDER BY work_date DESC
    LIMIT ?
  `).all(employeeId, days) as Attendance[];
}

export function getEmployeeMonthlyReport(employeeId: number): {
  totalDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  avgCheckIn: string | null;
} {
  const db = getDb();
  const result = db.prepare(`
    SELECT
      COUNT(*) as totalDays,
      SUM(is_late) as lateDays,
      SUM(is_early_leave) as earlyLeaveDays,
      TIME(AVG(
        CASE WHEN check_in_time IS NOT NULL
        THEN strftime('%s', '2000-01-01 ' || check_in_time) - strftime('%s', '2000-01-01 00:00:00')
        END
      ), 'unixepoch') as avgCheckIn
    FROM attendance
    WHERE employee_id = ?
      AND work_date >= date('now', '-30 days')
  `).get(employeeId) as any;

  return {
    totalDays: result.totalDays || 0,
    lateDays: result.lateDays || 0,
    earlyLeaveDays: result.earlyLeaveDays || 0,
    avgCheckIn: result.avgCheckIn,
  };
}

export function getTodayStats(): { present: number; late: number; absent: number; total: number } {
  const db = getDb();
  const today = todayStr();
  const total = (db.prepare("SELECT COUNT(*) as cnt FROM employees WHERE is_active = 1").get() as any).cnt;
  const present = (db.prepare("SELECT COUNT(*) as cnt FROM attendance WHERE work_date = ?").get(today) as any).cnt;
  const late = (db.prepare("SELECT COUNT(*) as cnt FROM attendance WHERE work_date = ? AND is_late = 1").get(today) as any).cnt;
  return { present, late, absent: total - present, total };
}
