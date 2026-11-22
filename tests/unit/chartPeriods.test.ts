import assert from "node:assert/strict";
import { test } from "node:test";
import { bucketCount, chartPeriod, firstCompletedAt, plansIn, shortPlan } from "../../src/components/admin/dashboard/chartPeriods.ts";
import { orderWaitingForCode, planMismatch } from "../../src/lib/planCheck.ts";
import type { Order } from "../../src/lib/types.ts";

const now = new Date(2026, 10, 4, 15).getTime();
const HOUR = 3_600_000;
const done = (hoursAgo: number, planName = "1 Month") => ({ id: `PS-${hoursAgo}-${planName}`, customerId: "c1", planName, status: "completed", createdAt: 1, reviewedAt: now - hoursAgo * HOUR }) as Order;
const orders = [done(0), done(72), done(192), done(960, "3 Months")];

test("daily shows seven days ending today", () => {
  const period = chartPeriod(orders, now, "daily");
  assert.equal(period.buckets.length, 7);
  assert.equal(period.buckets[6].label, "Today");
  assert.equal(bucketCount(period.buckets[6]), 1);
  assert.equal(period.range, "Last 7 days");
  assert.equal(chartPeriod(orders, now, "daily", 1).buckets.reduce((sum, bucket) => sum + bucketCount(bucket), 0), 1);
});

test("hourly, monthly and custom ranges", () => {
  assert.equal(chartPeriod([done(0), done(0.5)], now, "hourly").buckets[14].plans["1 Month"], 1);
  assert.equal(chartPeriod(orders, now, "monthly").buckets.reduce((sum, bucket) => sum + bucketCount(bucket), 0), 4);
  const custom = chartPeriod(orders, now, "custom", 0, { start: new Date(2026, 8, 1).getTime(), end: now });
  assert.equal(custom.buckets.length, 3);
  assert.deepEqual(plansIn(custom.buckets).map(shortPlan), ["1M", "3M"]);
  assert.equal(firstCompletedAt(orders), now - 960 * HOUR);
});

test("a code message for another plan is stopped", () => {
  assert.match(planMismatch("Your premium code for 3 month is: AB12CD", "1 Month") ?? "", /3 Months/);
  assert.match(planMismatch("Code for 1 year: AB12CD", "6 Months") ?? "", /12 Months/);
  assert.equal(planMismatch("Your premium code for 1 month is: AB12CD", "1 Month"), null);
  assert.equal(planMismatch("AB12CD", "3 Months"), null);
  const waiting = [{ ...done(0), status: "pending_review", createdAt: 5 }, { ...done(0), id: "old", status: "pending_review", createdAt: 1 }] as Order[];
  assert.equal(orderWaitingForCode(waiting, "c1")?.createdAt, 5);
});
