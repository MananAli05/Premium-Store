import { classNames } from "@/lib/format";
import { cancelOrder } from "@/lib/store/customer";
import { orderSteps } from "@/lib/store/helpers";
import { useAppState } from "@/lib/store/state";
import type { PaymentMethod } from "@/lib/types";
import type { OpenSheet } from "../ChatScreen";
import { primaryButtonClass, secondaryButtonClass } from "./buttonStyles";

type PaymentActionsProps = {
  customerId: string;
  method?: PaymentMethod;
  onOpenSheet: (sheet: OpenSheet) => void;
};

export default function PaymentActions({ customerId, method, onOpenSheet }: PaymentActionsProps) {
  const state = useAppState();
  const hasSteps = Boolean(method) && orderSteps(state, customerId).length > 0;

  return (
    <div className="max-w-[560px] mx-auto space-y-2">
      <button onClick={() => onOpenSheet("proof")} className={primaryButtonClass}>
        Upload payment screenshot
      </button>
      <div className={classNames("grid gap-2", hasSteps ? "grid-cols-3" : "grid-cols-2")}>
        {hasSteps && (
          <button onClick={() => onOpenSheet("steps")} className={classNames(secondaryButtonClass, "text-[13px] text-[var(--accent)]")}>
            Steps for {method?.name}
          </button>
        )}
        <button onClick={() => onOpenSheet("issue")} className={classNames(secondaryButtonClass, "text-[13px] text-amber-700")}>
          Problem?
        </button>
        <button onClick={() => cancelOrder(customerId)} className={classNames(secondaryButtonClass, "text-[13px] text-[var(--muted)] hover:text-red-700")}>
          Cancel
        </button>
      </div>
    </div>
  );
}
