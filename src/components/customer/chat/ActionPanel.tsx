"use client";

import { useNow } from "@/hooks/useNow";
import { findMenuLock, findOpenTicket } from "@/lib/store/customer";
import { canStillPay, findOrderMethod, getActiveOrder } from "@/lib/store/helpers";
import { getState } from "@/lib/store/state";
import type { Conversation } from "@/lib/types";
import type { OpenSheet } from "./ChatScreen";
import BackToMenuButton from "./actions/BackToMenuButton";
import ClosingOrderNotice from "./actions/ClosingOrderNotice";
import CodeDeliveredActions from "./actions/CodeDeliveredActions";
import IssueComposer from "./actions/IssueComposer";
import IssueFollowUp from "./actions/IssueFollowUp";
import IssueStatus from "./actions/IssueStatus";
import MenuOptions from "./actions/MenuOptions";
import MethodOptions from "./actions/MethodOptions";
import MissingOrderNotice from "./actions/MissingOrderNotice";
import PaymentActions from "./actions/PaymentActions";
import PendingOrderNotice from "./actions/PendingOrderNotice";
import PlanOptions from "./actions/PlanOptions";
import RejectionReply from "./actions/RejectionReply";
import SupportOptions from "./actions/SupportOptions";
import TermsActions from "./actions/TermsActions";

type ActionPanelProps = {
  customerId: string;
  conversation: Conversation;
  onOpenSheet: (sheet: OpenSheet) => void;
};

export default function ActionPanel({ customerId, conversation, onOpenSheet }: ActionPanelProps) {
  return (
    <div className="border-t border-[var(--line)] bg-[var(--surface)] px-4 md:px-8 pt-3 pb-4 md:pt-4 md:pb-5 rise-in max-h-[52%] overflow-y-auto">
      <div className="max-w-[860px] mx-auto">
        <StageActions customerId={customerId} conversation={conversation} onOpenSheet={onOpenSheet} />
      </div>
    </div>
  );
}

function AwaitingPaymentActions({ customerId, onOpenSheet }: Omit<ActionPanelProps, "conversation">) {
  const now = useNow(1000);
  const order = getActiveOrder(getState(), customerId);
  if (order?.status === "pending_review") return <PendingOrderNotice customerId={customerId} />;
  if (order?.status === "awaiting_payment" && !canStillPay(order, now)) return <ClosingOrderNotice />;
  if (!order && getState().conversations[customerId]?.activeOrderId) return <MissingOrderNotice customerId={customerId} />;
  if (!order || !canStillPay(order, now)) return <BackToMenuButton customerId={customerId} />;
  return <PaymentActions customerId={customerId} method={findOrderMethod(getState(), customerId)} onOpenSheet={onOpenSheet} />;
}

// Steps that start from the menu close with it (store closed, or a payment or request waiting for the admin).
const MENU_STEPS = ["support", "choose_plan", "choose_method", "terms"];

function StageActions({ customerId, conversation, onOpenSheet }: ActionPanelProps) {
  const target = conversation.stage === "support" ? "support" : "buy";
  if (MENU_STEPS.includes(conversation.stage) && findMenuLock(getState(), customerId, target)) return <MenuOptions customerId={customerId} />;
  switch (conversation.stage) {
    case "menu":
      return <MenuOptions customerId={customerId} />;
    case "choose_plan":
      return <PlanOptions customerId={customerId} />;
    case "choose_method":
      return <MethodOptions customerId={customerId} />;
    case "terms":
      return <TermsActions customerId={customerId} />;
    case "awaiting_payment":
      return <AwaitingPaymentActions customerId={customerId} onOpenSheet={onOpenSheet} />;
    case "support":
      return <SupportOptions customerId={customerId} />;
    case "support_other":
      return <IssueComposer customerId={customerId} />;
    case "rejected":
      return <RejectionReply customerId={customerId} />;
    case "waiting_agent":
      return <IssueStatus customerId={customerId} agentReplied={false} />;
    case "agent_replied":
      return <IssueStatus customerId={customerId} agentReplied />;
    case "code_delivered":
      return <CodeDeliveredActions customerId={customerId} />;
    case "live": {
      // No free typing while a request or an order is waiting for the admin.
      const state = getState();
      if (findOpenTicket(state, customerId)) return <IssueFollowUp customerId={customerId} />;
      const pendingOrder = state.orders.find((order) => order.customerId === customerId && (order.status === "pending_review" || order.status === "rejected"));
      if (pendingOrder) return <PendingOrderNotice customerId={customerId} />;
      // Messages the admin sends from the inbox are read-only for the customer.
      return <BackToMenuButton customerId={customerId} />;
    }
  }
}
