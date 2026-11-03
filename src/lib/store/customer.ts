import type { User } from "@supabase/supabase-js";
import { formatDuration, getEffectiveStatus } from "../availability";
import { serverNow } from "../clock";
import { getSupabase } from "../supabase/client";
import { uploadScreenshot } from "../supabase/screenshots";
import { hasOlderChat, saveProofNow } from "../supabase/sync";
import { recordUploadProblem } from "../supabase/uploadProblems";
import type { AppState, Customer, Stage, TicketKind } from "../types";
import { validateName } from "../validation";
import { hasWaitingReplies } from "./connection";
import { ADMIN_CANCEL_REASON, addMessage, botText, canStillPay, createOrderNumber, createTicketNumber, fillPlaceholders, findCustomerTitle, getActiveOrder, notifyAdmin, replyAsBot } from "./helpers";
import { applyRemoteChange, getState, updateState } from "./state";

const MINUTE = 60_000;

type AuthResult = { error: string | null };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export type EmailStatus = "new" | "registered";

export async function checkEmailStatus(email: string): Promise<EmailStatus | null> {
  const { data, error } = await getSupabase("customer").rpc("email_status", { check_email: normalizeEmail(email) });
  if (error) return null;
  return data as EmailStatus;
}

export async function findBlockReason(email: string) {
  const { data, error } = await getSupabase("customer").rpc("blocked_email_reason", { check_email: normalizeEmail(email) });
  return error ? null : (data as string | null);
}

export async function signIn(email: string, pin: string): Promise<AuthResult> {
  const { error } = await getSupabase("customer").auth.signInWithPassword({ email: normalizeEmail(email), password: pin });
  if (error) return { error: "Wrong PIN. Try again or use Forgot PIN." };
  return { error: null };
}

async function isWhatsAppTaken(number: string) {
  const client = getSupabase("customer");
  const owner = await client.rpc("whatsapp_owner", { check_number: number });
  if (!owner.error) return { taken: Boolean(owner.data), owner: (owner.data as string | null) ?? null, checked: true, missing: false };

  const { data, error } = await client.rpc("whatsapp_taken", { check_number: number });
  if (error) return { taken: false, owner: null, checked: false, missing: error.code === "PGRST202" };
  return { taken: Boolean(data), owner: null, checked: true, missing: false };
}

function takenMessage(owner: string | null) {
  return owner ? `This number is already used by ${owner}. Please log in with that email.` : "This number is already used by another account.";
}

const WHATSAPP_UNCHECKED = "We couldn't check this number right now. Please try again.";

export async function signUp(email: string, pin: string, whatsapp: string): Promise<AuthResult> {
  const check = await isWhatsAppTaken(whatsapp);
  if (check.taken) return { error: takenMessage(check.owner) };
  if (!check.checked && !check.missing) return { error: WHATSAPP_UNCHECKED };

  const { data, error } = await getSupabase("customer").auth.signUp({
    email: normalizeEmail(email),
    password: pin,
    options: { data: check.checked ? { whatsapp } : {} },
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already")) return { error: "This email already has an account. Go back and enter your PIN." };
    return { error: error.message };
  }
  if (!data.session) return { error: "Please confirm your email address, then log in." };
  return { error: null };
}

export async function saveWhatsApp(customerId: string, whatsapp: string): Promise<AuthResult> {
  const check = await isWhatsAppTaken(whatsapp);
  if (check.taken) return { error: takenMessage(check.owner) };
  if (!check.checked) return { error: WHATSAPP_UNCHECKED };

  const { error } = await getSupabase("customer").from("customers").update({ whatsapp }).eq("id", customerId);
  if (error?.code === "23505") return { error: takenMessage(null) };
  if (error) return { error: WHATSAPP_UNCHECKED };

  applyRemoteChange((state) => {
    const customer = state.customers.find((item) => item.id === customerId);
    if (customer) customer.whatsapp = whatsapp;
  });
  return { error: null };
}

export async function requestPinReset(email: string): Promise<AuthResult> {
  const { error } = await getSupabase("customer").auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: `${window.location.origin}/reset-pin`,
  });
  if (error) return { error: "We couldn't send the reset email right now. Please try again in a few minutes." };
  return { error: null };
}

