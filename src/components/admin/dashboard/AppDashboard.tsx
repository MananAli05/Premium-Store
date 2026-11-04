"use client";

import { useState } from "react";
import { ArrowRight, ChevronRight, TrendingUp } from "lucide-react";
import { useSwipe } from "@/hooks/useCategorySwipe";
import { useNow } from "@/hooks/useNow";
import { classNames } from "@/lib/format";
import { useAppState } from "@/lib/store/state";
import type { Navigate, NavTarget } from "../navigation";
import { countBotFilters } from "../inbox/inboxItems";
import { WEEK_DAYS, completedWeek, oldestWeekBack, weekLabel } from "./completedWeek";
import WeekArrows from "./WeekArrows";

// The dashboard inside the admin app: everything fits on one phone screen, above the app's tabs.
export default function AppDashboard({ onNavigate }: { onNavigate: Navigate }) {
  const state = useAppState();
  const now = useNow(30_000);
  const [pickedDay, setPickedDay] = useState(WEEK_DAYS - 1);
  const [weeksBack, setWeeksBack] = useState(0);

  const botCounts = countBotFilters(state, now);
  const pending = state.orders.filter((order) => order.status === "pending_review" || order.status === "rejected").length;
  const issues = state.tickets.filter((ticket) => ticket.status === "open" && ticket.kind === "support").length;

  const stats: { label: string; value: number; dot: string; target: NavTarget }[] = [
    { label: "Pending orders", value: pending, dot: "bg-[#794983]", target: { section: "inbox", tab: "pending" } },
    { label: "App issues", value: issues, dot: "bg-[#ffb02e]", target: { section: "inbox", tab: "issues" } },
    { label: "Active chats", value: botCounts.active_chats, dot: "bg-[#22c55e]", target: { section: "bot", botFilter: "active_chats" } },
    { label: "Active orders", value: botCounts.active_orders, dot: "bg-[#0a84ff]", target: { section: "bot", botFilter: "active_orders" } },
  ];

  const oldest = oldestWeekBack(state.orders, now);
  const week = completedWeek(state.orders, now, weeksBack);
  const days = week.map((day) => ({ count: day.count, label: day.short }));
  const showWeek = (next: number) => {
    setWeeksBack(next);
    setPickedDay(WEEK_DAYS - 1);
  };
  const chartSwipe = useSwipe(() => showWeek(Math.max(0, weeksBack - 1)), () => showWeek(Math.min(oldest, weeksBack + 1)));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const top = Math.max(4, ...days.map((day) => day.count));

  const swipe = useSwipe(() => onNavigate({ section: "inbox" }));

  return (
    <div {...swipe} className="h-full flex flex-col gap-3 px-4 pt-1 pb-3">
      <button
        onClick={() => onNavigate({ section: "inbox", tab: "pending" })}
        className="relative overflow-hidden shrink-0 rounded-[26px] bg-[linear-gradient(135deg,#0C2660_0%,#1B3A85_100%)] text-white text-left px-[18px] py-4 flex items-center gap-3.5"
      >
        <span className="absolute -right-9 -top-11 size-[150px] rounded-full border-[20px] border-[#D4A551]/15" />
        <span className="relative flex-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">
            <span className={classNames("size-1.5 rounded-full", pending ? "bg-red-400" : "bg-emerald-400")} />
            {pending ? "Needs your review" : "All caught up"}
          </span>
          <span className="mt-2 block text-[26px] font-bold leading-tight tracking-tight">
            {pending} <span className="text-[#D4A551]">{pending === 1 ? "payment" : "payments"}</span>
          </span>
          <span className="block text-[12.5px] text-white/70">waiting for verification</span>
        </span>
        <span className="relative size-[52px] shrink-0 rounded-full bg-[#D4A551] text-[#0C2660] grid place-items-center">
          <ArrowRight size={22} strokeWidth={2.6} />
        </span>
      </button>

      <div className="shrink-0 grid grid-cols-2 gap-2.5">
        {stats.map((stat) => (
          <button key={stat.label} onClick={() => onNavigate(stat.target)} className="text-left rounded-[22px] bg-white px-4 py-3.5 shadow-[0_8px_24px_-16px_rgba(12,38,96,0.28)]">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500 whitespace-nowrap">
              <span className={`size-2 rounded-full shrink-0 ${stat.dot}`} />
              {stat.label}
            </span>
            <span className="mt-1.5 block text-[26px] font-bold leading-none text-zinc-900 tabular-nums">{stat.value}</span>
          </button>
        ))}
      </div>

      <div
        onTouchStart={(event) => {
          event.stopPropagation();
          chartSwipe.onTouchStart(event);
        }}
        onTouchEnd={(event) => {
          event.stopPropagation();
          chartSwipe.onTouchEnd(event);
        }}
        className="flex-1 min-h-[180px] flex flex-col rounded-[26px] bg-white px-4 pt-4 pb-3 shadow-[0_8px_24px_-16px_rgba(12,38,96,0.28)]">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[15px] font-bold text-zinc-900">Completed orders</div>
            <div className="text-[12px] font-semibold text-zinc-500">
              {weekLabel(week, weeksBack)} · {total} orders
            </div>
          </div>
          <div className="flex items-center gap-1">
            <WeekArrows weeksBack={weeksBack} oldest={oldest} onChange={showWeek} />
            {weeksBack === 0 && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-bold text-emerald-700">
                <TrendingUp size={14} />
                {days[WEEK_DAYS - 1].count} today
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 min-h-0 mt-3 flex items-end gap-2">
          {days.map((day, index) => {
            const picked = index === pickedDay;
            return (
              <button key={day.label} onClick={() => setPickedDay(index)} aria-label={`${day.label}: ${day.count} orders`} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1.5">
                <span className="relative w-full flex-1 min-h-0 rounded-full bg-[#eef1f7] flex items-end">
                  {picked && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-900 px-2 py-1 text-[11px] font-bold text-white"
                      style={{ bottom: `calc(${(day.count / top) * 100}% + 6px)` }}
                    >
                      {day.count}
                    </span>
                  )}
                  <span className={classNames("w-full rounded-full transition-all duration-300", picked ? "chart-picked bg-[#0C2660]" : "bg-[#c7d2ec]")} style={{ height: `${Math.max(6, (day.count / top) * 100)}%` }} />
                </span>
                <span className={classNames("text-[11px] font-semibold", picked ? "text-zinc-900" : "text-zinc-400")}>{day.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => onNavigate({ section: "customers" })}
        className="shrink-0 rounded-[22px] bg-white px-3.5 py-3 shadow-[0_8px_24px_-16px_rgba(12,38,96,0.28)] flex items-center gap-3 text-left"
      >
        <span className="flex">
          {["K", "A", "T"].map((letter, index) => (
            <span
              key={letter}
              className={classNames(
                "size-[34px] rounded-full border-2 border-white grid place-items-center text-[12px] font-bold",
                index > 0 && "-ml-2.5",
                ["bg-[#e9eefb] text-[#0C2660]", "bg-[#f6eedc] text-[#8a6420]", "bg-[#e3f5ef] text-[#047857]"][index]
              )}
            >
              {letter}
            </span>
          ))}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14.5px] font-bold text-zinc-900">Customer list</span>
          <span className="block text-[12px] font-semibold text-zinc-500">{state.customers.length} customers · tap to see all</span>
        </span>
        <span className="size-9 rounded-full bg-zinc-100 text-zinc-800 grid place-items-center">
          <ChevronRight size={19} />
        </span>
      </button>
    </div>
  );
}
