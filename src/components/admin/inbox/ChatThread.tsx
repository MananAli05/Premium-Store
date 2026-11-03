"use client";

import { useLayoutEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { useFloatingDay } from "@/hooks/useFloatingDay";
import { useNow } from "@/hooks/useNow";
import { chatDayLabel, classNames, pakistanDay } from "@/lib/format";
import { customerNumberLabel, customerTitle } from "@/lib/store/helpers";
import { customerMessages } from "@/lib/store/messageIndex";
import { useAppState } from "@/lib/store/state";
import OlderMessagesButton from "@/components/OlderMessagesButton";
import type { Message } from "@/lib/types";
import CustomerAvatar from "../ui/CustomerAvatar";
import { isCustomerActive } from "./inboxItems";
import ReplyBox from "./ReplyBox";
import ThreadMessage from "./ThreadMessage";

const GROUP_GAP_MS = 5 * 60_000;

type ChatThreadProps = {
  customerId: string;
  onBack: () => void;
  onShowDetails: () => void;
};

function endsGroup(message: Message, next?: Message) {
  if (!next) return true;
  return next.sender !== message.sender || next.createdAt - message.createdAt > GROUP_GAP_MS || pakistanDay(next.createdAt) !== pakistanDay(message.createdAt);
}

export default function ChatThread({ customerId, onBack, onShowDetails }: ChatThreadProps) {
  const state = useAppState();
  const now = useNow(30_000);
  const scrollRef = useRef<HTMLDivElement>(null);
  const floatingDay = useFloatingDay();
  const customer = state.customers.find((item) => item.id === customerId);
  const conversation = state.conversations[customerId];
  const messages = customerMessages(state, customerId);
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, customerId]);

  if (!customer || !conversation) return null;
  const active = isCustomerActive(state, customerId, now);

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[#f7f8fa] overflow-hidden lg:rounded-2xl lg:border lg:border-zinc-200/70 lg:shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
      <div className="h-16 shrink-0 bg-white border-b border-zinc-200/80 flex items-center gap-3 px-3 lg:px-6">
        <button onClick={onBack} className="lg:hidden size-11 shrink-0 rounded-full bg-white text-[#0C2660] shadow-[0_6px_18px_-10px_rgba(12,38,96,0.45)] ring-1 ring-zinc-100 grid place-items-center" aria-label="Back">
          <ChevronLeft size={22} strokeWidth={2.4} />
        </button>
        <CustomerAvatar customerId={customer.id} size={46} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold text-zinc-900 truncate">
            {customerTitle(customer)}
          </div>
          <div className="text-[12px] text-zinc-500 truncate">
            {customerNumberLabel(customer)} · {active ? "Active now" : "Away from chat"}
          </div>
        </div>
        <button onClick={onShowDetails} className="xl:hidden h-9 px-3 flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-zinc-600 hover:bg-zinc-100" aria-label="Show details">
          Details
        </button>
      </div>

      <div ref={scrollRef} onScroll={floatingDay.onScroll} className="flex-1 overflow-y-auto px-4 lg:px-10 py-6">
        <div className="sticky top-0 z-10 h-0 flex justify-center pointer-events-none">
          <span className={classNames("-mt-3 transition-opacity duration-300", floatingDay.visible ? "opacity-100" : "opacity-0")}>
            <DayLabel label={floatingDay.label} />
          </span>
        </div>
        <div className="max-w-[760px] mx-auto">
          <OlderMessagesButton customerId={customerId} className="bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50" />
          {messages.length === 0 && <div className="text-center text-[12.5px] text-zinc-400 py-10">No messages yet.</div>}
          {messages.map((message, index) => {
            const last = endsGroup(message, messages[index + 1]);
            const previous = messages[index - 1];
            const newDay = !previous || pakistanDay(previous.createdAt) !== pakistanDay(message.createdAt);
            return (
              <div key={message.id} className={last ? "mb-4" : "mb-1"}>
                {newDay && <DayDivider label={chatDayLabel(message.createdAt, now)} />}
                <ThreadMessage message={message} showMeta={last} />
              </div>
            );
          })}
          {conversation.typing && <div className="text-[12px] text-zinc-400 text-right pr-1">Auto-reply typing…</div>}
        </div>
      </div>

      <ReplyBox customerId={customerId} />
    </div>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div data-day={label} className="flex justify-center my-4">
      <DayLabel label={label} />
    </div>
  );
}

function DayLabel({ label }: { label: string }) {
  return <span className="block text-[11.5px] font-semibold text-zinc-500 bg-white border border-zinc-200/80 rounded-full px-3 py-1 shadow-[0_1px_2px_rgba(16,24,40,0.06)]">{label}</span>;
}
