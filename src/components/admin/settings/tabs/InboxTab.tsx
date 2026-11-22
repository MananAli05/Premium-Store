"use client";

import { limits } from "@/lib/validation";
import { textareaClass } from "../../ui/styles";
import QuickRepliesEditor from "../QuickRepliesEditor";
import type { SettingsTabProps } from "../settingsTabs";
import { Field, SettingsSection } from "../SettingsSection";

export default function InboxTab({ draft, updateDraft }: SettingsTabProps) {
  const { blocking } = draft.settings;

  return (
    <>
      <SettingsSection title="Quick replies" description="Ready-made replies you can send from the chat with the quick replies button next to the image button. Use the arrows to change the order.">
        <QuickRepliesEditor replies={draft.settings.quickReplies} onChange={(replies) => updateDraft((next) => (next.settings.quickReplies = replies))} />
      </SettingsSection>

      <SettingsSection title="Blocking" description="What a blocked customer sees, and the reasons you can pick when you block someone.">
        <div className="space-y-4">
          <Field label="Message for blocked customers" hint="The reason you choose is shown under it">
            <textarea rows={2} maxLength={limits.longTextMax} value={blocking.message} onChange={(event) => updateDraft((next) => (next.settings.blocking.message = event.target.value))} className={textareaClass} />
          </Field>
          <Field label="Message sent when you unblock a customer">
            <textarea rows={2} maxLength={limits.longTextMax} value={blocking.unblockMessage} onChange={(event) => updateDraft((next) => (next.settings.blocking.unblockMessage = event.target.value))} className={textareaClass} />
          </Field>
          <Field label="Block reasons" hint="One per line">
            <textarea rows={4} maxLength={limits.longTextMax} value={blocking.reasons.join("\n")} onChange={(event) => updateDraft((next) => (next.settings.blocking.reasons = event.target.value.split("\n")))} className={textareaClass} />
          </Field>
        </div>
      </SettingsSection>
    </>
  );
}
