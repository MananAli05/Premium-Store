"use client";

import { ChevronRight } from "lucide-react";
import { classNames } from "@/lib/format";

export const appInput =
  "w-full h-11 rounded-xl bg-[#f3f5fa] px-3.5 text-[14px] text-zinc-900 outline-none focus:ring-2 focus:ring-[#0C2660]/20 placeholder:text-zinc-400";

type GroupProps = {
  title?: string;
  action?: { label: string; onClick: () => void };
  plain?: boolean;
  children: React.ReactNode;
};

export function Group({ title, action, plain = false, children }: GroupProps) {
  return (
    <section>
      {(title || action) && (
        <div className="flex items-center justify-between px-1.5 pt-4 pb-2">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-zinc-400">{title}</h3>
          {action && (
            <button onClick={action.onClick} className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-[#0C2660] shadow-[0_4px_12px_-8px_rgba(12,38,96,0.4)]">
              {action.label}
            </button>
          )}
        </div>
      )}
      <div className={classNames("rounded-[20px] bg-white shadow-[0_10px_26px_-22px_rgba(12,38,96,0.55)]", !plain && "divide-y divide-zinc-100 overflow-hidden")}>{children}</div>
    </section>
  );
}

type RowProps = {
  title: string;
  sub?: string;
  preview?: boolean;
  dot?: string;
  value?: string;
  count?: number;
  end?: React.ReactNode;
  onClick?: () => void;
};

export function Row({ title, sub, preview = false, dot, value, count, end, onClick }: RowProps) {
  const content = (
    <>
      {dot && <span className={classNames("mt-1.5 size-2 shrink-0 self-start rounded-full", dot)} />}
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-semibold text-zinc-900">{title}</span>
        {sub && <span className={classNames("block mt-0.5 text-[12px] text-zinc-500", preview ? "line-clamp-2" : "truncate")}>{sub}</span>}
      </span>
      {value && <span className="shrink-0 max-w-[45%] truncate text-[13px] font-semibold text-[#0C2660]">{value}</span>}
      {count !== undefined && <span className="shrink-0 rounded-full bg-[#eef1f7] px-2 py-0.5 text-[10.5px] font-bold text-[#0C2660]">{count}</span>}
      {end ?? (onClick && <ChevronRight size={16} className="shrink-0 text-zinc-300" />)}
    </>
  );

  if (!onClick) return <div className="flex items-center gap-2.5 px-3.5 py-3">{content}</div>;
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left active:bg-zinc-50">
      {content}
    </button>
  );
}

export function PopupTag() {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10.5px] font-bold text-sky-700">Pop-up</span>
      <ChevronRight size={16} className="text-zinc-300" />
    </span>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!on);
      }}
      className={classNames("relative h-6 w-10 shrink-0 rounded-full transition", on ? "bg-[#0C2660]" : "bg-zinc-300")}
    >
      <span className={classNames("absolute top-[3px] left-[3px] size-[18px] rounded-full bg-white shadow transition-transform duration-200 ease-out", on && "translate-x-4")} />
    </button>
  );
}

export function SwitchRow({ title, sub, on, onChange }: { title: string; sub?: string; on: boolean; onChange: (value: boolean) => void }) {
  return <Row title={title} sub={sub} end={<Switch on={on} onChange={onChange} label={title} />} />;
}

type InputFieldProps = {
  label: string;
  hint?: string;
  children: React.ReactNode;
};

export function InputField({ label, hint, children }: InputFieldProps) {
  return (
    <label className="block px-3.5 py-3">
      <span className="block mb-1.5 text-[12px] font-semibold text-zinc-500">{label}</span>
      {children}
      {hint && <span className="block mt-1.5 text-[11.5px] text-zinc-400">{hint}</span>}
    </label>
  );
}

type ChoicesProps = {
  values: number[];
  value: number;
  onChange: (value: number) => void;
};

export function Choices({ values, value, onChange }: ChoicesProps) {
  return (
    <div className="flex gap-1.5">
      {values.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={classNames("flex-1 h-9 rounded-xl text-[13px] font-semibold transition", value === option ? "bg-[#0C2660] text-white" : "bg-[#f3f5fa] text-zinc-600")}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