export async function updatePin(pin: string): Promise<AuthResult> {
  const { error } = await getSupabase("customer").auth.updateUser({ password: pin });
  if (error?.code === "same_password") return { error: "Your new PIN must be different from your current PIN. Please choose another one." };
  if (error) return { error: "This reset link has expired. Please request a new one." };
  return { error: null };
}

export async function signOut() {
  await getSupabase("customer").auth.signOut();
}

export function ensureCustomerProfile(user: User) {
  const state = getState();
  const hasProfile = state.customers.some((customer) => customer.id === user.id);
  const hasConversation = Boolean(state.conversations[user.id]);
  if (hasProfile && hasConversation) return;

  updateState((draft) => {
    const now = serverNow();
    if (!hasProfile) {
      const whatsapp = typeof user.user_metadata?.whatsapp === "string" ? user.user_metadata.whatsapp : undefined;
      draft.customers.push({ id: user.id, email: user.email ?? "", createdAt: now, lastSeenAt: now, blocked: false, cancelCount: 0, whatsapp });
    }
    if (!hasConversation) {
      draft.conversations[user.id] = { customerId: user.id, stage: "menu", typing: false, unreadByAdmin: 0, lastMessageAt: now };
    }
  });
}

export async function openChat(customerId: string) {
  const shown = getState().messages.some((message) => message.customerId === customerId);
  const hasHistory = shown || (await hasOlderChat(customerId)) !== false;

  updateState((state) => {
    const customer = state.customers.find((item) => item.id === customerId);
    const conversation = state.conversations[customerId];
    if (!customer || !conversation) return;

    if (!hasHistory) {
      addMessage(state, customerId, "bot", `Hi there. ${state.settings.welcome}`);
      return;
    }

    const wasAway = serverNow() - customer.lastSeenAt > state.settings.timers.inactiveMinutes * MINUTE;
    if (wasAway && conversation.stage !== "awaiting_payment") {
      conversation.stage = "menu";
      addMessage(state, customerId, "bot", botText(state, "welcomeBack"));
    }
  });
  recordActivity(customerId);
}

export function recordActivity(customerId: string) {
  updateState((state) => {
    const customer = state.customers.find((item) => item.id === customerId);
    if (customer) customer.lastSeenAt = serverNow();
  });
  markMessagesDelivered(customerId);
}

export function markMessagesDelivered(customerId: string) {
  const hasUndelivered = getState().messages.some((message) => message.customerId === customerId && message.sender !== "customer" && !message.deliveredAt);
  if (!hasUndelivered) return;

  updateState((state) => {
    const now = serverNow();
    for (const message of state.messages) {
      if (message.customerId === customerId && message.sender !== "customer" && !message.deliveredAt) {
        message.deliveredAt = now;
      }
    }
  });
}

export function markMessagesSeen(customerId: string) {
  const hasUnseen = getState().messages.some((message) => message.customerId === customerId && message.sender === "admin" && !message.seenAt);
  if (!hasUnseen) return;

  updateState((state) => {
    const now = serverNow();
    for (const message of state.messages) {
      if (message.customerId === customerId && message.sender === "admin" && !message.seenAt) {
        message.deliveredAt = message.deliveredAt ?? now;
        message.seenAt = now;
      }
    }
  });
}

export type MenuOption = "buy" | "support";

export const menuLabels: Record<MenuOption, string> = {
  buy: "Buy a Subscription",
  support: "Customer Support",
};

export type OrderPause = { until: number; reason: "cancels" | "payment_issue" };

