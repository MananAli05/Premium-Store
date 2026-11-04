import assert from "node:assert/strict";
import { test } from "node:test";
import { completedWeek, oldestWeekBack, weekLabel } from "../../src/components/admin/dashboard/completedWeek.ts";
import type { Order } from "../../src/lib/types.ts";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date(2026, 10, 4, 15).getTime();

function completed(daysAgo: number) {
  return { status: "completed", reviewedAt: now - daysAgo * DAY } as Order;
}

const orders = [completed(0), completed(0), completed(3), completed(8), completed(20)];

test("this week counts the last seven days ending today", () => {
  const days = completedWeek(orders, now, 0);
  assert.equal(days.length, 7);
  assert.equal(days[6].short, "Today");
  assert.equal(days[6].count, 2);
  assert.equal(days[3].count, 1);
  assert.equal(weekLabel(days, 0), "Last 7 days");
});

test("a week back shows the seven days before that, with dates in the label", () => {
  const days = completedWeek(orders, now, 1);
  assert.equal(days.reduce((sum, day) => sum + day.count, 0), 1);
  assert.notEqual(days[6].short, "Today");
  assert.equal(weekLabel(days, 1), "22 Oct – 28 Oct");
});

test("arrows go back only as far as the first completed order", () => {
  assert.equal(oldestWeekBack(orders, now), 2);
  assert.equal(oldestWeekBack([], now), 0);
});
