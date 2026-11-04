import type { Order } from "@/lib/types";

export const WEEK_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export type ChartDay = { start: number; count: number; short: string; full: string };

function startOfDay(time: number) {
  return new Date(time).setHours(0, 0, 0, 0);
}

function completedTimes(orders: Order[]) {
  return orders.filter((order) => order.status === "completed" && order.reviewedAt).map((order) => order.reviewedAt ?? 0);
}

export function completedWeek(orders: Order[], now: number, weeksBack: number): ChartDay[] {
  const times = completedTimes(orders);
  const lastDay = startOfDay(now) - weeksBack * WEEK_DAYS * DAY;

  return Array.from({ length: WEEK_DAYS }, (_, index) => {
    const start = lastDay - (WEEK_DAYS - 1 - index) * DAY;
    const date = new Date(start);
    return {
      start,
      count: times.filter((time) => time >= start && time < start + DAY).length,
      short: weeksBack === 0 && index === WEEK_DAYS - 1 ? "Today" : date.toLocaleDateString("en-GB", { weekday: "short" }),
      full: date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }),
    };
  });
}

export function oldestWeekBack(orders: Order[], now: number) {
  const times = completedTimes(orders);
  if (times.length === 0) return 0;
  const first = times.reduce((oldest, time) => Math.min(oldest, time));
  return Math.max(0, Math.floor((startOfDay(now) - startOfDay(first)) / (WEEK_DAYS * DAY)));
}

export function weekLabel(days: ChartDay[], weeksBack: number) {
  if (weeksBack === 0) return "Last 7 days";
  const short = (time: number) => new Date(time).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${short(days[0].start)} – ${short(days[WEEK_DAYS - 1].start)}`;
}
