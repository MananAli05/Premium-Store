"use client";

import { classNames } from "@/lib/format";
import { setAdminStatus } from "@/lib/store/admin";
import { useAppState } from "@/lib/store/state";
import type { AdminStatus } from "@/lib/types";
import { editorPage, menuLockField, messagesPage, type PageProps, type TextField } from "./pages";
import { Group, PopupTag, Row, SwitchRow } from "./ui";

const statuses: { status: AdminStatus; label: string; description: string; dot: string }[] = [
  { status: "active", label: "Active", description: "Orders and support work normally", dot: "bg-emerald-500" },
  { status: "away", label: "Away", description: "Orders taken, no new support", dot: "bg-amber-400" },
  { status: "away_closed", label: "Away · closed", description: "No new orders or support", dot: "bg-orange-500" },
  { status: "offline", label: "Offline", description: "No new orders or support", dot: "bg-zinc-400" },
];

const dots: Record<AdminStatus, string> = { active: "bg-emerald-500", away: "bg-amber-400", away_closed: "bg-orange-500", offline: "bg-zinc-400" };
const orderVariables = ["{hours}", "{back_in}", "{timer}"];

const orderFields: TextField[] = [
  { status: "active" as const, label: "Active · after the screenshot", hint: "Shown after the payment screenshot is sent." },
  { status: "away" as const, label: "Away · after the screenshot", hint: "Shown after the payment screenshot is sent." },
  { status: "away_closed" as const, label: "Away · closed · pop-up on Buy", hint: "Pop-up when the customer taps Buy." },
  { status: "offline" as const, label: "Offline · pop-up on Buy", hint: "Pop-up when the customer taps Buy." },
].map(({ status, label, hint }): TextField => ({
  label,
  hint,
  dot: dots[status],
  variables: orderVariables,
  get: (draft) => draft.settings.statusMessages[status],
  set: (draft, value) => (draft.settings.statusMessages[status] = value),
}));

const supportFields: TextField[] = [
  {
    label: "Active · after a request",
    hint: "Shown after a support request is sent.",
    dot: dots.active,
    variables: ["{ticket_id}"],
    get: (draft) => draft.settings.supportMessages.active,
    set: (draft, value) => (draft.settings.supportMessages.active = value),
  },
  {
    label: "Away · after a request",
    hint: "Shown after a support request is sent.",
    dot: dots.away,
    variables: ["{ticket_id}"],
    get: (draft) => draft.settings.supportMessages.away,
    set: (draft, value) => (draft.settings.supportMessages.away = value),
  },
  {
    label: "Away · closed · pop-up on Other issues",
    hint: "Pop-up when the customer taps Other issues.",
    dot: dots.away_closed,
    get: (draft) => draft.settings.supportClosedMessages.away_closed,
    set: (draft, value) => (draft.settings.supportClosedMessages.away_closed = value),
  },
  {
    label: "Offline · pop-up on Other issues",
    hint: "Pop-up when the customer taps Other issues.",
    dot: dots.offline,
    get: (draft) => draft.settings.supportClosedMessages.offline,
    set: (draft, value) => (draft.settings.supportClosedMessages.offline = value),
  },
];

const closedTitle = menuLockField("closedTitle", "Closed menu · title", "Pop-up title when a closed button is tapped while you are Away · closed or Offline.");

export default function AvailabilitySection({ draft, updateDraft, open }: PageProps) {
  const state = useAppState();
  const { hours } = draft.settings;

  return (
    <>
      <Group title="Your status · changes instantly" plain>
        <div className="grid grid-cols-2 gap-2 p-2.5">
          {statuses.map((item) => {
            const selected = state.settings.status === item.status;
            return (
              <button
                key={item.status}
                onClick={() => setAdminStatus(item.status)}
                className={classNames("rounded-2xl p-2.5 text-left transition", selected ? "bg-[#0C2660] text-white" : "bg-[#f3f5fa] text-zinc-900")}
              >
                <span className="flex items-center gap-1.5 text-[13px] font-bold">
                  <span className={`size-2 rounded-full ${item.dot}`} />
                  {item.label}
                </span>
                <span className={classNames("block mt-0.5 text-[11px] leading-snug", selected ? "text-white/70" : "text-zinc-500")}>{item.description}</span>
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Working hours">
        <div className="grid grid-cols-2 gap-2 p-2.5">
          {(["start", "end"] as const).map((key) => (
            <label key={key} className="rounded-2xl bg-[#f3f5fa] px-3 py-2">
              <span className="block text-[11px] font-semibold text-zinc-500">{key === "start" ? "Opens" : "Closes"}</span>
              <input
                type="time"
                value={hours[key]}
                onChange={(event) => updateDraft((next) => (next.settings.hours[key] = event.target.value))}
                className="w-full bg-transparent text-[18px] font-bold text-[#0C2660] outline-none"
              />
            </label>
          ))}
        </div>
        <SwitchRow title="Go offline outside these hours" on={hours.enforce} onChange={(value) => updateDraft((next) => (next.settings.hours.enforce = value))} />
      </Group>

      <Group title="Messages">
        <Row title="Order messages" sub="What buyers see for each status" count={4} onClick={() => open(messagesPage("Order messages", orderFields, "Availability"))} />
        <Row title="Support messages" sub="After a request, and when closed" count={4} onClick={() => open(messagesPage("Support messages", supportFields, "Availability"))} />
        <Row title="Closed menu title" sub="When you are Away · closed or Offline" end={<PopupTag />} onClick={() => open(editorPage(closedTitle, "Availability"))} />
      </Group>
    </>
  );
}