export function findOrderPause(customer: Customer | undefined, now = serverNow()): OrderPause | null {
  if (!customer) return null;
  const pauses: OrderPause[] = [];
  if (customer.cancelCooldownUntil && customer.cancelCooldownUntil > now) pauses.push({ until: customer.cancelCooldownUntil, reason: "cancels" });
  if (customer.paymentBlockedUntil && customer.paymentBlockedUntil > now) pauses.push({ until: customer.paymentBlockedUntil, reason: "payment_issue" });
  return pauses.sort((a, b) => b.until - a.until)[0] ?? null;
}

export type MenuLock = { reason: "pending" | "rejected" | "issue" | "closed" | "paused"; title: string; message: string };
export type LockTarget = MenuOption | "other_issues";

// Both menu buttons stay closed while the admin still has to act on this customer's payment or support request.
// While the store is closed only buying and new support requests close; common questions stay open.
// The texts come from Settings.
export function findMenuLock(state: AppState, customerId: string, target: LockTarget, now = serverNow()): MenuLock | null {
  const texts = state.settings.menuLock;
  const order = state.orders.find((item) => item.customerId === customerId && (item.status === "pending_review" || item.status === "rejected"));
  if (order?.status === "pending_review") return { reason: "pending", title: texts.pendingTitle, message: texts.pending };
  if (order?.status === "rejected") return { reason: "rejected", title: texts.rejectedTitle, message: texts.rejected };
  if (findOpenTicket(state, customerId)) return { reason: "issue", title: texts.issueTitle, message: texts.issue };

  // After several cancelled orders, new support requests wait for the same timer as new orders.
  const pause = findOrderPause(state.customers.find((customer) => customer.id === customerId), now);
  if (target === "other_issues" && pause?.reason === "cancels") {
    const timeLeft = formatDuration(Math.ceil((pause.until - now) / MINUTE));
    return { reason: "paused", title: "Requests paused", message: `New orders and support requests are paused after several cancelled orders. Please try again in ${timeLeft}.` };
  }

  const status = getEffectiveStatus(state.settings, now);
  if (target === "support" || (status !== "offline" && status !== "away_closed")) return null;
  const message = target === "buy" ? state.settings.statusMessages[status] : state.settings.supportClosedMessages[status];
  return { reason: "closed", title: texts.closedTitle, message: fillPlaceholders(message, state) };
}

function startBuying(state: AppState, customerId: string) {
  const conversation = state.conversations[customerId];
  const customer = state.customers.find((item) => item.id === customerId);
  const now = serverNow();

  const openOrder = getActiveOrder(state, customerId);
  if (openOrder && canStillPay(openOrder)) {
    addMessage(state, customerId, "bot", botText(state, "openOrderExists", { order_id: openOrder.id }));
    conversation.stage = "awaiting_payment";
    return;
  }

  const closingOrder = state.orders.find((order) => order.customerId === customerId && order.status === "awaiting_payment");
  if (closingOrder) {
    conversation.activeOrderId = closingOrder.id;
    conversation.stage = "awaiting_payment";
    return;
  }

  const pendingOrder = state.orders.find((order) => order.customerId === customerId && (order.status === "pending_review" || order.status === "rejected"));
  if (pendingOrder) {
    // Shown as a notice under the chat (like an open support request), not as a chat message.
    if (pendingOrder.status === "rejected") {
      conversation.stage = "rejected";
    } else {
      conversation.activeOrderId = pendingOrder.id;
      conversation.stage = "awaiting_payment";
    }
    return;
  }

  const pause = findOrderPause(customer, now);
  if (pause) {
    const minutesLeft = Math.ceil((pause.until - now) / MINUTE);
    addMessage(state, customerId, "bot", botText(state, "ordersPaused", { time_left: formatDuration(minutesLeft) }));
    conversation.stage = "menu";
    return;
  }

  const status = getEffectiveStatus(state.settings);
  if (status === "offline" || status === "away_closed") {
    addMessage(state, customerId, "bot", fillPlaceholders(state.settings.statusMessages[status], state));
    conversation.stage = "menu";
    return;
  }

  addMessage(state, customerId, "bot", botText(state, "choosePlan"));
  conversation.stage = "choose_plan";
}

