"use client";

import { useState } from "react";
import { Lock, ShieldCheck, Timer, Zap } from "lucide-react";
import { classNames } from "@/lib/format";
import SecretInput from "@/components/SecretInput";
import { NO_INTERNET_MESSAGE, isOnline } from "@/lib/store/connection";
import { checkEmailStatus, findBlockReason, requestPinReset, signIn, signUp } from "@/lib/store/customer";
import { cleanDigits, cleanEmail, limits, validateEmail, validatePin, validateWhatsApp } from "@/lib/validation";

type Step = "email" | "login" | "create" | "forgot";

const features = [
  { icon: <Zap size={17} />, title: "Code in minutes", text: "Pay, upload proof, get your code right in the chat." },
  { icon: <ShieldCheck size={17} />, title: "Private & secure", text: "Only you can see your chat and payment details." },
  { icon: <Timer size={17} />, title: "Auto-deleted in 15 days", text: "Your chat is cleared after 15 days for your privacy." },
];

const titles: Record<Step, { heading: string; text: string; button: string }> = {
  email: { heading: "Welcome", text: "Enter your email to sign in or create your account. We'll check which one you need.", button: "Continue" },
  login: { heading: "Welcome back", text: "Enter your 6-digit PIN to open your chat.", button: "Sign in" },
  create: { heading: "Create your PIN", text: "You're new here! Choose a 6-digit PIN. You'll use it every time you sign in, so remember it.", button: "Create account" },
  forgot: { heading: "Reset your PIN", text: "We'll email you a link to set a new PIN.", button: "Send reset link" },
};

const inputClass =
  "mt-1.5 w-full h-12 rounded-xl bg-[var(--bg)] border border-[var(--line)] px-4 text-[15.5px] outline-none placeholder:text-[#9aa1ab] focus:bg-[var(--surface)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_12%,transparent)] transition";

const pinClass = classNames(inputClass, "tracking-[0.3em]");

function blockedMessage(reason: string) {
  return reason ? `This email is blocked. Reason: ${reason}` : "This email is blocked.";
}

