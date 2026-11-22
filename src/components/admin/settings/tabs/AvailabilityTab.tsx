import { classNames } from "@/lib/format";
import { setAdminStatus } from "@/lib/store/admin";
import { useAppState } from "@/lib/store/state";
import type { AdminStatus } from "@/lib/types";
import Toggle from "../../ui/Toggle";
import { inputClass } from "../../ui/styles";
import type { SettingsTabProps } from "../settingsTabs";
import { MenuLockSection, OrderMessagesSection, SupportMessagesSection } from "../MessageSections";
import { Field, SettingsSection } from "../SettingsSection";

const statuses: { status: AdminStatus; label: string; description: string; dot: string }[] = [
  { status: "active", label: "Active", description: "Orders and support work normally", dot: "bg-emerald-500" },
  { status: "away", label: "Away (accepting)", description: "Orders are taken and checked when you're back. No new support requests", dot: "bg-amber-400" },
  { status: "away_closed", label: "Away (not accepting)", description: "No new orders or support requests", dot: "bg-orange-500" },
  { status: "offline", label: "Offline", description: "No new orders or support requests", dot: "bg-zinc-400" },
];

export default function AvailabilityTab({ draft, updateDraft }: SettingsTabProps) {
  const state = useAppState();
  const { hours } = draft.settings;

  return (
    <>
      <SettingsSection title="Your status" description="Switches instantly. The dot on your profile picture in the top bar shows the current status.">
        <div className="grid sm:grid-cols-2 gap-2">
          {statuses.map((item) => (
            <button
              key={item.status}
              type="button"
              onClick={() => setAdminStatus(item.status)}
              className={classNames(
                "rounded-xl border p-3.5 text-left transition",
                state.settings.status === item.status ? "border-[#0C2660] ring-4 ring-[#0C2660]/10" : "border-zinc-200 hover:border-zinc-300"
              )}
            >
              <div className="flex items-center gap-2 text-[14px] font-semibold">
                <span className={`size-2 rounded-full ${item.dot}`} />
                {item.label}
              </div>
              <div className="text-[12.5px] text-zinc-500 mt-1">{item.description}</div>
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Working hours" description="When subscriptions can be bought.">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Opens">
            <div className="w-36">
              <input type="time" value={hours.start} onChange={(event) => updateDraft((draft) => (draft.settings.hours.start = event.target.value))} className={inputClass} />
            </div>
          </Field>
          <Field label="Closes">
            <div className="w-36">
              <input type="time" value={hours.end} onChange={(event) => updateDraft((draft) => (draft.settings.hours.end = event.target.value))} className={inputClass} />
            </div>
          </Field>
          <div className="pb-2">
            <Toggle on={hours.enforce} onChange={(value) => updateDraft((draft) => (draft.settings.hours.enforce = value))} label="Go offline automatically outside these hours" />
          </div>
        </div>
      </SettingsSection>
      <OrderMessagesSection draft={draft} updateDraft={updateDraft} />
      <SupportMessagesSection draft={draft} updateDraft={updateDraft} />
      <MenuLockSection part="closed" draft={draft} updateDraft={updateDraft} />
    </>
  );
}