// A second tap while the bot is still answering the first one is ignored (no double orders or messages),
// also while that answer is waiting for the connection.
function botIsReplying(customerId: string) {
  return Boolean(getState().conversations[customerId]?.typing) || hasWaitingReplies();
}

export function chooseMenuOption(customerId: string, option: MenuOption) {
  if (botIsReplying(customerId) || findMenuLock(getState(), customerId, option)) return;
  updateState((state) => {
    addMessage(state, customerId, "customer", menuLabels[option]);
  });

  replyAsBot(customerId, (state) => {
    if (option === "buy") {
      startBuying(state, customerId);
      return;
    }
    addMessage(state, customerId, "bot", botText(state, "supportIntro"));
    state.conversations[customerId].stage = "support";
  });
}

export function choosePlan(customerId: string, planId: string) {
  if (botIsReplying(customerId)) return;
  const plan = getState().plans.find((item) => item.id === planId);
  if (!plan) return;

  updateState((state) => {
    addMessage(state, customerId, "customer", `${plan.name}, Rs ${plan.price.toLocaleString()}`);
    state.conversations[customerId].planId = planId;
  });

  replyAsBot(customerId, (state) => {
    addMessage(state, customerId, "bot", botText(state, "chooseMethod"));
    state.conversations[customerId].stage = "choose_method";
  });
}

export function chooseMethod(customerId: string, methodId: string) {
  if (botIsReplying(customerId)) return;
  const method = getState().methods.find((item) => item.id === methodId);
  if (!method) return;

  updateState((state) => {
    addMessage(state, customerId, "customer", method.name);
    state.conversations[customerId].methodId = methodId;
  });

  replyAsBot(customerId, (state) => {
    const terms = state.settings.terms.map((term) => "• " + fillPlaceholders(term, state)).join("\n");
    addMessage(state, customerId, "bot", `${botText(state, "termsIntro")}\n${terms}`);
    state.conversations[customerId].stage = "terms";
  });
}

export function showHowItWorks(customerId: string) {
  if (botIsReplying(customerId)) return;
  updateState((state) => {
    addMessage(state, customerId, "customer", "How does it work?");
  });

  replyAsBot(customerId, (state) => {
    addMessage(state, customerId, "bot", fillPlaceholders(state.settings.howItWorks, state));
  });
}

export function createOrder(customerId: string) {
  if (botIsReplying(customerId)) return;
  updateState((state) => {
    addMessage(state, customerId, "customer", "Create order");
  });

  replyAsBot(customerId, (state) => {
    const conversation = state.conversations[customerId];
    const plan = state.plans.find((item) => item.id === conversation.planId);
    const method = state.methods.find((item) => item.id === conversation.methodId);
    if (!plan || !method) return;

    // The store may have closed while the customer was choosing a plan.
    const status = getEffectiveStatus(state.settings);
    if (status === "offline" || status === "away_closed") {
      addMessage(state, customerId, "bot", fillPlaceholders(state.settings.statusMessages[status], state));
      conversation.stage = "menu";
      return;
    }

    const now = serverNow();
    const orderId = createOrderNumber();

    state.orders.unshift({
      id: orderId,
      customerId,
      planId: plan.id,
      planName: plan.name,
      amount: plan.price,
      methodName: method.name,
      bank: { ...state.settings.bank, iban: method.showIban && state.settings.bank.iban ? state.settings.bank.iban : undefined },
      paymentSteps: method.steps,
      status: "awaiting_payment",
      codeUnused: false,
      createdAt: now,
      expiresAt: now + state.settings.timers.orderMinutes * MINUTE,
    });

    addMessage(state, customerId, "bot", botText(state, "orderCreated", { order_id: orderId, plan: plan.name }), { kind: "payment", orderId });

    conversation.activeOrderId = orderId;
    conversation.stage = "awaiting_payment";
  });
}

