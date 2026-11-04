"use client";

import { useEffect, useState } from "react";
import { LogOut, type LucideIcon } from "lucide-react";

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  icon?: LucideIcon;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
};

export default function ConfirmDialog({ title, message, confirmLabel, cancelLabel = "Cancel", icon: Icon = LogOut, onConfirm, onCancel }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onCancel();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  const confirm = async () => {
    setBusy(true);
    await onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-[#061639]/50 backdrop-blur-[2px] fade-in" onClick={onCancel} />
      <div className="relative w-full max-w-[380px] rounded-3xl bg-white p-6 text-center shadow-[0_30px_80px_-20px_rgba(6,22,57,0.45)] rise-in">
        <div className="mx-auto size-14 rounded-2xl bg-red-50 text-red-600 grid place-items-center">
          <Icon size={24} />
        </div>
        <h2 id="confirm-title" className="mt-4 text-[19px] font-bold text-zinc-900">
          {title}
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-500">{message}</p>
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <button autoFocus onClick={onCancel} className="h-11 rounded-xl border border-zinc-200 text-[14px] font-semibold text-zinc-700 hover:bg-zinc-50 transition">
            {cancelLabel}
          </button>
          <button onClick={confirm} disabled={busy} className="h-11 rounded-xl bg-red-600 text-white text-[14px] font-semibold hover:bg-red-700 transition disabled:opacity-60">
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
