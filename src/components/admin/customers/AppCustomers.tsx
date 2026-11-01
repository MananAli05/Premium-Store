"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { useNow } from "@/hooks/useNow";
import { useShowMore } from "@/hooks/useShowMore";
import { openOutsideApp } from "@/lib/appMode";
import { timeAgo } from "@/lib/format";
import { customerNumberLabel } from "@/lib/store/helpers";
import { useAppState } from "@/lib/store/state";
import { whatsAppLink } from "@/lib/validation";
import AppSectionHeader from "../inbox/AppSectionHeader";
import CategoryChips, { type Chip } from "../inbox/CategoryChips";
import { isCustomerActive, lastActivityAt } from "../inbox/inboxItems";
import type { Navigate } from "../navigation";
import CustomerAvatar from "../ui/CustomerAvatar";
import EmptyState from "../ui/EmptyState";
import WhatsAppIcon from "../ui/WhatsAppIcon";
import BlockCustomerButton from "./BlockCustomerButton";

type Filter = "all" | "active" | "blocked";

export default function AppCustomers({ onNavigate }: { onNavigate: Navigate }) {
  const state = useAppState();
  const now = useNow(30_000);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const words = query.trim().toLowerCase();

  const activity = new Map(state.customers.map((customer) => [customer.id, lastActivityAt(state, customer.id)]));
  const lastActive = (id: string) => activity.get(id) ?? 0;
  const customers = [...state.customers].sort((a, b) => lastActive(b.id) - lastActive(a.id));
  const active = customers.filter((customer) => isCustomerActive(state, customer.id, now));
  const blocked = customers.filter((customer) => customer.blocked);
  const lists: Record<Filter, typeof customers> = { all: customers, active, blocked };

  const chips: Chip<Filter>[] = [
    { key: "all", label: "All", count: customers.length },
    { key: "active", label: "Active now", count: active.length, dot: "bg-[#22c55e]" },
    { key: "blocked", label: "Blocked", count: blocked.length, dot: "bg-red-500" },
  ];

  const rows = lists[filter].filter(
    (customer) => !words || customer.email.toLowerCase().includes(words) || customer.whatsapp?.includes(words) || customerNumberLabel(customer).toLowerCase().includes(words)
  );

  const { visible, sentinel, hasMore } = useShowMore(rows, `${filter}-${words}`);

  return (
    <div className="h-full flex flex-col">
      <AppSectionHeader title="Customers" query={query} onQueryChange={setQuery} placeholder="WhatsApp, email or ID" onBack={() => onNavigate({ section: "dashboard" })}>
        <p className="mt-0.5 text-[12px] text-zinc-500">{customers.length} customers · each one sees only their own chat</p>
        <CategoryChips chips={chips} selected={filter} onSelect={setFilter} />
      </AppSectionHeader>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {rows.length === 0 ? (
          <EmptyState icon={<Users size={20} />} title="No customers found" description={words ? "No match for your search." : undefined} />
        ) : (
          <ul className="rounded-3xl bg-white py-1 shadow-[0_10px_30px_-24px_rgba(12,38,96,0.55)] divide-y divide-zinc-100">
            {visible.map((customer) => (
              <li key={customer.id} className="flex items-start gap-2.5 px-3 py-2.5">
                <CustomerAvatar customerId={customer.id} size={44} />
                <div className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="shrink-0 rounded-[5px] bg-[#0C2660]/[0.07] px-1.5 py-px text-[10.5px] font-bold text-[#0C2660]">{customerNumberLabel(customer)}</span>
                    {customer.whatsapp ? (
                      <a href={whatsAppLink(customer.whatsapp)} onClick={openOutsideApp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[13.5px] font-semibold text-zinc-900 whitespace-nowrap">
                        <WhatsAppIcon size={13} />
                        {customer.whatsapp}
                      </a>
                    ) : (
                      <span className="text-[13px] font-medium text-zinc-400">No WhatsApp</span>
                    )}
                  </span>
                  <div className="mt-0.5 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-[11.5px] text-zinc-500">{customer.email}</span>
                      {isCustomerActive(state, customer.id, now) ? (
                        <span className="block text-[11px] font-semibold text-emerald-600">Active now</span>
                      ) : (
                        <span className="block text-[11px] text-zinc-400">{timeAgo(lastActive(customer.id), now)}</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button onClick={() => onNavigate({ section: "bot", customerId: customer.id })} className="h-[30px] px-3 rounded-full bg-[#eef1f7] text-[12px] font-semibold text-[#0C2660]">
                        Chat
                      </button>
                      <BlockCustomerButton customer={customer} pill />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {hasMore && <div ref={sentinel} className="h-10" />}
      </div>
    </div>
  );
}
