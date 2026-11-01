"use client";

import { useState } from "react";
import { classNames } from "@/lib/format";
import { blockCustomer, unblockCustomer } from "@/lib/store/admin";
import { customerTitle } from "@/lib/store/helpers";
import { useAppState } from "@/lib/store/state";
import type { Customer } from "@/lib/types";
import ConfirmDialog from "../ui/ConfirmDialog";
import Modal from "../ui/Modal";
import { actionButton, inputClass } from "../ui/styles";

const OTHER = "other";

type BlockCustomerButtonProps = {
  customer: Customer;
  compact?: boolean;
  pill?: boolean;
};

const pillClass = "h-[30px] px-3 rounded-full text-[12px] font-semibold";

export default function BlockCustomerButton({ customer, compact = false, pill = false }: BlockCustomerButtonProps) {
  const [open, setOpen] = useState(false);

  const buttonClass = pill
    ? `${pillClass} bg-red-50 text-red-700`
    : compact
    ? "h-8 px-1.5 md:px-3 rounded-lg text-[12.5px] font-medium text-zinc-600 hover:bg-zinc-100 transition"
    : `w-full ${actionButton.softDanger}`;

  if (customer.blocked) {
    return (
      <>
        <button onClick={() => setOpen(true)} className={pill ? `${pillClass} bg-red-500 text-white` : compact ? buttonClass : `w-full ${actionButton.blocked}`}>
          Unblock
        </button>
        {open && <ConfirmDialog description={`${customerTitle(customer)} will be able to use the chat again.`} confirmLabel="Yes, unblock" onConfirm={() => unblockCustomer(customer.id)} onClose={() => setOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={buttonClass}>
        Block
      </button>
      {open && <BlockDialog customer={customer} onClose={() => setOpen(false)} />}
    </>
  );
}

function BlockDialog({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const state = useAppState();
  const reasons = state.settings.blocking.reasons;
  const [choice, setChoice] = useState(reasons[0] ?? OTHER);
  const [customReason, setCustomReason] = useState("");
  const reason = choice === OTHER ? customReason.trim() : choice;

  const block = () => {
    if (!reason) return;
    blockCustomer(customer.id, reason);
    onClose();
  };

  return (
    <Modal title="Block customer" description={`${customerTitle(customer)} will see this reason`} onClose={onClose}>
      <div className="space-y-1.5">
        {[...reasons, OTHER].map((item) => (
          <button
            key={item}
            onClick={() => setChoice(item)}
            className={classNames(
              "w-full text-left rounded-xl border px-3.5 py-2.5 text-[13.5px] font-medium transition flex items-center gap-2.5",
              choice === item ? "border-red-300 bg-red-50 text-red-800" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            )}
          >
            <span className={classNames("size-4 shrink-0 rounded-full border-2", choice === item ? "border-red-600 bg-red-600 shadow-[inset_0_0_0_2px_white]" : "border-zinc-300")} />
            {item === OTHER ? "Write a reason" : item}
          </button>
        ))}
      </div>

      {choice === OTHER && <input autoFocus value={customReason} maxLength={150} onChange={(event) => setCustomReason(event.target.value)} placeholder="Type the reason" className={`${inputClass} mt-2 h-10`} />}

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <button onClick={onClose} className="h-11 rounded-xl border border-zinc-200 text-[14px] font-semibold text-zinc-700 hover:bg-zinc-50 transition">
          Cancel
        </button>
        <button onClick={block} disabled={!reason} className="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[14px] font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-40">
          Block
        </button>
      </div>
    </Modal>
  );
}