export function cancelOrder(customerId: string) {
  if (botIsReplying(customerId)) return;
  let cooldownStarted = false;

  updateState((state) => {
    addMessage(state, customerId, "customer", "I don't want to continue this order");
    const now = serverNow();
    const order = getActiveOrder(state, customerId);
    if (!order || !canStillPay(order)) return;
    order.status = "cancelled";
    order.reviewedAt = now;

    const customer = state.customers.find((item) => item.id === customerId);
    if (!customer) return;
    const windowStart = now - state.settings.timers.cancelWindowMinutes * MINUTE;
    const recentCancels = state.orders.filter((item) => item.customerId === customerId && item.status === "cancelled" && item.rejectReason !== ADMIN_CANCEL_REASON && (item.reviewedAt ?? 0) >= windowStart).length;
    if (recentCancels >= state.settings.limits.cancelsBeforeCooldown) {
      customer.cancelCooldownUntil = now + state.settings.timers.cancelCooldownMinutes * MINUTE;
      cooldownStarted = true;
    }
  });

  replyAsBot(customerId, (state) => {
    const message = cooldownStarted
      ? botText(state, "ordersPausedAfterCancels", { time_left: formatDuration(state.settings.timers.cancelCooldownMinutes) })
      : botText(state, "orderCancelled");
    addMessage(state, customerId, "bot", message);
    state.conversations[customerId].stage = "menu";
    state.conversations[customerId].activeOrderId = undefined;
  });
}

const ORDER_TIME_ENDED = "Your payment time ended, so this order was closed. Please create a new order.";
const PROOF_REFUSALS: Record<string, string> = {
  "This order has expired": ORDER_TIME_ENDED,
  "This order can no longer be changed": "This order is already closed, so your proof was not saved. Please check the chat.",
};

export async function submitPaymentProof(customerId: string, screenshot: string, senderName: string): Promise<string | null> {
  const order = getActiveOrder(getState(), customerId);
  if (!order) return "No open order found.";
  if (!canStillPay(order)) {
    recordUploadProblem(`Order ${order.id} time ended before submit`);
    return ORDER_TIME_ENDED;
  }

  const name = senderName.trim();
  const nameProblem = validateName(name, "Sender account name");
  if (nameProblem) return nameProblem;

  let screenshotPath: string;
  try {
    screenshotPath = await uploadScreenshot(customerId, screenshot);
  } catch (problem) {
    recordUploadProblem(`Upload failed: ${problem instanceof Error ? problem.message : problem} (${Math.round(screenshot.length / 1024)} KB)`);
    return "Could not upload the screenshot. Please check your internet and try again.";
  }

  const refusal = await saveProofNow(order.id, screenshotPath, name);
  if (refusal) {
    recordUploadProblem(`Order ${order.id} not saved: ${refusal}`);
    return PROOF_REFUSALS[refusal] ?? "Your proof could not be saved. Please check your internet and try again.";
  }

  applyRemoteChange((state) => {
    const current = state.orders.find((item) => item.id === order.id);
    if (!current) return;

    current.status = "pending_review";
    current.screenshot = screenshotPath;
    current.senderName = name;
    current.submittedAt = serverNow();
    current.rejectReason = undefined;
  });

  updateState((state) => {
    const customer = state.customers.find((item) => item.id === customerId);
    if (customer) customer.cancelCount = 0;

    addMessage(state, customerId, "customer", "Payment proof submitted", { kind: "proof", orderId: order.id });
    state.conversations[customerId].unreadByAdmin += 1;
    notifyAdmin(state, {
      kind: "payment",
      title: "Payment submitted",
      body: `${findCustomerTitle(state, customerId)} · ${order.planName} · Rs ${order.amount.toLocaleString()}`,
      customerId,
    });
  });

  replyAsBot(customerId, (state) => {
    const status = getEffectiveStatus(state.settings);
    const message = status === "active" ? state.settings.statusMessages.active : state.settings.statusMessages.away;
    addMessage(state, customerId, "bot", fillPlaceholders(message, state));
    state.conversations[customerId].stage = "menu";
  });

  return null;
}

