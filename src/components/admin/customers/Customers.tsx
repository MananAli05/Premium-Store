"use client";

import { useState } from "react";
import { ArrowLeft, Search, Users } from "lucide-react";
import { useNow } from "@/hooks/useNow";
import { timeAgo } from "@/lib/format";
import { customerNumberLabel } from "@/lib/store/helpers";
import { useAppState } from "@/lib/store/state";
import type { Navigate } from "../navigation";
import Badge from "../ui/Badge";
import { Card } from "../ui/Card";
import EmptyState from "../ui/EmptyState";
import WhatsAppLink from "../ui/WhatsAppLink";
import BlockCustomerButton from "./BlockCustomerButton";
import { inputClass } from "../ui/styles";

const rowGrid = "grid grid-cols-[2.6rem_minmax(0,1fr)_2.3rem_6.4rem] md:grid-cols-[6rem_13rem_8rem_7.75rem] xl:grid-cols-[7rem_14rem_9rem_7.75rem] items-center gap-x-1.5 md:gap-x-4 xl:gap-x-10";

export default function Customers({ onNavigate }: { onNavigate: Navigate }) {
  const state = useAppState();
  const now = useNow(30_000);
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();

  const rows = state.customers
    .filter((customer) => !search || customer.email.includes(search) || customer.whatsapp?.includes(search) || customerNumberLabel(customer).includes(search))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);

  return (
    <div className="h-full">
      <div className="h-full max-w-[1200px] mx-auto md:w-fit p-3 md:p-4 lg:p-7 flex flex-col gap-5">
        <div className="shrink-0 flex flex-wrap items-end justify-between gap-3">
          <div>
            <button
              onClick={() => onNavigate({ section: "dashboard" })}
              className="mb-3 inline-flex items-center gap-1.5 h-9 pl-2.5 pr-3.5 rounded-xl bg-[#0C2660] text-white text-[13px] font-semibold shadow-[0_6px_16px_-8px_rgba(12,38,96,0.6)] hover:bg-[#0a1f52] active:scale-[0.98] transition"
            >
              <ArrowLeft size={16} /> Home
            </button>
            <h1 className="text-[22px] font-semibold tracking-tight">Customer list</h1>
            <p className="text-[13.5px] text-zinc-500 mt-0.5">{state.customers.length} customers. Each one sees only their own chat.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="WhatsApp, email or ID" className={`${inputClass} pl-8`} />
          </div>
        </div>

        <Card className="overflow-hidden flex-1 min-h-0 flex flex-col md:w-fit md:max-w-full md:self-start">
          {rows.length === 0 ? (
            <EmptyState icon={<Users size={20} />} title="No customers found" />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className={`${rowGrid} sticky top-0 z-10 px-2.5 md:px-5 py-2.5 text-white text-[12px] md:text-[13px] font-medium bg-[linear-gradient(90deg,#0c2660_0%,#14327a_100%)]`}>
                <span>ID</span>
                <span>WhatsApp</span>
                <span>
                  <span className="md:hidden">Active</span>
                  <span className="hidden md:inline">Last active</span>
                </span>
                <span className="pl-1.5 md:pl-0">Actions</span>
              </div>
              <ul className="divide-y divide-zinc-200">
                {rows.map((customer) => (
                  <li key={customer.id} className={`${rowGrid} px-2.5 md:px-5 py-2.5 hover:bg-zinc-50/70`}>
                    <div className="min-w-0 flex flex-col md:flex-row md:items-center items-start gap-0.5 md:gap-2">
                      <span className="font-bold text-[#0C2660] tabular-nums text-[12.5px] md:text-[13px]">{customerNumberLabel(customer)}</span>
                      {customer.blocked && (
                        <>
                          <span className="md:hidden text-[10px] font-bold text-red-600">Blocked</span>
                          <span className="hidden md:inline-flex">
                            <Badge tone="red">Blocked</Badge>
                          </span>
                        </>
                      )}
                    </div>
                    <div className="min-w-0 truncate text-[12.5px] md:text-[13px]">
                      {customer.whatsapp ? <WhatsAppLink number={customer.whatsapp} /> : <span className="text-zinc-400">Not added</span>}
                    </div>
                    <span className="text-[12px] md:text-[13px] text-zinc-500 whitespace-nowrap">
                      <span className="md:hidden">{timeAgo(customer.lastSeenAt, now).replace(" ago", "")}</span>
                      <span className="hidden md:inline">{timeAgo(customer.lastSeenAt, now)}</span>
                    </span>
                    <div className="flex items-center gap-1 pl-1.5 md:pl-0">
                      <button
                        onClick={() => onNavigate({ section: "bot", customerId: customer.id })}
                        className="h-8 px-2 md:px-3 rounded-lg border border-zinc-200 bg-white text-[12.5px] font-medium text-zinc-800 hover:bg-zinc-50 transition"
                      >
                        Chat
                      </button>
                      <BlockCustomerButton customer={customer} compact />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