export default function AuthScreen() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const goTo = (next: Step) => {
    setStep(next);
    setPin("");
    setConfirmPin("");
    setError("");
    setNotice("");
  };

  const validate = () => {
    if (step === "email" || step === "forgot") return validateEmail(email);
    const pinProblem = validatePin(pin);
    if (pinProblem) return pinProblem;
    if (step === "create" && pin !== confirmPin) return "The two PINs do not match.";
    if (step === "create") return validateWhatsApp(whatsapp);
    return null;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice("");
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    // Signing in, creating an account and resetting the PIN need the server.
    if (!isOnline()) {
      setError(NO_INTERNET_MESSAGE);
      return;
    }

    setError("");
    setBusy(true);

    if (step === "email") {
      const blockReason = await findBlockReason(email);
      if (blockReason !== null) {
        setBusy(false);
        setError(blockedMessage(blockReason));
        return;
      }

      const status = await checkEmailStatus(email);
      setBusy(false);
      if (status === null) setError("We couldn't check this email right now. Please try again.");
      else goTo(status === "registered" ? "login" : "create");
      return;
    }

    if (step === "forgot") {
      const result = await requestPinReset(email);
      setBusy(false);
      if (result.error) setError(result.error);
      else setNotice("A reset link is on its way. Open it from your inbox to set a new PIN.");
      return;
    }

    const result = step === "login" ? await signIn(email, pin) : await signUp(email, pin, whatsapp);
    setBusy(false);
    if (result.error) setError(result.error);
  };

  const copy = titles[step];
  const showsEmailInput = step === "email" || step === "forgot";

  return (
    <div className="h-dvh w-full overflow-hidden flex md:items-center md:justify-center md:p-6">
      <div className="w-full h-full md:h-[min(700px,calc(100dvh-48px))] md:max-w-[1100px] flex flex-col md:flex-row md:rounded-[28px] overflow-hidden md:shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)] md:border md:border-[var(--line)]">
        <div className="relative shrink-0 md:w-[46%] bg-[linear-gradient(160deg,#0c2660_0%,#061639_70%)] text-white px-6 pt-7 pb-14 md:p-12 flex flex-col">
          <img src="/logo-wordmark.png" alt="Premium Store" className="h-11 md:h-14 w-auto self-start select-none" draggable={false} />

          <h1 className="mt-6 md:mt-auto md:pt-8 font-[family-name:var(--font-display)] font-medium tracking-[-0.02em] text-[32px] leading-[1.1] md:text-[48px]">
            Premium Access,
            <br />
            <span className="text-[var(--gold)]">Delivered In Minutes.</span>
          </h1>

          <div className="hidden md:block mt-9 space-y-4">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3.5">
                <span className="size-9 rounded-xl bg-white/10 text-[var(--gold)] grid place-items-center shrink-0">{feature.icon}</span>
                <span>
                  <span className="block font-semibold text-[15px]">{feature.title}</span>
                  <span className="block text-[13.5px] text-white/60">{feature.text}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="hidden md:block mt-auto" />
        </div>

        <div className="relative flex-1 min-h-0 -mt-8 md:mt-0 bg-[var(--surface)] rounded-t-[28px] md:rounded-none flex flex-col">
          <form onSubmit={submit} noValidate className="flex-1 min-h-0 overflow-y-auto px-6 pt-7 pb-6 md:px-14 md:py-12 flex flex-col">
            <div className="md:mt-auto">
              <h2 className="font-[family-name:var(--font-display)] font-bold text-[26px] md:text-[32px] leading-tight">{copy.heading}</h2>
              <p className="mt-1 text-[14px] md:text-[15px] text-[var(--muted)]">{copy.text}</p>
            </div>

            <div className="mt-6 space-y-4">
              {showsEmailInput ? (
                <label className="block">
                  <span className="text-[13.5px] font-semibold">Email</span>
                  <input autoFocus value={email} onChange={(event) => setEmail(cleanEmail(event.target.value))} placeholder="you@example.com" inputMode="email" autoComplete="email" className={inputClass} />
                </label>
              ) : (
                <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-[var(--bg)] border border-[var(--line)] pl-4 pr-1.5 h-9">
                  <span className="text-[13.5px] font-medium truncate">{email}</span>
                  <button type="button" onClick={() => goTo("email")} className="h-7 px-2.5 rounded-full text-[12.5px] font-semibold text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] shrink-0">
                    Change
                  </button>
                </div>
              )}

              {(step === "login" || step === "create") && (
                <label className="block">
                  <span className="text-[13.5px] font-semibold">{step === "create" ? "Choose a 6-digit PIN" : "6-digit PIN"}</span>
                  <SecretInput
                    autoFocus
                    value={pin}
                    onChange={(event) => setPin(cleanDigits(event.target.value, limits.pinLength))}
                    placeholder="••••••"
                    inputMode="numeric"
                    autoComplete={step === "login" ? "current-password" : "new-password"}
                    className={pinClass}
                  />
                  {step === "create" && <span className="mt-1 block text-[12px] text-[var(--muted)]">Numbers only</span>}
                </label>
              )}

              {step === "create" && (
                <label className="block">
                  <span className="text-[13.5px] font-semibold">Confirm your PIN</span>
                  <SecretInput value={confirmPin} onChange={(event) => setConfirmPin(cleanDigits(event.target.value, limits.pinLength))} placeholder="••••••" inputMode="numeric" autoComplete="new-password" className={pinClass} />
                </label>
              )}

              {step === "create" && (
                <label className="block">
                  <span className="text-[13.5px] font-semibold">WhatsApp number</span>
                  <input
                    value={whatsapp}
                    onChange={(event) => setWhatsapp(cleanDigits(event.target.value, limits.whatsappLength))}
                    placeholder="03001234567"
                    inputMode="numeric"
                    autoComplete="tel"
                    className={inputClass}
                  />
                  <span className="mt-1 block text-[12px] text-[var(--muted)]">Enter your valid 11-digit WhatsApp number</span>
                </label>
              )}
            </div>

            {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
            {notice && <p className="mt-3 text-[13px] text-emerald-700">{notice}</p>}

            <div className="flex justify-between mt-3">
              {step === "login" && (
                <button type="button" onClick={() => goTo("forgot")} className="text-[13px] font-medium text-[var(--accent)] hover:underline">
                  Forgot PIN?
                </button>
              )}
              {step === "forgot" && (
                <button type="button" onClick={() => goTo("login")} className="text-[13px] font-medium text-[var(--accent)] hover:underline flex items-center gap-1">
                  Back to sign in
                </button>
              )}
            </div>

            <div className="mt-auto md:mt-7 pt-5 md:pt-0 md:mb-auto">
              <button
                disabled={busy}
                className="group w-full h-[52px] rounded-2xl bg-[var(--accent)] text-[var(--accent-ink)] font-semibold text-[16px] flex items-center justify-center gap-2 shadow-[0_12px_28px_-14px_var(--accent)] hover:brightness-110 transition disabled:opacity-60"
              >
                {busy ? "Please wait…" : copy.button}
              </button>
              <p className="mt-3.5 flex items-center justify-center gap-1.5 text-[12.5px] text-[var(--muted)]">
                <Lock size={12} /> Your chat is private and visible only to you
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