async function uploadOptional(customerId: string, screenshot?: string) {
  if (!screenshot) return undefined;
  try {
    return await uploadScreenshot(customerId, screenshot);
  } catch {
    return undefined;
  }
}

export const OTHER_ISSUES_LABEL = "Other issues";

export function chooseOtherIssue(customerId: string) {
  if (botIsReplying(customerId) || findMenuLock(getState(), customerId, "other_issues")) return;
  updateState((state) => {
    addMessage(state, customerId, "customer", OTHER_ISSUES_LABEL);
  });

  replyAsBot(customerId, (state) => {
    if (blockSupport(state, customerId)) return;

    const status = getEffectiveStatus(state.settings);
    if (status === "away_closed" || status === "offline") {
      addMessage(state, customerId, "bot", fillPlaceholders(state.settings.supportClosedMessages[status], state));
      state.conversations[customerId].stage = "support";
      return;
    }

    addMessage(state, customerId, "bot", botText(state, "describeIssue"));
    state.conversations[customerId].stage = "support_other";
  });
}

function blockSupport(state: AppState, customerId: string) {
  const conversation = state.conversations[customerId];
  const openTicket = findOpenTicket(state, customerId);

  if (openTicket) {
    // The notice under the chat says a request is already open; nothing is added to the chat.
    conversation.stage = issueStage(state, customerId);
    return true;
  }
  return false;
}

function issueStage(state: AppState, customerId: string): Stage {
  const messages = state.messages.filter((message) => message.customerId === customerId);
  const lastAdmin = messages.filter((message) => message.sender === "admin").at(-1)?.createdAt ?? 0;
  const lastCustomer = messages.filter((message) => message.sender === "customer").at(-1)?.createdAt ?? 0;
  return lastAdmin > lastCustomer ? "agent_replied" : "waiting_agent";
}

export async function submitSupportIssue(customerId: string, description: string, screenshot?: string) {
  // The store may have closed while the customer was writing the issue.
  const status = getEffectiveStatus(getState().settings);
  if (status === "offline" || status === "away_closed") {
    updateState((state) => {
      addMessage(state, customerId, "bot", fillPlaceholders(state.settings.supportClosedMessages[status], state));
      state.conversations[customerId].stage = "support";
    });
    return;
  }

  const screenshotPath = await uploadOptional(customerId, screenshot);
  const ticketId = createTicketNumber();

  updateState((state) => {
    addMessage(state, customerId, "customer", description);
    if (screenshotPath) addMessage(state, customerId, "customer", "Screenshot", { kind: "image", image: screenshotPath });

    state.tickets.unshift({ id: ticketId, customerId, kind: "support", message: description, screenshot: screenshotPath, status: "open", createdAt: serverNow() });
    state.conversations[customerId].unreadByAdmin += 1;
    notifyAdmin(state, { kind: "support", title: "New support issue", body: `${findCustomerTitle(state, customerId)} · ${description.slice(0, 70)}`, customerId });
  });

  replyAsBot(customerId, (state) => {
    const sentWhileAway = getEffectiveStatus(state.settings) === "away";
    const message = sentWhileAway ? state.settings.supportMessages.away : state.settings.supportMessages.active;
    addMessage(state, customerId, "bot", fillPlaceholders(message, state).replaceAll("{ticket_id}", ticketId));
    state.conversations[customerId].stage = "waiting_agent";
  });
}

