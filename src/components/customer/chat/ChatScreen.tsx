"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useConnection } from "@/hooks/useConnection";
import { forgetPicking, pickingWasInterrupted } from "@/lib/pickingMemory";
import { markMessagesSeen, openChat } from "@/lib/store/customer";
import { findOrderMethod, keepsChat } from "@/lib/store/helpers";
import { useAppState } from "@/lib/store/state";
import { recordUploadProblem } from "@/lib/supabase/uploadProblems";
import type { Customer } from "@/lib/types";
import ActionPanel from "./ActionPanel";
import { CHAT_ROOT_ID } from "./chatRoot";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import PaymentStepsSheet from "./sheets/PaymentStepsSheet";
import PaymentProblemSheet from "./sheets/PaymentProblemSheet";
import UploadProofSheet from "./sheets/UploadProofSheet";

export type OpenSheet = "proof" | "issue" | "steps" | null;

type ChatScreenProps = {
  customer: Customer;
  onSignOut?: () => void;
};

export default function ChatScreen({ customer, onSignOut }: ChatScreenProps) {
  const state = useAppState();
  const [pageReloaded] = useState(() => pickingWasInterrupted(customer.id));
  const [sheet, setSheet] = useState<OpenSheet>(pageReloaded ? "proof" : null);
  const conversation = state.conversations[customer.id];
  const messages = state.messages.filter((message) => message.customerId === customer.id);
  const orderMethod = findOrderMethod(state, customer.id);
  const { online, waiting } = useConnection();

  useEffect(() => {
    openChat(customer.id);
  }, [customer.id]);

  useEffect(() => {
    if (!pageReloaded) return;
    forgetPicking();
    recordUploadProblem("page reloaded while the picker was open");
  }, [pageReloaded]);

  useEffect(() => {
    if (document.visibilityState === "visible") markMessagesSeen(customer.id);
  }, [customer.id, messages.length]);

  // Coming back to the tab or the app also counts as seeing the admin's messages.
  useEffect(() => {
    const markSeen = () => {
      if (document.visibilityState === "visible") markMessagesSeen(customer.id);
    };
    document.addEventListener("visibilitychange", markSeen);
    window.addEventListener("focus", markSeen);
    return () => {
      document.removeEventListener("visibilitychange", markSeen);
      window.removeEventListener("focus", markSeen);
    };
  }, [customer.id]);

  if (!conversation) return null;

  return (
    <section id={CHAT_ROOT_ID} className="relative flex-1 min-w-0 flex flex-col">
      <ChatHeader typing={conversation.typing} keepsChat={keepsChat(state, customer.id)} onSignOut={onSignOut} />
      {!online && (
        <div role="status" className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-[13px] bg-amber-50 text-amber-900 border-b border-amber-200">
          <WifiOff size={14} className="shrink-0" />
          No internet. Your messages will be sent when you are back online.
        </div>
      )}
      <MessageList messages={messages} typing={conversation.typing} stage={conversation.stage} keepsChat={keepsChat(state, customer.id)} />

      {waiting ? (
        <div className="shrink-0 px-4 py-4 text-center text-[13.5px] text-[var(--muted)] border-t border-[var(--line)]">Waiting for the internet to continue…</div>
      ) : (
        !conversation.typing && <ActionPanel customerId={customer.id} conversation={conversation} onOpenSheet={setSheet} />
      )}

      {sheet === "proof" && <UploadProofSheet customerId={customer.id} pageReloaded={pageReloaded} onClose={() => setSheet(null)} />}
      {sheet === "issue" && <PaymentProblemSheet onClose={() => setSheet(null)} />}
      {sheet === "steps" && orderMethod && <PaymentStepsSheet customerId={customer.id} method={orderMethod} onClose={() => setSheet(null)} />}
    </section>
  );
}
