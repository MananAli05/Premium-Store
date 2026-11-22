import type { Order } from "./types";

const durationPattern = /(\d+)\s*-?\s*(months?|mon|years?|yr)\b/gi;

function mentionedMonths(text: string) {
  const months = new Set<number>();
  for (const match of text.matchAll(durationPattern)) {
    const count = Number(match[1]);
    months.add(match[2].toLowerCase().startsWith("y") ? count * 12 : count);
  }
  return months;
}

const monthsLabel = (months: number) => `${months} Month${months === 1 ? "" : "s"}`;

export function planMismatch(text: string, planName: string) {
  const plan = [...mentionedMonths(planName)];
  if (plan.length !== 1) return null;

  const wrong = [...mentionedMonths(text)].find((months) => months !== plan[0]);
  if (wrong === undefined) return null;
  return `This order is for ${planName}, but your message says ${monthsLabel(wrong)}. Please check the code before sending.`;
}

export function orderWaitingForCode(orders: Order[], customerId: string) {
  return orders
    .filter((order) => order.customerId === customerId && (order.status === "pending_review" || order.status === "rejected"))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}
