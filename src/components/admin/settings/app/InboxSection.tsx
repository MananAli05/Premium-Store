"use client";

import QuickRepliesEditor from "../QuickRepliesEditor";
import { editorPage, listField, messagesPage, type Page, type PageProps, type TextField } from "./pages";
import { Group, Row } from "./ui";

const subtitle = "Inbox & blocking";

const blockFields: TextField[] = [
  {
    label: "Message for blocked customers",
    hint: "The reason you choose is shown under it.",
    get: (draft) => draft.settings.blocking.message,
    set: (draft, value) => (draft.settings.blocking.message = value),
  },
  {
    label: "Message when you unblock",
    get: (draft) => draft.settings.blocking.unblockMessage,
    set: (draft, value) => (draft.settings.blocking.unblockMessage = value),
  },
];

const reasons: TextField = {
  label: "Block reasons",
  hint: "The reasons you can pick when you block someone. One per line.",
  ...listField(
    (draft) => draft.settings.blocking.reasons,
    (draft, value) => (draft.settings.blocking.reasons = value)
  ),
};

const repliesPage: Page = {
  title: "Quick replies",
  subtitle,
  render: ({ draft, updateDraft }) => (
    <Group plain>
      <div className="p-3.5">
        <p className="mb-3 text-[12px] text-zinc-500">Ready-made replies you can send from the chat with the quick replies button.</p>
        <QuickRepliesEditor replies={draft.settings.quickReplies} onChange={(replies) => updateDraft((next) => (next.settings.quickReplies = replies))} />
      </div>
    </Group>
  ),
};


export default function InboxSection({ draft, open }: PageProps) {
  const { blocking, quickReplies } = draft.settings;

  return (
    <>
      <Group title="Quick replies">
        <Row title="Quick replies" sub={quickReplies.filter(Boolean).slice(0, 2).join(" · ") || "None yet"} count={quickReplies.length} onClick={() => open(repliesPage)} />
      </Group>

      <Group title="Blocking">
        <Row title="Block & unblock messages" sub="What the customer sees" count={2} onClick={() => open(messagesPage("Block & unblock messages", blockFields, subtitle))} />
        <div>
          <Row title="Block reasons" count={blocking.reasons.filter((reason) => reason.trim()).length} onClick={() => open(editorPage(reasons, subtitle))} />
          <div className="flex flex-wrap gap-1.5 px-3.5 pb-3.5">
          {blocking.reasons
            .filter((reason) => reason.trim())
            .map((reason) => (
              <span key={reason} className="rounded-full bg-red-50 px-2.5 py-1 text-[11.5px] font-semibold text-red-700">
                {reason}
              </span>
            ))}
          </div>
        </div>
      </Group>
    </>
  );
}