export async function sendIssueFollowUp(customerId: string, text: string, screenshot?: string) {
  const screenshotPath = await uploadOptional(customerId, screenshot);

  updateState((state) => {
    addMessage(state, customerId, "customer", text);
    if (screenshotPath) addMessage(state, customerId, "customer", "Screenshot", { kind: "image", image: screenshotPath });
    const conversation = state.conversations[customerId];
    conversation.unreadByAdmin += 1;
    conversation.stage = "waiting_agent";
  });
}

// App issues ("support") and payment issues are separate: each kind has its own open request.
export function findOpenTicket(state: AppState, customerId: string, kind: TicketKind = "support") {
  return state.tickets.find((ticket) => ticket.customerId === customerId && ticket.kind === kind && ticket.status === "open");
}

export function continueIssue(customerId: string) {
  updateState((state) => {
    addMessage(state, customerId, "customer", state.settings.support.stillFacingLabel);
    state.conversations[customerId].stage = "live";
  });
}

export function confirmIssueResolved(customerId: string) {
  updateState((state) => {
    addMessage(state, customerId, "customer", state.settings.support.resolvedLabel);
    for (const ticket of state.tickets) {
      if (ticket.customerId === customerId && ticket.kind === "support" && ticket.status === "open") ticket.status = "resolved";
    }
  });

  replyAsBot(customerId, (state) => {
    addMessage(state, customerId, "bot", botText(state, "issueResolvedByCustomer"));
    state.conversations[customerId].stage = "menu";
  });
}

const previousStep: Partial<Record<Stage, { stage: Stage; prompt: string }>> = {
  choose_method: { stage: "choose_plan", prompt: "No problem. Choose your plan again." },
  terms: { stage: "choose_method", prompt: "No problem. How would you like to pay?" },
  support_other: { stage: "support", prompt: "No problem. Pick a question below, or choose Other issues." },
};

export function goBack(customerId: string) {
  if (botIsReplying(customerId)) return;
  const conversation = getState().conversations[customerId];
  const step = conversation ? previousStep[conversation.stage] : undefined;
  if (!step) {
    backToMenu(customerId);
    return;
  }

  updateState((state) => {
    addMessage(state, customerId, "customer", "Back");
  });

  replyAsBot(customerId, (state) => {
    addMessage(state, customerId, "bot", step.prompt);
    state.conversations[customerId].stage = step.stage;
  });
}

export function backToMenu(customerId: string) {
  if (botIsReplying(customerId)) return;
  updateState((state) => {
    addMessage(state, customerId, "customer", "Main menu");
  });

  replyAsBot(customerId, (state) => {
    addMessage(state, customerId, "bot", botText(state, "menuPrompt"));
    const conversation = state.conversations[customerId];
    conversation.stage = "menu";
    conversation.planId = undefined;
    conversation.methodId = undefined;
  });
}

export function repliesLeftAfterRejection(state: AppState, customerId: string) {
  const order = state.orders.filter((item) => item.customerId === customerId && item.status === "rejected").sort((a, b) => (b.reviewedAt ?? 0) - (a.reviewedAt ?? 0))[0];
  if (!order) return 0;

  // Counted from the rejection only: a message from the admin does not open another reply.
  const since = order.reviewedAt ?? 0;
  const sent = state.messages.filter((message) => message.customerId === customerId && message.sender === "customer" && message.kind === "text" && message.createdAt > since).length;
  return Math.max(0, state.settings.limits.repliesAfterRejection - sent);
}

export async function sendRejectionReply(customerId: string, text: string, screenshot?: string) {
  const screenshotPath = await uploadOptional(customerId, screenshot);

  updateState((state) => {
    addMessage(state, customerId, "customer", text);
    if (screenshotPath) addMessage(state, customerId, "customer", "Screenshot", { kind: "image", image: screenshotPath });
    state.conversations[customerId].unreadByAdmin += 1;
    notifyAdmin(state, { kind: "payment", title: "Reply to a rejected payment", body: `${findCustomerTitle(state, customerId)} · ${text.slice(0, 70)}`, customerId });
  });
}

