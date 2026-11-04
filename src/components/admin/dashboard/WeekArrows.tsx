import { ChevronLeft, ChevronRight } from "lucide-react";

type WeekArrowsProps = {
  weeksBack: number;
  oldest: number;
  onChange: (weeksBack: number) => void;
};

const arrowClass = "size-8 grid place-items-center rounded-full text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent";

export default function WeekArrows({ weeksBack, oldest, onChange }: WeekArrowsProps) {
  return (
    <div className="flex items-center">
      <button type="button" onClick={() => onChange(weeksBack + 1)} disabled={weeksBack >= oldest} className={arrowClass} aria-label="Previous week">
        <ChevronLeft size={18} />
      </button>
      <button type="button" onClick={() => onChange(weeksBack - 1)} disabled={weeksBack === 0} className={arrowClass} aria-label="Next week">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
