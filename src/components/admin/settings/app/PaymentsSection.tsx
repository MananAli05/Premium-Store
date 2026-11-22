"use client";

import { classNames, formatMoney } from "@/lib/format";
import { stepLines } from "@/lib/store/helpers";
import { cleanAccountNumber, cleanDigits, cleanIban, cleanLetters, cleanLettersAndDigits, limits } from "@/lib/validation";
import GuideStepsEditor from "../GuideStepsEditor";
import StepsEditor from "../StepsEditor";
import { botMessageFields, editorPage, listField, menuLockField, messagesPage, type Page, type PageProps, type TextField } from "./pages";
import { appInput, Group, InputField, Row, Switch, SwitchRow } from "./ui";

const paymentLockHint = "Shown above the menu and in the pop-up while the payment waits for you.";

const paymentLockFields: TextField[] = [
  menuLockField("pendingTitle", "Waiting for approval · title", paymentLockHint),
  menuLockField("pending", "Waiting for approval · message", paymentLockHint),
  menuLockField("rejectedTitle", "Payment rejected · title", paymentLockHint),
  menuLockField("rejected", "Payment rejected · message", paymentLockHint),
];

const subtitle = "Plans & payments";

const rejectFields: TextField[] = [
  {
    label: "Rejection message",
    variables: ["{reason}", "{order_id}"],
    get: (draft) => draft.settings.rejectionMessage,
    set: (draft, value) => (draft.settings.rejectionMessage = value),
  },
  {
    label: "Reasons to choose from",
    ...listField(
      (draft) => draft.settings.rejectReasons,
      (draft, value) => (draft.settings.rejectReasons = value)
    ),
  },
  {
    label: "Message while waiting for you",
    get: (draft) => draft.settings.waitForAdminMessage,
    set: (draft, value) => (draft.settings.waitForAdminMessage = value),
  },
];

const howItWorks: TextField = {
  label: "How does it work?",
  hint: "Shown when a customer taps How does it work? before ordering.",
  variables: ["{timer}"],
  get: (draft) => draft.settings.howItWorks,
  set: (draft, value) => (draft.settings.howItWorks = value),
};

const terms: TextField = {
  label: "Terms & conditions",
  hint: "Shown before every order. One rule per line.",
  variables: ["{timer}"],
  ...listField(
    (draft) => draft.settings.terms,
    (draft, value) => (draft.settings.terms = value)
  ),
};

function planPage(index: number): Page {
  return {
    title: "Plan",
    subtitle,
    render: ({ draft, updateDraft }) => {
      const plan = draft.plans[index];
      return (
        <Group>
          <InputField label="Name">
            <input value={plan.name} onChange={(event) => updateDraft((next) => (next.plans[index].name = cleanLettersAndDigits(event.target.value)))} className={appInput} />
          </InputField>
          <InputField label="Price (Rs)">
            <input
              value={String(plan.price)}
              inputMode="numeric"
              onChange={(event) => updateDraft((next) => (next.plans[index].price = Number(cleanDigits(event.target.value, 6)) || 0))}
              className={`${appInput} tabular-nums`}
            />
          </InputField>
          <SwitchRow title="Visible to customers" on={plan.active} onChange={(value) => updateDraft((next) => (next.plans[index].active = value))} />
        </Group>
      );
    },
  };
}

const bankPage: Page = {
  title: "Bank account",
  subtitle,
  render: ({ draft, updateDraft }) => {
    const { bank } = draft.settings;
    return (
      <>
        <Group>
          <InputField label="Bank name">
            <input value={bank.bankName} onChange={(event) => updateDraft((next) => (next.settings.bank.bankName = cleanLetters(event.target.value)))} className={appInput} />
          </InputField>
          <InputField label="Account title">
            <input value={bank.accountTitle} onChange={(event) => updateDraft((next) => (next.settings.bank.accountTitle = cleanLetters(event.target.value)))} className={appInput} />
          </InputField>
          <InputField label="Account number" hint={`${limits.accountNumberMin} to ${limits.accountNumberMax} digits`}>
            <input
              value={bank.accountNumber}
              inputMode="numeric"
              onChange={(event) => updateDraft((next) => (next.settings.bank.accountNumber = cleanAccountNumber(event.target.value)))}
              className={`${appInput} tabular-nums`}
            />
          </InputField>
          <InputField label="IBAN" hint="Shown only for the payment methods where you turn it on">
            <input
              value={bank.iban ?? ""}
              placeholder="PK36 SCBL 0000 0011 2345 6702"
              onChange={(event) => updateDraft((next) => (next.settings.bank.iban = cleanIban(event.target.value)))}
              className={`${appInput} tabular-nums uppercase`}
            />
          </InputField>
        </Group>
        <p className="px-2 pt-3 text-[12px] text-zinc-500">A change applies to new orders only. Orders already created keep the account they were shown.</p>
      </>
    );
  },
};

