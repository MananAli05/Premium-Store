"use client";

import { ChevronRight } from "lucide-react";
import { useSwipe } from "@/hooks/useCategorySwipe";
import { useNow } from "@/hooks/useNow";
import { classNames } from "@/lib/format";
import { useAppState } from "@/lib/store/state";
import type { Navigate, NavTarget } from "../navigation";
import { countBotFilters } from "../inbox/inboxItems";
import CompletedOrdersChart from "./CompletedOrdersChart";

// The dashboard inside the admin app: everything fits on one phone screen, above the app's tabs.
export default function AppDashboard({ onNavigate }: { onNavigate: Navigate }) {
  const state = useAppState();
  const now = useNow(30_000);

  const botCounts = countBotFilters(state, now);
  const pending = state.orders.filter((order) => order.status === "pending_review" || order.status === "rejected").length;
  const issues = state.tickets.filter((ticket) => ticket.status === "open" && ticket.kind === "support").length;

  const stats: { label: string; value: number; dot: string; target: NavTarget }[] = [
    { label: "Pending orders", value: pending, dot: "bg-[#794983]", target: { section: "inbox", tab: "pending" } },
    { label: "App issues", value: issues, dot: "bg-[#ffb02e]", target: { section: "inbox", tab: "issues" } },
    { label: "Active chats", value: botCounts.active_chats, dot: "bg-[#22c55e]", target: { section: "bot", botFilter: "active_chats" } },
    { label: "Active orders", value: botCounts.active_orders, dot: "bg-[#0a84ff]", target: { section: "bot", botFilter: "active_orders" } },
  ];

  const swipe = useSwipe(() => onNavigate({ section: "inbox" }));

  return (
    <div {...swipe} className="h-full flex flex-col gap-3 px-4 pt-1 pb-3">
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

      <div onTouchStart={(event) => event.stopPropagation()} onTouchEnd={(event) => event.stopPropagation()}>
        <CompletedOrdersChart now={now} />
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
