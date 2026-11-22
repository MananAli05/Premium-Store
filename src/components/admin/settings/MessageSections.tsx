import { botMessageGroups, defaultBotMessages, type MessageTab } from "@/lib/botMessages";
import type { AdminStatus, MenuLockTexts } from "@/lib/types";
import { limits } from "@/lib/validation";
import { textareaClass } from "../ui/styles";
import type { SettingsTabProps } from "./settingsTabs";
import { Field, SettingsSection } from "./SettingsSection";

const orderMessageLabels: Record<AdminStatus, string> = {
  active: "Active: after the payment screenshot is sent",
  away: "Away (accepting): after the payment screenshot is sent",
  away_closed: "Away (not accepting): pop-up when the customer taps Buy",
  offline: "Offline: pop-up when the customer taps Buy",
};

const closedSupportLabels: Record<"away_closed" | "offline", string> = {
  away_closed: "Away (not accepting): pop-up when the customer taps Other issues",
  offline: "Offline: pop-up when the customer taps Other issues",
};

export function OrderMessagesSection({ draft, updateDraft }: SettingsTabProps) {
  const { statusMessages } = draft.settings;

  return (
    <SettingsSection title="Order messages" description="What the customer sees when buying, for each status. Use {hours}, {back_in} (time until you open) and {timer} as placeholders.">
      <div className="space-y-4">
        {(Object.keys(orderMessageLabels) as AdminStatus[]).map((status) => (
          <Field key={status} label={orderMessageLabels[status]}>
            <textarea rows={2} maxLength={limits.longTextMax} value={statusMessages[status]} onChange={(event) => updateDraft((next) => (next.settings.statusMessages[status] = event.target.value))} className={textareaClass} />
          </Field>
        ))}
      </div>
    </SettingsSection>
  );
}

export function SupportMessagesSection({ draft, updateDraft }: SettingsTabProps) {
  const { supportMessages, supportClosedMessages } = draft.settings;

  return (
    <SettingsSection title="Support messages" description="New support requests (Other issues) are taken while you are Active or Away (accepting). Common questions stay open in every status. The Away (not accepting) and Offline messages show in a pop-up when Other issues is tapped.">
      <div className="space-y-4">
        <Field label="Active: after a support request is sent" hint="Use {ticket_id} for the request number">
          <textarea rows={2} maxLength={limits.longTextMax} value={supportMessages.active} onChange={(event) => updateDraft((next) => (next.settings.supportMessages.active = event.target.value))} className={textareaClass} />
        </Field>
        <Field label="Away (accepting): after a support request is sent" hint="Use {ticket_id} for the request number">
          <textarea rows={2} maxLength={limits.longTextMax} value={supportMessages.away} onChange={(event) => updateDraft((next) => (next.settings.supportMessages.away = event.target.value))} className={textareaClass} />
        </Field>
        {(Object.keys(closedSupportLabels) as (keyof typeof closedSupportLabels)[]).map((status) => (
          <Field key={status} label={closedSupportLabels[status]}>
            <textarea rows={2} maxLength={limits.longTextMax} value={supportClosedMessages[status]} onChange={(event) => updateDraft((next) => (next.settings.supportClosedMessages[status] = event.target.value))} className={textareaClass} />
          </Field>
        ))}
      </div>
    </SettingsSection>
  );
}

type MenuLockPart = "payment" | "support" | "closed";

const menuLockFields: { key: keyof MenuLockTexts; part: MenuLockPart; label: string; long?: boolean }[] = [
  { key: "pendingTitle", part: "payment", label: "Payment sent, waiting for approval: pop-up title" },
  { key: "pending", part: "payment", label: "Payment sent, waiting for approval: pop-up message", long: true },
  { key: "rejectedTitle", part: "payment", label: "Payment rejected: pop-up title" },
  { key: "rejected", part: "payment", label: "Payment rejected: pop-up message", long: true },
  { key: "issueTitle", part: "support", label: "Support request open: pop-up title" },
  { key: "issue", part: "support", label: "Support request open: pop-up message", long: true },
  { key: "closedTitle", part: "closed", label: "Away (not accepting) or Offline: pop-up title" },
];

const menuLockText: Record<MenuLockPart, { title: string; description: string }> = {
  payment: {
    title: "Closed menu · payment",
    description: "Buy a Subscription and Customer Support close while a payment waits for you. The message shows above the menu and in the pop-up when a closed button is tapped.",
  },
  support: {
    title: "Closed menu · support",
    description: "Buy a Subscription and Customer Support close while a support request waits for you. The message shows above the menu and in the pop-up when a closed button is tapped.",
  },
  closed: {
    title: "Closed menu",
    description: "When you are Away (not accepting) or Offline, only Buy and Other issues close, with the order and support messages above.",
  },
};

export function MenuLockSection({ draft, updateDraft, part }: SettingsTabProps & { part: MenuLockPart }) {
  const { menuLock } = draft.settings;

  return (
    <SettingsSection title={menuLockText[part].title} description={menuLockText[part].description}>
      <div className="space-y-4">
        {menuLockFields.filter((field) => field.part === part).map((field) => (
          <Field key={field.key} label={field.label}>
            <textarea rows={field.long ? 2 : 1} maxLength={limits.longTextMax} value={menuLock[field.key]} onChange={(event) => updateDraft((next) => (next.settings.menuLock[field.key] = event.target.value))} className={textareaClass} />
          </Field>
        ))}
      </div>
    </SettingsSection>
  );
}

export function TermsSection({ draft, updateDraft }: SettingsTabProps) {
  return (
    <SettingsSection title="Terms & conditions" description="Shown before every order. One rule per line. Use {timer} for the payment timer.">
      <textarea rows={4} maxLength={limits.longTextMax} value={draft.settings.terms.join("\n")} onChange={(event) => updateDraft((next) => (next.settings.terms = event.target.value.split("\n")))} className={textareaClass} />
    </SettingsSection>
  );
}

export function BotMessageSections({ tab, draft, updateDraft }: SettingsTabProps & { tab: MessageTab }) {
  const { messages } = draft.settings;

  return (
    <>
      {botMessageGroups
        .filter((group) => group.tab === tab)
        .map((group) => (
          <SettingsSection key={group.title} title={group.title} description="Every message can use {timer}, {hours} and {back_in}.">
            <div className="space-y-4">
              {group.fields.map((field) => (
                <Field key={field.key} label={field.label} hint={field.variables}>
                  <textarea
                    rows={2}
                    maxLength={limits.longTextMax}
                    value={messages[field.key]}
                    placeholder={defaultBotMessages[field.key]}
                    onChange={(event) => updateDraft((next) => (next.settings.messages[field.key] = event.target.value))}
                    className={textareaClass}
                  />
                </Field>
              ))}
            </div>
          </SettingsSection>
        ))}
    </>
  );
}
