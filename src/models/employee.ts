export interface Employee {
  id: number;
  name: string;
  role: "개발자" | "기획자" | "디자이너" | "이사 및 경영진";
  department: string;
  salary: number;
  hire_date: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  is_active: number;
}
