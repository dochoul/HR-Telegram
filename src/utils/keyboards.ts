import { InlineKeyboard } from "grammy";

export function paginationKeyboard(
  prefix: string,
  currentPage: number,
  totalPages: number
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (currentPage > 1) {
    keyboard.text("⬅️ 이전", `${prefix}:${currentPage - 1}`);
  }

  keyboard.text(`${currentPage}/${totalPages}`, "noop");

  if (currentPage < totalPages) {
    keyboard.text("다음 ➡️", `${prefix}:${currentPage + 1}`);
  }

  return keyboard;
}

export const PAGE_SIZE = 10;
