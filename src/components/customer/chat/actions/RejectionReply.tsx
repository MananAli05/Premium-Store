"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { repliesLeftAfterRejection, sendRejectionReply } from "@/lib/store/customer";
import { useAppState } from "@/lib/store/state";
import { limits, validateMessage } from "@/lib/validation";
import ImagePicker from "../ImagePicker";
import BackToMenuButton from "./BackToMenuButton";
import { primaryButtonClass } from "./buttonStyles";

export default function RejectionReply({ customerId }: { customerId: string }) {
  const state = useAppState();
  const [text, setText] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (repliesLeftAfterRejection(state, customerId) === 0) {
    return (
      <div className="max-w-[560px] mx-auto">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3.5 text-[13.5px] leading-snug text-amber-900">
          <Clock size={17} className="shrink-0 mt-0.5 text-amber-700" />
          {state.settings.waitForAdminMessage}
        </div>
        <BackToMenuButton customerId={customerId} />
      </div>
    );
  }

  const send = async () => {
    const problem = validateMessage(text, limits.issueMin, limits.messageMax);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    const failed = await sendRejectionReply(customerId, text.trim(), screenshot ?? undefined);
    setBusy(false);
    if (failed) {
      setError(failed);
      return;
    }
    setText("");
    setScreenshot(null);
    setShowPicker(false);
  };

  return (
    <div className="max-w-[560px] mx-auto space-y-2.5">
      <div className="text-[13.5px] font-semibold">Describe your side</div>
      <textarea
        autoFocus
        value={text}
        maxLength={limits.messageMax}
        onChange={(event) => {
          setText(event.target.value);
          setError("");
        }}
        placeholder="Explain what happened with your payment."
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