function methodPage(index: number): Page {
  return {
    title: "Payment method",
    subtitle,
    render: ({ draft, updateDraft }) => {
      const method = draft.methods[index];
      return (
        <>
          <Group>
            <InputField label="Name">
              <input value={method.name} onChange={(event) => updateDraft((next) => (next.methods[index].name = cleanLetters(event.target.value, 20)))} className={appInput} />
            </InputField>
            <SwitchRow title="Shown to customers" on={method.active} onChange={(value) => updateDraft((next) => (next.methods[index].active = value))} />
            <SwitchRow title="Show IBAN" sub="Adds the IBAN to these steps" on={Boolean(method.showIban)} onChange={(value) => updateDraft((next) => (next.methods[index].showIban = value))} />
          </Group>
          <Group title="Steps" plain>
            <div className="p-3.5">
              <p className="mb-3 text-[12px] text-zinc-500">
                Use <b className="font-mono text-amber-800">{"{bank}"}</b>, <b className="font-mono text-amber-800">{"{account}"}</b>, <b className="font-mono text-amber-800">{"{title}"}</b> and{" "}
                <b className="font-mono text-amber-800">{"{iban}"}</b> for the account of the order.
              </p>
              <StepsEditor value={method.steps} onChange={(steps) => updateDraft((next) => (next.methods[index].steps = steps))} />
            </div>
          </Group>
        </>
      );
    },
  };
}

const methodsPage: Page = {
  title: "Payment methods",
  subtitle,
  render: ({ draft, open }) => (
    <Group title="Tap a method to edit it">
      {draft.methods.map((method, index) => (
        <Row
          key={method.id}
          title={method.name || "No name"}
          sub={[method.active ? "Shown" : "Hidden", method.showIban ? "IBAN on" : "", `${stepLines(method.steps).length} steps`].filter(Boolean).join(" · ")}
          onClick={() => open(methodPage(index))}
        />
      ))}
    </Group>
  ),
};

function guidePage(title: string, key: "usageSteps" | "nextTimeSteps", hint: string): Page {
  return {
    title,
    subtitle,
    render: ({ draft, updateDraft }) => (
      <Group plain>
        <div className="p-3.5">
          <p className="mb-3 text-[12px] text-zinc-500">{hint}</p>
          <GuideStepsEditor steps={draft.settings[key]} onChange={(steps) => updateDraft((next) => (next.settings[key] = steps))} />
        </div>
      </Group>
    ),
  };
}

export default function PaymentsSection({ draft, updateDraft, open }: PageProps) {
  const { bank } = draft.settings;

  return (
    <>
      <Group title="Plans">
        {draft.plans.map((plan, index) => (
          <div key={plan.id} className="flex items-center gap-2.5 pr-3.5">
            <button onClick={() => open(planPage(index))} className="flex-1 min-w-0 flex items-center gap-2.5 py-3 pl-3.5 text-left">
              <span className="flex-1 min-w-0">
                <span className={classNames("block truncate text-[14px] font-bold", plan.active ? "text-zinc-900" : "text-zinc-400")}>{plan.name}</span>
                <span className="block text-[11.5px] text-zinc-500">{plan.active ? "Visible to customers" : "Hidden"}</span>
              </span>
              <span
                className={classNames(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[12.5px] font-bold tabular-nums",
                  plan.active ? "border-[#D4A551] bg-amber-50 text-[#0C2660]" : "border-zinc-200 text-zinc-400"
                )}
              >
                {formatMoney(plan.price)}
              </span>
            </button>
            <Switch on={plan.active} label={`Show ${plan.name}`} onChange={(value) => updateDraft((next) => (next.plans[index].active = value))} />
          </div>
        ))}
      </Group>

      <Group title="Getting paid">
        <Row title="Bank account" sub={`${bank.bankName} · •••• ${bank.accountNumber.slice(-4)}`} onClick={() => open(bankPage)} />
        <Row title="Payment methods" sub={draft.methods.map((method) => method.name).join(", ")} count={draft.methods.length} onClick={() => open(methodsPage)} />
      </Group>

      <Group title="Guides for customers">
        <Row title="How does it work?" sub="Answer before ordering" onClick={() => open(editorPage(howItWorks, subtitle))} />
        <Row
          title="How to use"
          sub="Steps on the code, each can have an image"
          count={draft.settings.usageSteps.length}
          onClick={() => open(guidePage("How to use", "usageSteps", "Steps the customer sees when they tap How to use on their code. Each step can have an image."))}
        />
        <Row
          title="Instructions for next time"
          sub="Steps on the code"
          count={draft.settings.nextTimeSteps.length}
          onClick={() => open(guidePage("Instructions for next time", "nextTimeSteps", "Steps the customer sees when they tap Instructions for next time on their code."))}
        />
      </Group>

      <Group title="Rules and messages">
        <Row title="Closed menu · payment" sub="While a payment waits for you" count={paymentLockFields.length} onClick={() => open(messagesPage("Closed menu · payment", paymentLockFields, subtitle))} />
        <Row title="Rejecting a payment" sub="Message, reasons, waiting message" count={3} onClick={() => open(messagesPage("Rejecting a payment", rejectFields, subtitle))} />
        <Row title="Terms & conditions" sub="Shown before every order" count={draft.settings.terms.filter((term) => term.trim()).length} onClick={() => open(editorPage(terms, subtitle))} />
        <Row title="Buying messages" sub="Choose a plan, a method, order created" count={4} onClick={() => open(messagesPage("Buying messages", botMessageFields("Buying"), subtitle))} />
        <Row
          title="Cancelled & paused"
          sub="Cancelled, paused, time ran out"
          count={5}
          onClick={() => open(messagesPage("Cancelled & paused", botMessageFields("Cancelled and paused orders"), subtitle))}
        />
      </Group>
    </>
  );
}
