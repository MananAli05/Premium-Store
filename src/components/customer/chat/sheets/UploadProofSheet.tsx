"use client";

import { useState } from "react";
import { useNow } from "@/hooks/useNow";
import { formatCountdown } from "@/lib/format";
import { submitPaymentProof } from "@/lib/store/customer";
import { getActiveOrder } from "@/lib/store/helpers";
import { useAppState } from "@/lib/store/state";
import { cleanLetters } from "@/lib/validation";
import ImagePicker from "../ImagePicker";
import Sheet from "./Sheet";

type UploadProofSheetProps = {
  customerId: string;
  pageReloaded: boolean;
  onClose: () => void;
};

export default function UploadProofSheet({ customerId, pageReloaded, onClose }: UploadProofSheetProps) {
  const state = useAppState();
  const now = useNow(1000);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [senderName, setSenderName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [failedUploads, setFailedUploads] = useState(0);

  const order = getActiveOrder(state, customerId);
  if (!order) return null;

  const updateSenderName = (value: string) => {
    setSenderName(cleanLetters(value));
    setError("");
  };

  const submit = async () => {
    if (!screenshot) {
      setError("Please attach your payment screenshot.");
      return;
    }

    setBusy(true);
    const problem = await submitPaymentProof(customerId, screenshot, senderName);
    setBusy(false);

    if (problem) {
      setError(problem);
      setFailedUploads((count) => count + 1);
    } else {
      onClose();
    }
  };

  return (
    <Sheet title="Upload payment screenshot" subtitle={`Order ${order.id} · Rs ${order.amount.toLocaleString()} · ${formatCountdown(order.expiresAt - now)} left`} onClose={onClose}>
      <ImagePicker image={screenshot} onChange={setScreenshot} failedUploads={failedUploads} customerId={customerId} pageReloaded={pageReloaded} />

      <label className="block mt-4">
        <span className="text-[13px] font-medium">Please enter your sender name, not a bank name</span>
        <input
          value={senderName}
          onChange={(event) => updateSenderName(event.target.value)}
          placeholder="e.g. Usman"
          className="mt-1.5 w-full h-12 rounded-xl bg-[var(--bg)] border border-[var(--line)] px-4 text-[15px] outline-none focus:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] placeholder:text-[#9aa1ab]"
        />
      </label>

      {error && <div className="mt-3 text-[13px] text-red-700 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}

      <button onClick={submit} disabled={busy} className="mt-5 w-full h-12 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] font-semibold text-[15px] disabled:opacity-60">
        {busy ? "Uploading…" : "Submit for verification"}
      </button>
    </Sheet>
  );
}
