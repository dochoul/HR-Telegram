export function formatSalary(amount: number): string {
  return `${(amount / 10000).toLocaleString("ko-KR")}만원`;
}

export function formatSalaryFull(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${year}년 ${parseInt(month)}월 ${parseInt(day)}일`;
}

export function formatTime(timeStr: string | null): string {
  if (!timeStr) return "-";
  return timeStr.substring(0, 5);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}
