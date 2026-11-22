import { classNames } from "@/lib/format";
import { Card } from "../ui/Card";

type SettingsSectionProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

export function SettingsSection({ title, description, action, children }: SettingsSectionProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-zinc-100">
        <div>
          <div className="font-semibold text-[15px] text-zinc-900">{title}</div>
          {description && <div className="text-[12.5px] text-zinc-500 mt-0.5">{description}</div>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

type FieldProps = {
  label: string;
  hint?: string;
  children: React.ReactNode;
};

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="block">
      <div className="text-[13px] font-medium text-zinc-700 mb-1.5">
        {label}
        {hint && <span className="text-zinc-400 font-normal"> · {hint}</span>}
        {/pop-up/i.test(label) && <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">Pop-up</span>}
      </div>
      {children}
    </label>
  );
}

type ChoiceButtonsProps = {
  values: number[];
  value: number;
  unit: string;
  onChange: (value: number) => void;
};

export function ChoiceButtons({ values, value, unit, onChange }: ChoiceButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={classNames(
            "h-10 px-4 rounded-xl border text-[13.5px] font-medium transition",
            value === option ? "bg-[#0C2660] text-white border-[#0C2660]" : "border-zinc-200 hover:bg-zinc-50"
          )}
        >
          {option} {unit}
        </button>
      ))}
    </div>
  );
}
