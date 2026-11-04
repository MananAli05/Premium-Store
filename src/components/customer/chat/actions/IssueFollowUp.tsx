"use client";

import { useState } from "react";
import { sendIssueFollowUp } from "@/lib/store/customer";
import { limits, validateMessage } from "@/lib/validation";
import ImagePicker from "../ImagePicker";
import { primaryButtonClass } from "./buttonStyles";

export default function IssueFollowUp({ customerId }: { customerId: string }) {
  const [text, setText] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    const problem = validateMessage(text, 1, limits.messageMax);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    const failed = await sendIssueFollowUp(customerId, text.trim(), screenshot ?? undefined);
    if (!failed) return;
    setBusy(false);
    setError(failed);
  };

  return (
    <div className="max-w-[560px] mx-auto space-y-2.5">
      <textarea
        autoFocus
        value={text}
        maxLength={limits.messageMax}
        onChange={(event) => {
          setText(event.target.value);
          setError("");
        }}
        placeholder="Tell us what is still not working. You can send one message, then wait for our reply."
        rows={3}
        className="w-full resize-none rounded-2xl bg-[var(--surface)] border border-[var(--line)] px-4 py-3 text-[14.5px] outline-none focus:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] placeholder:text-[#9aa1ab]"
      />
      {error && <div className="text-[12px] text-red-600">{error}</div>}

      {showPicker ? (
        <ImagePicker image={screenshot} onChange={setScreenshot} label="Attach a screenshot (optional)" />
      ) : (
        <button onClick={() => setShowPicker(true)} className="text-[13px] font-medium text-[var(--accent)] flex items-center gap-1.5">
          Attach a screenshot (optional)
        </button>
      )}

      <button onClick={send} disabled={busy} className={`${primaryButtonClass} disabled:opacity-50`}>
        {busy ? "Sending…" : "Send to our team"}
      </button>
    </div>
  );
}
