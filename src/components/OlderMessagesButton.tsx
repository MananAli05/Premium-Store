"use client";

import { useEffect, useState } from "react";
import { hasOlderChat, loadOlderChat } from "@/lib/supabase/sync";

export default function OlderMessagesButton({ customerId, className = "" }: { customerId: string; className?: string }) {
  const [shownFor, setShownFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let current = true;
    hasOlderChat(customerId).then((found) => {
      if (current && found) setShownFor(customerId);
    });
    return () => {
      current = false;
    };
  }, [customerId]);

  if (shownFor !== customerId) return null;

  const show = async () => {
    setLoading(true);
    const loaded = await loadOlderChat(customerId);
    setLoading(false);
    if (loaded) setShownFor(null);
  };

  return (
    <div className="flex justify-center py-2">
      <button
        type="button"
        onClick={show}
        disabled={loading}
        className={`h-8 px-4 rounded-full text-[12.5px] font-semibold border transition disabled:opacity-60 ${className}`}
      >
        {loading ? "Loading…" : "Show older messages"}
      </button>
    </div>
  );
}
