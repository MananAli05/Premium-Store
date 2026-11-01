"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { usePresence } from "@/hooks/usePresence";
import { textColorFor } from "@/lib/format";
import { ensureCustomerProfile, signOut } from "@/lib/store/customer";
import { useAppState } from "@/lib/store/state";
import { startSync, stopSync } from "@/lib/supabase/sync";
import ConfirmDialog from "../ConfirmDialog";
import SyncNotice from "../SyncNotice";
import AuthScreen from "./AuthScreen";
import Sidebar from "./Sidebar";
import WhatsAppScreen from "./WhatsAppScreen";
import ChatScreen from "./chat/ChatScreen";

export default function CustomerApp() {
  const state = useAppState();
  const isDesktop = useIsDesktop();
  const { user, checking } = useAuthUser("customer");
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const customer = user ? state.customers.find((item) => item.id === user.id) : undefined;

  const hadProfile = useRef(false);

  useEffect(() => {
    if (!user) return;
    hadProfile.current = false;
    startSync("customer").then(() => ensureCustomerProfile(user));
  }, [user]);

  // The session ended: the next sign-in starts a fresh load.
  useEffect(() => {
    if (!user && !checking) void stopSync();
  }, [user, checking]);

  useEffect(() => {
    if (customer) {
      hadProfile.current = true;
      return;
    }
    if (user && hadProfile.current) {
      hadProfile.current = false;
      signOut().then(stopSync);
    }
  }, [customer, user]);

  useEffect(() => {
    if (customer?.blocked) signOut().then(stopSync);
  }, [customer?.blocked]);

  usePresence(customer?.id);

  const handleSignOut = async () => {
    await signOut();
    await stopSync();
    setConfirmingSignOut(false);
  };
  const askToSignOut = () => setConfirmingSignOut(true);

  const accent = state.settings.accent;
  const themeStyle = { ["--accent" as string]: accent, ["--accent-ink" as string]: textColorFor(accent) };

  return (
    <div className="customer-app min-h-dvh w-full bg-[var(--page)] flex" style={themeStyle}>
      {checking || (user && !customer) || customer?.blocked ? (
        <LoadingScreen />
      ) : customer && !customer.whatsapp ? (
        <WhatsAppScreen customerId={customer.id} onSignOut={askToSignOut} />
      ) : customer ? (
        <div className="flex-1 flex h-dvh md:p-4 lg:p-5">
          <div className="relative flex-1 flex max-w-[1440px] mx-auto bg-[var(--bg)] md:rounded-3xl md:border md:border-[var(--line)] md:shadow-[0_24px_60px_-28px_rgba(15,23,42,0.28)] overflow-hidden">
            {isDesktop && <Sidebar customer={customer} onSignOut={askToSignOut} />}
            <ChatScreen customer={customer} onSignOut={isDesktop ? undefined : askToSignOut} />
          </div>
        </div>
      ) : (
        <AuthScreen />
      )}
      <SyncNotice />
      {confirmingSignOut && (
        <ConfirmDialog
          title="Sign out?"
          message="Your chat and codes stay saved. Log in again with your email and PIN anytime."
          confirmLabel="Sign out"
          onConfirm={handleSignOut}
          onCancel={() => setConfirmingSignOut(false)}
        />
      )}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex-1 grid place-items-center">
      <div className="flex flex-col items-center gap-3 text-[var(--muted)] text-[14px]">
        <img src="/logo-icon.png" alt="Premium Store" className="size-14 rounded-2xl animate-pulse" />
        Loading your chat…
      </div>
    </div>
  );
}
