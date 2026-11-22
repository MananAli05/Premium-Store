"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useSwipe } from "@/hooks/useCategorySwipe";
import { classNames } from "@/lib/format";
import { useAppState } from "@/lib/store/state";
import { bucketCount, chartPeriod, chartViews, firstCompletedAt, plansIn, shortPlan, type ChartView, type DateRange } from "./chartPeriods";

const planColors = ["#1E2F6B", "#4A64B0", "#93A8DE", "#D9A441", "#4FA584"];
const arrowClass = "size-9 grid place-items-center rounded-full bg-[#eef1f7] text-zinc-700 disabled:opacity-30";

const dateValue = (time: number) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const fromDateValue = (value: string) => new Date(`${value}T00:00:00`).getTime();

export default function CompletedOrdersChart({ now, className }: { now: number; className?: string }) {
  const state = useAppState();
  const [view, setView] = useState<ChartView>("daily");
  const [custom, setCustom] = useState<DateRange>({ start: now - 6 * 86_400_000, end: now });
  const [pagesBack, setPagesBack] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const period = chartPeriod(state.orders, now, view, pagesBack, custom);
  const buckets = period.buckets;
  const first = firstCompletedAt(state.orders);
  const pages = view !== "custom";
  const canGoBack = pages && first !== null && buckets[0].start > first;
  const canGoForward = pages && pagesBack > 0;
  const plans = plansIn(buckets);
  const shownPlan = plan && plans.includes(plan) ? plan : null;
  const colorOf = (name: string) => planColors[plans.indexOf(name) % planColors.length];
  const total = buckets.reduce((sum, bucket) => sum + bucketCount(bucket, shownPlan), 0);
  const top = Math.max(4, ...buckets.map((bucket) => bucketCount(bucket, shownPlan)));
  const pickedIndex = Math.min(picked ?? buckets.length - 1, buckets.length - 1);
  const pickedBucket = buckets[pickedIndex];
  const thin = buckets.length > 12;

  const showPage = (next: number) => {
    setPagesBack(next);
    setPicked(null);
  };
  const chooseView = (next: ChartView) => {
    setView(next);
    setPagesBack(0);
    setPicked(null);
    if (next !== "custom") setMenuOpen(false);
  };
  const swipe = useSwipe(
    () => canGoForward && showPage(pagesBack - 1),
    () => canGoBack && showPage(pagesBack + 1),
  );

  return (
    <div className={classNames("rounded-[26px] bg-white px-4 pt-4 pb-4 shadow-[0_8px_24px_-16px_rgba(12,38,96,0.28)]", className)}>
      <div className="text-[15px] font-bold text-zinc-900">Completed orders</div>

      <div className="mt-2.5 flex items-center gap-2">
        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-[#eef1f7] pl-3.5 pr-2.5 py-1.5 text-[13px] font-bold text-zinc-900">
            {chartViews[view].button}
            <ChevronDown size={16} className="text-zinc-500" />
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl">
              {(Object.keys(chartViews) as ChartView[]).map((key) => (
                <button key={key} onClick={() => chooseView(key)} className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-zinc-50">
                  <span className="flex-1">
                    <span className={classNames("block text-[14px] font-semibold", key === view ? "text-[#4A64B0]" : "text-zinc-900")}>{chartViews[key].title}</span>
                    <span className="block text-[12px] text-zinc-500">{chartViews[key].sub}</span>
                  </span>
                  {key === view && <Check size={16} className="text-[#4A64B0]" />}
                </button>
              ))}
              {view === "custom" && (
                <div className="mt-1 grid grid-cols-2 gap-2 border-t border-zinc-100 px-1 pt-3">
                  <input type="date" value={dateValue(custom.start)} max={dateValue(custom.end)} onChange={(event) => event.target.value && setCustom({ ...custom, start: fromDateValue(event.target.value) })} className="h-9 rounded-lg border border-zinc-200 px-2 text-[12.5px]" />
                  <input type="date" value={dateValue(custom.end)} min={dateValue(custom.start)} max={dateValue(now)} onChange={(event) => event.target.value && setCustom({ ...custom, end: fromDateValue(event.target.value) })} className="h-9 rounded-lg border border-zinc-200 px-2 text-[12.5px]" />
                  <button onClick={() => setMenuOpen(false)} className="col-span-2 h-9 rounded-lg bg-[#0C2660] text-[13px] font-semibold text-white">
                    Show
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <span className="flex-1" />
        {pages && (
          <>
            <button onClick={() => showPage(pagesBack + 1)} disabled={!canGoBack} className={arrowClass} aria-label="Earlier">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => showPage(pagesBack - 1)} disabled={!canGoForward} className={arrowClass} aria-label="Later">
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      <div className="mt-1.5 text-[12px] font-semibold text-zinc-500">
        {period.range} · {total} orders
      </div>

      {plans.length > 0 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          <PlanChip label={`All ${buckets.reduce((sum, bucket) => sum + bucketCount(bucket), 0)}`} selected={!shownPlan} onClick={() => setPlan(null)} />
          {plans.map((name) => (
            <PlanChip
              key={name}
              label={`${shortPlan(name)} ${buckets.reduce((sum, bucket) => sum + bucketCount(bucket, name), 0)}`}
              color={colorOf(name)}
              selected={shownPlan === name}
              onClick={() => setPlan(shownPlan === name ? null : name)}
            />
          ))}
        </div>
      )}

      <div {...swipe} className={classNames("mt-8 h-[210px] flex", thin ? "gap-[3px]" : "gap-2")}>
        {buckets.map((bucket, index) => {
          const shown = (shownPlan ? [shownPlan] : plans).filter((name) => bucketCount(bucket, name) > 0).reverse();
          const count = shown.reduce((sum, name) => sum + bucketCount(bucket, name), 0);
          const isPicked = index === pickedIndex;
          return (
            <button key={bucket.start} onClick={() => setPicked(index)} aria-label={`${bucket.title}: ${count} completed`} className="flex-1 min-w-0 h-full flex flex-col items-center gap-1.5">
              <span className={classNames("relative w-full flex-1 bg-[#eef1f7] flex items-end border-[1.5px]", thin ? "rounded-md" : "rounded-[14px]", isPicked ? "border-[#4A64B0]" : "border-transparent")}>
                {isPicked && (
                  <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-900 px-2 py-1 text-[11px] font-bold text-white" style={{ bottom: `calc(${(count / top) * 100}% + 6px)` }}>
                    {count}
                  </span>
                )}
                <span className={classNames("w-full overflow-hidden flex flex-col gap-[2px]", thin ? "rounded-[5px]" : "rounded-xl")} style={{ height: `${Math.max(3, (count / top) * 100)}%` }}>
                  {count === 0 ? (
                    <span className="flex-1 bg-[#c7d2ec]" />
                  ) : (
                    shown.map((name) => <span key={name} style={{ flex: bucketCount(bucket, name), background: colorOf(name) }} />)
                  )}
                </span>
              </span>
              <span className={classNames("h-4 text-[11px] font-semibold whitespace-nowrap", isPicked ? "text-zinc-900" : "text-zinc-400")}>{bucket.label}</span>
            </button>
          );
        })}
      </div>

      {plans.length > 0 && (
        <div className="mt-3 rounded-[18px] bg-[#eef1f7] px-3.5 py-3">
          <div className="text-[12px] font-semibold text-zinc-500">
            {pickedBucket.title} · {bucketCount(pickedBucket)} completed
          </div>
          <div className="mt-2 flex">
            {plans.map((name) => (
              <div key={name} className="flex-1">
                <div className="text-[20px] font-bold leading-tight text-zinc-900 tabular-nums">{bucketCount(pickedBucket, name)}</div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
                  <span className="size-2 rounded-[2px]" style={{ background: colorOf(name) }} />
                  {shortPlan(name)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanChip({ label, color, selected, onClick }: { label: string; color?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold",
        selected ? "border-zinc-500 bg-[#eef1f7] text-zinc-900" : "border-zinc-200 text-zinc-500",
      )}
    >
      {color && <span className="size-2 rounded-[2px]" style={{ background: color }} />}
      {label}
    </button>
  );
}
