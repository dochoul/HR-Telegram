export interface Attendance {
  id: number;
  employee_id: number;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  is_late: number;
  is_early_leave: number;
}
