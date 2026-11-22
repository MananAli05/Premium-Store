"use client";

import { useRef } from "react";
import { botMessageGroups, defaultBotMessages } from "@/lib/botMessages";
import type { EditableSettings } from "@/lib/store/admin";
import { limits } from "@/lib/validation";
import type { MenuLockTexts } from "@/lib/types";
import type { UpdateDraft } from "../useSettingsDraft";
import { Group, PopupTag, Row } from "./ui";

export type PageProps = {
  draft: EditableSettings;
  updateDraft: UpdateDraft;
  open: (page: Page) => void;
};

export type Page = {
  title: string;
  subtitle?: string;
  render: (props: PageProps) => React.ReactNode;
};

export type TextField = {
  label: string;
  hint?: string;
  dot?: string;
  variables?: string[];
  fallback?: string;
  lines?: boolean;
  get: (draft: EditableSettings) => string;
  set: (draft: EditableSettings, value: string) => void;
};

export const listField = (get: (draft: EditableSettings) => string[], set: (draft: EditableSettings, value: string[]) => void) => ({
  lines: true,
  get: (draft: EditableSettings) => get(draft).join("\n"),
  set: (draft: EditableSettings, value: string) => set(draft, value.split("\n")),
});

export function botMessageFields(title: string): TextField[] {
  const group = botMessageGroups.find((item) => item.title === title);
  return (group?.fields ?? []).map((field): TextField => ({
    label: field.label,
    variables: ["{timer}", "{hours}", "{back_in}", ...(field.variables?.split(" ") ?? [])],
    fallback: defaultBotMessages[field.key],
    get: (draft) => draft.settings.messages[field.key],
    set: (draft, value) => (draft.settings.messages[field.key] = value),
  }));
}

export function editorPage(field: TextField, subtitle?: string): Page {
  return { title: "Edit message", subtitle, render: (props) => <TextEditor field={field} {...props} /> };
}

export const isPopup = (field: TextField) => /pop-up/i.test(`${field.label} ${field.hint ?? ""}`);

export function menuLockField(key: keyof MenuLockTexts, label: string, hint: string): TextField {
  return { label, hint, get: (draft) => draft.settings.menuLock[key], set: (draft, value) => (draft.settings.menuLock[key] = value) };
}

export function messagesPage(title: string, fields: TextField[], subtitle?: string): Page {
  return { title, subtitle, render: (props) => <MessageList title={title} fields={fields} {...props} /> };
}

function MessageList({ title, fields, draft, open }: PageProps & { title: string; fields: TextField[] }) {
  return (
    <Group title="Tap a message to edit it">
      {fields.map((field) => {
        const text = field.get(draft).trim();
        return (
          <Row
            key={field.label}
            dot={field.dot}
            title={field.label}
            sub={field.lines ? text.split("\n").filter(Boolean).join(" · ") || "Empty" : text || field.fallback || "Empty"}
            preview
            end={isPopup(field) ? <PopupTag /> : undefined}
            onClick={() => open(editorPage(field, title))}
          />
        );
      })}
    </Group>
  );
}

function TextEditor({ field, draft, updateDraft }: PageProps & { field: TextField }) {
  const box = useRef<HTMLTextAreaElement>(null);
  const value = field.get(draft);

  const insert = (variable: string) => {
    const element = box.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    updateDraft((next) => field.set(next, value.slice(0, start) + variable + value.slice(end)));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + variable.length, start + variable.length);
    });
  };

  return (
    <div className="rounded-[20px] bg-white p-3.5 shadow-[0_10px_26px_-22px_rgba(12,38,96,0.55)]">
      <div className="flex items-center gap-2 text-[13px] font-bold text-zinc-900">
        {field.dot && <span className={`size-2 rounded-full ${field.dot}`} />}
        {field.label}
      </div>
      {(field.hint || field.lines) && <p className="mt-1 text-[12px] text-zinc-500">{field.hint ?? "One per line."}</p>}

      <textarea
        ref={box}
        rows={field.lines ? 7 : 6}
        maxLength={limits.longTextMax}
        value={value}
        placeholder={field.fallback}
        onChange={(event) => updateDraft((next) => field.set(next, event.target.value))}
        className="mt-3 w-full rounded-2xl border border-zinc-200 bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-[#0C2660] focus:ring-4 focus:ring-[#0C2660]/10"
      />

      {field.variables && field.variables.length > 0 && (
        <>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-zinc-400">Tap to add</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {field.variables.map((variable) => (
              <button key={variable} onClick={() => insert(variable)} className="rounded-lg bg-amber-50 px-2.5 py-1 font-mono text-[12px] font-semibold text-amber-800">
                {variable}
              </button>
            ))}
          </div>
        </>
      )}

      {field.fallback && value !== field.fallback && (
        <button onClick={() => updateDraft((next) => field.set(next, field.fallback ?? ""))} className="mt-3 text-[12.5px] font-semibold text-zinc-500">
          Use the default text
        </button>
      )}
    </div>
  );
}
