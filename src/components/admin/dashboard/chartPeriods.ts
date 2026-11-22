import type { Order } from "@/lib/types";

export type ChartView = "daily" | "hourly" | "monthly" | "custom";

export const chartViews: Record<ChartView, { title: string; sub: string; button: string }> = {
  daily: { title: "Daily", sub: "Last 7 days", button: "Last 7 days" },
  hourly: { title: "Hourly", sub: "Orders per hour, one day", button: "Hourly" },
  monthly: { title: "Monthly", sub: "Last 6 months", button: "Last 6 months" },
  custom: { title: "Custom range", sub: "Pick start and end dates", button: "Custom range" },
};

export type ChartBucket = { label: string; title: string; start: number; end: number; plans: Record<string, number> };
export type ChartPeriod = { range: string; buckets: ChartBucket[] };
export type DateRange = { start: number; end: number };

const LONG_CUSTOM_DAYS = 31;

type Slot = { label: string; title: string; start: Date; end: Date };

const midnight = (time: number) => {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const shortDate = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const weekday = (date: Date) => date.toLocaleDateString("en-GB", { weekday: "short" });
const dayTitle = (date: Date) => `${weekday(date)}, ${shortDate(date)}`;
const monthTitle = (date: Date) => date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
const hourName = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;

export const bucketCount = (bucket: ChartBucket, plan?: string | null) =>
  plan ? (bucket.plans[plan] ?? 0) : Object.values(bucket.plans).reduce((sum, count) => sum + count, 0);

function planMonths(plan: string) {
  const match = /(\d+)\s*(year|yr)?/i.exec(plan);
  if (!match) return 999;
  return match[2] ? Number(match[1]) * 12 : Number(match[1]);
}

export function shortPlan(plan: string) {
  const months = planMonths(plan);
  return months === 999 ? plan : `${months}M`;
}

export function plansIn(buckets: ChartBucket[]) {
  const plans = new Set(buckets.flatMap((bucket) => Object.keys(bucket.plans)));
  return [...plans].sort((a, b) => planMonths(a) - planMonths(b));
}

const completed = (orders: Order[]) => orders.filter((order) => order.status === "completed" && order.reviewedAt);

function fill(orders: Order[], slots: Slot[]): ChartBucket[] {
  const done = completed(orders);
  return slots.map(({ label, title, start, end }) => {
    const plans: Record<string, number> = {};
    for (const order of done) {
      const time = order.reviewedAt ?? 0;
      if (time >= start.getTime() && time < end.getTime()) plans[order.planName] = (plans[order.planName] ?? 0) + 1;
    }
    return { label, title, start: start.getTime(), end: end.getTime(), plans };
  });
}

function daySlots(first: Date, count: number, today: Date): Slot[] {
  return Array.from({ length: count }, (_, index) => {
    const day = addDays(first, index);
    const label = day.getTime() === today.getTime() ? "Today" : count > 7 ? String(day.getDate()) : weekday(day);
    return { label, title: dayTitle(day), start: day, end: addDays(day, 1) };
  });
}

function monthSlots(first: Date, count: number): Slot[] {
  return Array.from({ length: count }, (_, index) => {
    const month = new Date(first.getFullYear(), first.getMonth() + index, 1);
    return { label: month.toLocaleDateString("en-GB", { month: "short" }), title: monthTitle(month), start: month, end: new Date(month.getFullYear(), month.getMonth() + 1, 1) };
  });
}

export function chartPeriod(orders: Order[], now: number, view: ChartView, pagesBack = 0, custom?: DateRange): ChartPeriod {
  const today = midnight(now);

  if (view === "hourly") {
    const day = addDays(today, -pagesBack);
    const slots = Array.from({ length: 24 }, (_, hour) => {
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
      return { label: hour % 6 === 0 ? hourName(hour).replace(" ", "").toLowerCase() : "", title: `${hourName(hour)} – ${hourName((hour + 1) % 24)}`, start, end: new Date(start.getTime() + 3_600_000) };
    });
    return { range: pagesBack === 0 ? "Today" : dayTitle(day), buckets: fill(orders, slots) };
  }

  if (view === "monthly") {
    const slots = monthSlots(new Date(today.getFullYear(), today.getMonth() - 5 - pagesBack * 6, 1), 6);
    return { range: `${slots[0].title} – ${slots[5].title}`, buckets: fill(orders, slots) };
  }

  if (view === "custom") {
    const start = midnight(custom?.start ?? addDays(today, -6).getTime());
    const end = midnight(custom?.end ?? now);
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    const slots = days > LONG_CUSTOM_DAYS ? monthSlots(new Date(start.getFullYear(), start.getMonth(), 1), (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1) : daySlots(start, days, today);
    return { range: `${shortDate(start)} – ${shortDate(end)}`, buckets: fill(orders, slots) };
  }

  const first = addDays(today, -6 - pagesBack * 7);
  const slots = daySlots(first, 7, today);
  return { range: pagesBack === 0 ? "Last 7 days" : `${shortDate(first)} – ${shortDate(slots[6].start)}`, buckets: fill(orders, slots) };
}

export function firstCompletedAt(orders: Order[]) {
  const times = completed(orders).map((order) => order.reviewedAt ?? 0);
  return times.length ? Math.min(...times) : null;
}
