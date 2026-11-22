import { Clock, CreditCard, Inbox, LifeBuoy, Palette, Timer } from "lucide-react";
import type { EditableSettings } from "@/lib/store/admin";
import AppearanceTab from "./tabs/AppearanceTab";
import AvailabilityTab from "./tabs/AvailabilityTab";
import InboxTab from "./tabs/InboxTab";
import PaymentsTab from "./tabs/PaymentsTab";
import SupportTab from "./tabs/SupportTab";
import TimersTab from "./tabs/TimersTab";
import type { UpdateDraft } from "./useSettingsDraft";

export type SettingsTabProps = {
  draft: EditableSettings;
  updateDraft: UpdateDraft;
};

export const settingsTabs = [
  { key: "availability", label: "Availability", description: "Status, working hours, closed message", Icon: Clock },
  { key: "payments", label: "Plans & payments", description: "Plans, prices, payment methods", Icon: CreditCard },
  { key: "support", label: "Support", description: "Welcome, support requests, FAQs", Icon: LifeBuoy },
  { key: "inbox", label: "Inbox & blocking", description: "Quick replies, block messages and reasons", Icon: Inbox },
  { key: "timers", label: "Timers & limits", description: "Order time, cooldowns, cancels", Icon: Timer },
  { key: "appearance", label: "Appearance", description: "Chatbot colour", Icon: Palette },
] as const;

export type SettingsTabKey = (typeof settingsTabs)[number]["key"];

export function SettingsTabContent({ tab, draft, updateDraft }: SettingsTabProps & { tab: SettingsTabKey }) {
  if (tab === "availability") return <AvailabilityTab draft={draft} updateDraft={updateDraft} />;
  if (tab === "payments") return <PaymentsTab draft={draft} updateDraft={updateDraft} />;
  if (tab === "support") return <SupportTab draft={draft} updateDraft={updateDraft} />;
  if (tab === "inbox") return <InboxTab draft={draft} updateDraft={updateDraft} />;
  if (tab === "timers") return <TimersTab draft={draft} updateDraft={updateDraft} />;
  return <AppearanceTab draft={draft} updateDraft={updateDraft} />;
}

export function SettingsErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
      <div className="font-semibold mb-1">Please fix these before saving:</div>
      <ul className="list-disc pl-5 space-y-0.5">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
