"use client";

import { formatDate } from "@/lib/format";
import { customerNumberLabel, customerTitle } from "@/lib/store/helpers";
import { useAppState } from "@/lib/store/state";
import CustomerAvatar from "../ui/CustomerAvatar";
import WhatsAppLink from "../ui/WhatsAppLink";
import BlockCustomerButton from "../customers/BlockCustomerButton";
import OrderReview from "./OrderReview";
import TicketCard from "./TicketCard";

export default function CustomerPanel({ customerId }: { customerId: string }) {
  const state = useAppState();
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) return null;

  const orders = state.orders.filter((order) => order.customerId === customerId).sort((a, b) => b.createdAt - a.createdAt);
  const completed = orders.filter((order) => order.status === "completed");
  const pending = orders.filter((order) => order.status === "pending_review" || order.status === "rejected");
  const customerTickets = state.tickets.filter((ticket) => ticket.customerId === customerId);
  const tickets = customerTickets.filter((ticket) => ticket.status === "open");
  const issuesResolved = customerTickets.filter((ticket) => ticket.status === "resolved").length;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-3.5 pt-1">
        <CustomerAvatar customerId={customer.id} size={72} />
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-[5px] bg-[#0C2660]/[0.07] px-1.5 py-px text-[11px] font-bold text-[#0C2660]">{customerNumberLabel(customer)}</span>
          {customer.whatsapp && <div className="mt-1"><WhatsAppLink number={customer.whatsapp} className="text-[14px]" /></div>}
          <div className="mt-0.5 truncate text-[13px] text-zinc-700">{customer.email}</div>
          <div className="text-[11.5px] text-zinc-400">Customer since {formatDate(customer.createdAt)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Completed orders" value={String(completed.length)} />
        <Stat label="Issues resolved" value={String(issuesResolved)} />
      </div>

      {[...pending, ...completed].map((order) => (
        <OrderReview key={order.id + order.status} order={order} customerEmail={customerTitle(customer)} />
      ))}

      {tickets.map((ticket) => (
        <TicketCard key={ticket.id} ticket={ticket} />
      ))}

      {customer.blocked && (
        <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700">
          <span className="font-semibold">{customer.blockDevice ? "Blocked + device:" : "Blocked:"}</span> {customer.blockReason ?? "No reason given"}
        </div>
      )}

      <BlockCustomerButton customer={customer} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f5f6f8] px-3.5 py-3">
      <div className="text-[17px] font-bold text-zinc-900">{value}</div>
      <div className="text-[11.5px] text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
}
