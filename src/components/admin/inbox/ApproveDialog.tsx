"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { planMismatch } from "@/lib/planCheck";
import { approveOrder, findCodeAlreadySent } from "@/lib/store/admin";
import type { Order } from "@/lib/types";
import { cleanCode, extractCode, limits, validateCode } from "@/lib/validation";
import Modal from "../ui/Modal";
import { textareaClass } from "../ui/styles";

type ApproveDialogProps = {
  order: Order;
  customerEmail: string;
  onClose: () => void;
};

export default function ApproveDialog({ order, customerEmail, onClose }: ApproveDialogProps) {
  const [message, setMessage] = useState("");
  const [typedCode, setTypedCode] = useState("");

  const foundCode = extractCode(message);
  const codeFound = !validateCode(foundCode);
  const code = codeFound ? foundCode : typedCode;
  const codeProblem = message.trim() ? validateCode(code) : null;
  const duplicate = code && !codeProblem ? findCodeAlreadySent(code) : null;
  const wrongPlan = planMismatch(message, order.planName);
  const canApprove = Boolean(message.trim()) && !codeProblem && !duplicate && !wrongPlan;

  const approve = () => {
    if (!canApprove) return;
    approveOrder(order.id, message, code);
    onClose();
  };

  return (
    <Modal title="Approve payment" description={`${order.id} · ${order.planName} · ${customerEmail}`} onClose={onClose}>
      <label className="block">
        <span className="text-[13px] font-medium text-zinc-700">Code message</span>
        <textarea
          autoFocus
          rows={6}
          value={message}
          maxLength={limits.longTextMax}
          onChange={(event) => {
            setMessage(event.target.value);
          }}
          placeholder="Paste the message from your portal"
          className={`${textareaClass} mt-1.5 max-h-[20dvh] text-[14px]`}
        />
      </label>
      {message.trim() && codeFound && <p className="mt-1.5 text-[12px] text-zinc-500">Code found: {code}</p>}
      {message.trim() && !codeFound && (
        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="text-[12.5px] font-medium text-red-700">No code found, please type the code</p>
          <input
            value={typedCode}
            onChange={(event) => {
              setTypedCode(cleanCode(event.target.value));
              }}
            placeholder={`${limits.codeLength}-character code`}
            className="mt-2 w-full h-10 rounded-lg border border-red-200 bg-white px-3 text-[14px] font-semibold tracking-wider outline-none focus:border-red-400"
          />
        </div>
      )}

      {wrongPlan && (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] text-red-700">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{wrongPlan}</span>
        </div>
      )}

      {duplicate && (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] text-red-700">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>
            Code {duplicate.code} was already sent to {duplicate.customerEmail} on {formatDateTime(duplicate.sentAt)}. A code can only be sent once, please use a new code.
          </span>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <button onClick={onClose} className="h-11 rounded-xl border border-zinc-200 text-[14px] font-semibold text-zinc-700 hover:bg-zinc-50 transition">
          Cancel
        </button>
        <button
          onClick={approve}
          disabled={!canApprove}
          className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[14px] font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-40"
        >
          Approve & send
        </button>
      </div>
    </Modal>
  );
}
