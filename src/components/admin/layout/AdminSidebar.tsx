"use client";

import { Bot, Inbox, LayoutDashboard, Settings } from "lucide-react";
import { classNames } from "@/lib/format";
import { useAppState } from "@/lib/store/state";
import { countInboxTabs } from "../inbox/inboxItems";
import type { Navigate, Section } from "../navigation";

type AdminSidebarProps = {
  current: Section;
  onNavigate: Navigate;
  onSignOut: () => void;
};

export default function AdminSidebar({ current, onNavigate, onSignOut }: AdminSidebarProps) {
  const state = useAppState();
  const inboxCounts = countInboxTabs(state);

  const items: { section: Section; label: string; icon: React.ReactNode; count?: number }[] = [
    { section: "dashboard", label: "Home", icon: <LayoutDashboard size={17} /> },
    { section: "inbox", label: "Inbox", icon: <Inbox size={17} />, count: inboxCounts.pending + inboxCounts.issues },
    { section: "bot", label: "Bot chat", icon: <Bot size={17} /> },
    { section: "settings", label: "Settings", icon: <Settings size={17} /> },
  ];

  const customerUrl = process.env.NEXT_PUBLIC_CUSTOMER_URL || "/";
  const linkClass = "w-full flex items-center gap-3 h-10 px-3 rounded-lg text-[13.5px] hover:bg-white/[0.06] hover:text-white";

  return (
    <div className="h-full flex flex-col bg-[linear-gradient(180deg,#0c2660_0%,#061639_100%)] text-white/75">
      <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10">
        <img src="/logo-wordmark.png" alt="Premium Store" className="h-8 w-auto select-none" draggable={false} />
        <span className="ml-auto text-[10.5px] uppercase tracking-[0.14em] text-white/50 font-semibold">Admin</span>
      </div>

      <nav className="p-3 space-y-0.5 flex-1">
        {items.map((item) => (
          <button
            key={item.section}
            onClick={() => onNavigate({ section: item.section })}
            className={classNames(
              "w-full flex items-center gap-3 h-10 px-3 rounded-lg text-[13.5px] transition",
              current === item.section || (item.section === "dashboard" && current === "customers") ? "bg-white/[0.12] text-white font-medium shadow-[inset_3px_0_0_#C9A45C]" : "hover:bg-white/[0.06] hover:text-white"
            )}
          >
            {item.icon}
            <span className="flex-1 text-left">{item.label}</span>
            {!!item.count && <span className="text-[11px] font-semibold bg-[#C9A45C] text-[#1a1406] rounded-full min-w-5 h-5 px-1.5 grid place-items-center">{item.count}</span>}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10 space-y-0.5">
        <a href={customerUrl} target="_blank" className={linkClass}>
          Open customer chat
        </a>
        <button onClick={onSignOut} className={linkClass}>
          Sign out
        </button>
      </div>
    </div>
  );
}
