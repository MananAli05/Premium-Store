import { cleanLetters, limits } from "@/lib/validation";
import Toggle from "../../ui/Toggle";
import { inputClass, textareaClass } from "../../ui/styles";
import type { SettingsTabProps } from "../settingsTabs";
import { Field, SettingsSection } from "../SettingsSection";
import { BotMessageSections, MenuLockSection } from "../MessageSections";
import FaqsSection from "./FaqsSection";

export default function SupportTab({ draft, updateDraft }: SettingsTabProps) {
  const { settings } = draft;
  const { support } = settings;

  return (
    <>
      <SettingsSection title="Welcome" description="The first thing customers see when they open the chat.">
        <div className="space-y-4">
          <Field label="Store name">
            <input value={settings.storeName} onChange={(event) => updateDraft((next) => (next.settings.storeName = cleanLetters(event.target.value)))} className={inputClass} />
          </Field>
          <Field label="Welcome message">
            <textarea rows={2} maxLength={limits.longTextMax} value={settings.welcome} onChange={(event) => updateDraft((next) => (next.settings.welcome = event.target.value))} className={textareaClass} />
          </Field>
          <Field label="When a customer comes back">
            <textarea rows={2} maxLength={limits.longTextMax} value={settings.messages.welcomeBack} onChange={(event) => updateDraft((next) => (next.settings.messages.welcomeBack = event.target.value))} className={textareaClass} />
          </Field>
          <Field label="Main menu">
            <textarea rows={2} maxLength={limits.longTextMax} value={settings.messages.menuPrompt} onChange={(event) => updateDraft((next) => (next.settings.messages.menuPrompt = event.target.value))} className={textareaClass} />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection title="Support requests" description="How a support or payment problem request behaves after the customer sends it.">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Button to keep the request open">
              <input value={support.stillFacingLabel} maxLength={30} onChange={(event) => updateDraft((next) => (next.settings.support.stillFacingLabel = event.target.value))} className={inputClass} />
            </Field>
            <Field label="Button to close the request">
              <input value={support.resolvedLabel} maxLength={30} onChange={(event) => updateDraft((next) => (next.settings.support.resolvedLabel = event.target.value))} className={inputClass} />
            </Field>
          </div>
          <div className="space-y-2.5 pt-1">
            <Toggle on={support.issueScreenshotRequired} onChange={(value) => updateDraft((next) => (next.settings.support.issueScreenshotRequired = value))} label="Screenshot required for Other issues" />
          </div>
        </div>
      </SettingsSection>

      <BotMessageSections tab="support" draft={draft} updateDraft={updateDraft} />
      <MenuLockSection part="support" draft={draft} updateDraft={updateDraft} />

      <FaqsSection draft={draft} updateDraft={updateDraft} />
    </>
  );
}
