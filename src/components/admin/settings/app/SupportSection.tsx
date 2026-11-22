"use client";

import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { classNames, createId } from "@/lib/format";
import { cleanLetters, limits } from "@/lib/validation";
import { botMessageFields, menuLockField, messagesPage, type Page, type PageProps, type TextField } from "./pages";
import { appInput, Group, InputField, Row, SwitchRow } from "./ui";

const requestLockHint = "Shown above the menu and in the pop-up while a request waits for you.";

const requestLockFields: TextField[] = [
  menuLockField("issueTitle", "Request open · title", requestLockHint),
  menuLockField("issue", "Request open · message", requestLockHint),
];

const subtitle = "Support";

const welcomeFields: TextField[] = [
  { label: "Welcome message", hint: "The first thing customers see when they open the chat.", get: (draft) => draft.settings.welcome, set: (draft, value) => (draft.settings.welcome = value) },
  {
    label: "When a customer comes back",
    get: (draft) => draft.settings.messages.welcomeBack,
    set: (draft, value) => (draft.settings.messages.welcomeBack = value),
  },
  { label: "Main menu", get: (draft) => draft.settings.messages.menuPrompt, set: (draft, value) => (draft.settings.messages.menuPrompt = value) },
];

const storeNamePage: Page = {
  title: "Store name",
  subtitle,
  render: ({ draft, updateDraft }) => (
    <Group>
      <InputField label="Store name">
        <input value={draft.settings.storeName} onChange={(event) => updateDraft((next) => (next.settings.storeName = cleanLetters(event.target.value)))} className={appInput} />
      </InputField>
    </Group>
  ),
};

const buttonsPage: Page = {
  title: "Request buttons",
  subtitle,
  render: ({ draft, updateDraft }) => (
    <>
      <Group>
        <InputField label="Button to keep the request open">
          <input value={draft.settings.support.stillFacingLabel} maxLength={30} onChange={(event) => updateDraft((next) => (next.settings.support.stillFacingLabel = event.target.value))} className={appInput} />
        </InputField>
        <InputField label="Button to close the request">
          <input value={draft.settings.support.resolvedLabel} maxLength={30} onChange={(event) => updateDraft((next) => (next.settings.support.resolvedLabel = event.target.value))} className={appInput} />
        </InputField>
      </Group>
      <p className="px-2 pt-3 text-[12px] text-zinc-500">The customer sees these two buttons after you answer a support or payment problem request.</p>
    </>
  ),
};

export default function SupportSection({ draft, updateDraft, open }: PageProps) {
  const { support } = draft.settings;
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const addQuestion = () => {
    const id = createId();
    updateDraft((next) => {
      next.faqs.push({ id, question: "", answer: "" });
    });
    setOpenFaq(id);
  };

  return (
    <>
      <Group title="Welcome">
        <Row title="Store name" value={draft.settings.storeName} onClick={() => open(storeNamePage)} />
        <Row title="Welcome messages" sub="First visit, coming back, main menu" count={3} onClick={() => open(messagesPage("Welcome messages", welcomeFields, subtitle))} />
      </Group>

      <Group title="Support requests">
        <Row title="Request buttons" sub={`${support.stillFacingLabel} · ${support.resolvedLabel}`} onClick={() => open(buttonsPage)} />
        <SwitchRow
          title="Screenshot required for Other issues"
          on={support.issueScreenshotRequired}
          onChange={(value) => updateDraft((next) => (next.settings.support.issueScreenshotRequired = value))}
        />
        <Row title="Support messages" sub="Open, other issues, resolved, closed" count={5} onClick={() => open(messagesPage("Support messages", botMessageFields("Support"), subtitle))} />
        <Row title="Closed menu · support" sub="While a request waits for you" count={requestLockFields.length} onClick={() => open(messagesPage("Closed menu · support", requestLockFields, subtitle))} />
      </Group>

      <Group title={`FAQs · ${draft.faqs.length}`} action={{ label: "+ Add", onClick: addQuestion }}>
        {draft.faqs.map((faq, index) => {
          const expanded = openFaq === faq.id;
          return (
            <div key={faq.id}>
              <button onClick={() => setOpenFaq(expanded ? null : faq.id)} className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left">
                <span className="size-6 shrink-0 rounded-full bg-[#0C2660] text-white text-[11px] font-bold grid place-items-center">{index + 1}</span>
                <span className={classNames("flex-1 min-w-0 text-[13.5px] font-semibold", faq.question ? "text-zinc-900" : "text-zinc-400")}>{faq.question || "New question"}</span>
                <ChevronDown size={16} className={classNames("shrink-0 text-zinc-400 transition", expanded && "rotate-180")} />
              </button>
              {expanded && (
                <div className="space-y-2 px-3.5 pb-3.5 pl-[48px]">
                  <input
                    value={faq.question}
                    maxLength={limits.questionMax}
                    placeholder="Question"
                    onChange={(event) => updateDraft((next) => (next.faqs[index].question = event.target.value))}
                    className={`${appInput} font-semibold`}
                  />
                  <textarea
                    rows={3}
                    maxLength={limits.longTextMax}
                    value={faq.answer}
                    placeholder="Answer"
                    onChange={(event) => updateDraft((next) => (next.faqs[index].answer = event.target.value))}
                    className={`${appInput} h-auto py-2.5 leading-relaxed`}
                  />
                  <button
                    onClick={() => updateDraft((next) => void next.faqs.splice(index, 1))}
                    className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-red-600"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </Group>
    </>
  );
}
