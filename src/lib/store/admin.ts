import { isAuthApiError } from "@supabase/supabase-js";
import { serverNow } from "../clock";
import { createTemporaryClient, getSupabase } from "../supabase/client";
import { deleteScreenshots, uploadScreenshot } from "../supabase/screenshots";
import type { AdminStatus, AppState, Message, Ticket } from "../types";
import { codeOnOwnLine, extractCode } from "../validation";
import { ADMIN_CANCEL_REASON, addMessage, botText, extractCodes, findCustomerEmail, liftPaymentPause } from "./helpers";
import { getState, updateState } from "./state";

export type AdminCheck = "admin" | "not_admin" | "unknown";

// Must not be "premium-store-admin": that key holds the admin's sign-in (see getSupabase), and writing to it
// replaced the session, so every data request went out signed out and came back empty.
const ADMIN_REMEMBERED_KEY = "premium-store-admin-confirmed";

function rememberAdmin(userId: string, isAdmin: boolean) {
  try {
    if (isAdmin) localStorage.setItem(ADMIN_REMEMBERED_KEY, userId);
    else localStorage.removeItem(ADMIN_REMEMBERED_KEY);
  } catch {
    // Not remembered; the check simply runs again.
  }
}

export function rememberedAdmin(userId: string) {
  try {
    return localStorage.getItem(ADMIN_REMEMBERED_KEY) === userId;
  } catch {
    return false;
  }
}

// Whether the signed-in account is an admin. A slow or missing connection gives "unknown", never "not_admin",
// so the panel does not sign the admin out; an admin confirmed earlier on this device stays in.
export async function checkAdminAccess(): Promise<AdminCheck> {
  const client = getSupabase("admin");
  const { data: session } = await client.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return "not_admin";

  // The server confirms the sign-in is still valid. An expired or revoked sign-in goes back to the sign-in
  // screen (with it no data would load); only a missing answer counts as a connection problem.
  // Both questions go out together, so the panel waits for one round trip instead of two.
  const [{ error: userError }, { data: adminRow, error }] = await Promise.all([
    client.auth.getUser(),
    client.from("admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (userError) {
    if (isAuthApiError(userError) && userError.status >= 400 && userError.status < 500) {
      await client.auth.signOut({ scope: "local" });
      return "not_admin";
    }
    return rememberedAdmin(userId) ? "admin" : "unknown";
  }

  if (error) return rememberedAdmin(userId) ? "admin" : "unknown";
  rememberAdmin(userId, Boolean(adminRow));
  return adminRow ? "admin" : "not_admin";
}

export async function adminSignIn(email: string, password: string): Promise<string | null> {
  const client = getSupabase("admin");
  const { error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) return "Incorrect email or password.";

  // "unknown" keeps the sign-in; the panel checks again once the connection allows.
  if ((await checkAdminAccess()) === "not_admin") {
    await client.auth.signOut();
    return "This account does not have admin access.";
  }
  return null;
}

export async function requestAdminPasswordCode(email: string): Promise<string | null> {
  const response = await fetch("/api/admin-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  }).catch(() => null);
  if (!response) return "Could not send the code. Please check your internet and try again.";
  if (response.status === 403) return "This email cannot reset the admin password.";
  if (response.status === 429) return "A code was sent a moment ago. Please wait a minute and try again.";
  if (!response.ok) return "Could not send the code right now. Please try again in a few minutes.";
  return null;
}

// Checks the emailed code and saves the new password, then signs out every phone and browser so the admin logs in again.
export async function resetAdminPassword(email: string, code: string, password: string): Promise<string | null> {
  const client = createTemporaryClient();
  const { error } = await client.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: "email" });
  if (error) return "This code is wrong or has expired. Please request a new one.";

  const { data } = await client.auth.getUser();
  const { data: adminRow } = await client.from("admins").select("user_id").eq("user_id", data.user?.id ?? "").maybeSingle();
  if (!adminRow) {
    await client.auth.signOut();
    return "This account does not have admin access.";
  }

  const { error: updateError } = await client.auth.updateUser({ password });
  if (!updateError) await client.from("admin_devices").delete().eq("user_id", data.user?.id ?? "");
  await client.auth.signOut({ scope: updateError ? "local" : "global" });
  if (updateError?.code === "same_password") return "Your new password must be different from your current password. Please choose another one.";
  if (updateError) return "Could not save the new password. Please try again.";
  return null;
}

export async function adminSignOut() {
  await getSupabase("admin").auth.signOut();
}

export function setAdminStatus(status: AdminStatus) {
  updateState((state) => {
    state.settings.status = status;
  });
}

export function sendAdminMessage(customerId: string, text: string, ticketReply = false) {
  const code = codeOnOwnLine(text) || extractCodes(text)[0];
  const containsCode = Boolean(code);

  updateState((state) => {
    addMessage(state, customerId, "admin", text);
    if (containsCode) {
      const order = findOrderAwaitingCode(state, customerId);
      if (order) order.code = code;
    }

    updateStageAfterReply(state, customerId, containsCode, ticketReply);
  });
}

// A Reply from a request card lets the customer answer (Resolved / Still facing).
// Any other admin message is read-only: the customer keeps seeing what they are waiting for.
function updateStageAfterReply(state: AppState, customerId: string, containsCode: boolean, ticketReply: boolean) {
  const conversation = state.conversations[customerId];
  conversation.unreadByAdmin = 0;
  const hasOpenTicket = state.tickets.some((ticket) => ticket.customerId === customerId && ticket.kind === "support" && ticket.status === "open");
  const pendingOrder = state.orders.find((order) => order.customerId === customerId && order.status === "pending_review");

  if (containsCode) {
    conversation.stage = "code_delivered";
  } else if (ticketReply && hasOpenTicket) {
    conversation.stage = "agent_replied";
  } else if (hasOpenTicket) {
    // A chat message is read-only: an open app issue keeps showing its status, not the pending order.
    if (conversation.stage !== "agent_replied") conversation.stage = "waiting_agent";
  } else if (pendingOrder) {
    conversation.activeOrderId = pendingOrder.id;
    conversation.stage = "awaiting_payment";
  } else if (conversation.stage !== "awaiting_payment" && conversation.stage !== "rejected") {
    conversation.stage = "live";
  }
}

export async function sendAdminImage(customerId: string, image: string, ticketReply = false): Promise<string | null> {
  let path: string;
  try {
    path = await uploadScreenshot(customerId, image);
  } catch {
    return "Could not upload the image. Please try again.";
  }

  updateState((state) => {
    addMessage(state, customerId, "admin", "Image", { kind: "image", image: path });
    updateStageAfterReply(state, customerId, false, ticketReply);
  });
  return null;
}

function findOrderAwaitingCode(state: AppState, customerId: string) {
  const completed = state.orders
    .filter((order) => order.customerId === customerId && order.status === "completed")
    .sort((a, b) => (b.reviewedAt ?? 0) - (a.reviewedAt ?? 0));
  return completed.find((order) => !order.code) ?? completed[0];
}

export function setCodeUnused(orderId: string, unused: boolean) {
  updateState((state) => {
    const order = state.orders.find((item) => item.id === orderId);
    if (order) order.codeUnused = unused;
  });
}

// Order and request numbers (PS-…, T-…) are not codes.
function codesIn(text: string) {
  const cleaned = text.replace(/\b(PS|T)-[A-Za-z0-9]+/gi, " ");
  return [...new Set([extractCode(cleaned), ...extractCodes(cleaned)].filter((code) => code.length === 6).map((code) => code.toLowerCase()))];
}

// Only the Approve dialog refuses a code that was already sent; messages from the chat are never checked.
export function findCodeAlreadySent(text: string) {
  const state = getState();
  const codes = codesIn(text);
  if (codes.length === 0) return null;

  const earlierOrder = state.orders.find((order) => order.code && codes.includes(order.code.toLowerCase()));
  if (earlierOrder) {
    return { code: earlierOrder.code ?? "", customerEmail: findCustomerEmail(state, earlierOrder.customerId), sentAt: earlierOrder.reviewedAt ?? earlierOrder.createdAt };
  }

  for (const message of state.messages) {
    if (message.sender !== "admin" || message.kind === "deleted") continue;
    const repeated = codesIn(message.text).find((code) => codes.includes(code));
    if (repeated) return { code: repeated.toUpperCase(), customerEmail: findCustomerEmail(state, message.customerId), sentAt: message.createdAt };
  }
  return null;
}

export function approveOrder(orderId: string, codeMessage: string, code: string) {
  const order = getState().orders.find((item) => item.id === orderId);
  if (!order) return;

  updateState((state) => {
    const current = state.orders.find((item) => item.id === orderId);
    if (!current) return;

    current.status = "completed";
    current.reviewedAt = serverNow();
    current.code = code;
    current.codeUnused = false;

    addMessage(state, current.customerId, "admin", codeMessage, { kind: "code", orderId });

    const conversation = state.conversations[current.customerId];
    if (conversation.activeOrderId === orderId) conversation.activeOrderId = undefined;
    conversation.stage = "code_delivered";
    conversation.unreadByAdmin = 0;
    markNotificationsRead(state, current.customerId);
  });
}

export function rejectOrder(orderId: string, reason: string) {
  updateState((state) => {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return;

    order.status = "rejected";
    order.rejectReason = reason;
    order.reviewedAt = serverNow();

    const message = state.settings.rejectionMessage.replaceAll("{order_id}", order.id).replaceAll("{reason}", reason);
    addMessage(state, order.customerId, "bot", message);

    const conversation = state.conversations[order.customerId];
    if (conversation.activeOrderId === orderId) conversation.activeOrderId = undefined;
    conversation.stage = "rejected";
    conversation.unreadByAdmin = 0;
    markNotificationsRead(state, order.customerId);
  });
}

export function canDeleteMessage(message: Message) {
  return message.sender === "admin" && (message.kind === "text" || message.kind === "image");
}

export function deleteAdminMessage(messageId: string) {
  const message = getState().messages.find((item) => item.id === messageId);
  if (!message || !canDeleteMessage(message)) return;

  updateState((state) => {
    const current = state.messages.find((item) => item.id === messageId);
    if (!current) return;
    current.kind = "deleted";
    current.text = "";
    current.image = undefined;
  });

  if (message.image) deleteScreenshots([message.image]).catch(() => undefined);
}

export function cancelOrderAsAdmin(orderId: string) {
  updateState((state) => {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order || (order.status !== "pending_review" && order.status !== "rejected")) return;

    order.status = "cancelled";
    order.rejectReason = ADMIN_CANCEL_REASON;
    order.reviewedAt = serverNow();

    addMessage(state, order.customerId, "bot", botText(state, "orderCancelledByAdmin", { order_id: order.id }));

    const conversation = state.conversations[order.customerId];
    if (conversation.activeOrderId === orderId) conversation.activeOrderId = undefined;
    conversation.stage = "menu";
    conversation.unreadByAdmin = 0;
    markNotificationsRead(state, order.customerId);
  });
}

export function setTicketResolved(ticketId: string, resolved: boolean) {
  updateState((state) => {
    const ticket = state.tickets.find((item) => item.id === ticketId);
    if (!ticket) return;
    ticket.status = resolved ? "resolved" : "open";
    if (resolved && ticket.kind === "payment") liftPaymentPause(state, ticket.customerId);

    const conversation = state.conversations[ticket.customerId];
    if (!resolved || !conversation) return;

    if (ticket.kind === "payment") {
      addMessage(state, ticket.customerId, "bot", botText(state, "paymentIssueResolved", { ticket_id: ticket.id }));
      if (conversation.stage === "waiting_agent") conversation.stage = "menu";
      return;
    }

    addMessage(state, ticket.customerId, "bot", botText(state, "issueResolvedByAdmin", { ticket_id: ticket.id }));
    if (["waiting_agent", "agent_replied", "live"].includes(conversation.stage)) conversation.stage = "menu";
  });
}

function markNotificationsRead(state: AppState, customerId: string) {
  for (const notification of state.notifications) {
    if (notification.customerId === customerId) notification.read = true;
  }
}

// A payment issue ends when "Wait after a payment problem" has passed since it was sent.
export function paymentIssueEndsAt(state: AppState, ticket: Ticket) {
  return ticket.createdAt + state.settings.timers.retryMinutes * 60_000;
}

const hasEnded = (state: AppState, ticket: Ticket, now: number) => ticket.kind === "payment" && ticket.status === "open" && paymentIssueEndsAt(state, ticket) <= now;

// Closes payment issues the moment their wait ends while the panel is open; the server does it too, every minute.
export function closeEndedPaymentIssues() {
  const now = serverNow();
  const state = getState();
  if (!state.tickets.some((ticket) => hasEnded(state, ticket, now))) return;
  updateState((draft) => {
    for (const ticket of draft.tickets) if (hasEnded(draft, ticket, now)) ticket.status = "resolved";
  });
}

export function markConversationRead(customerId: string) {
  const state = getState();
  const hasUnread = state.conversations[customerId]?.unreadByAdmin || state.notifications.some((item) => item.customerId === customerId && !item.read);
  if (!hasUnread) return;

  updateState((draft) => {
    if (draft.conversations[customerId]) draft.conversations[customerId].unreadByAdmin = 0;
    markNotificationsRead(draft, customerId);
  });
}

export function markAllNotificationsRead() {
  updateState((state) => {
    for (const notification of state.notifications) notification.read = true;
  });
}

export function blockCustomer(customerId: string, reason: string) {
  updateState((state) => {
    const customer = state.customers.find((item) => item.id === customerId);
    if (!customer) return;
    customer.blocked = true;
    customer.blockReason = reason;
    addMessage(state, customerId, "admin", `${state.settings.blocking.message}
Reason: ${reason}`);
  });
}

export function unblockCustomer(customerId: string) {
  updateState((state) => {
    const customer = state.customers.find((item) => item.id === customerId);
    if (!customer) return;
    customer.blocked = false;
    customer.blockReason = undefined;
    addMessage(state, customerId, "admin", state.settings.blocking.unblockMessage);
  });
}

export type EditableSettings = Pick<AppState, "settings" | "plans" | "methods" | "faqs">;

export function saveSettings(changes: EditableSettings) {
  updateState((state) => {
    state.settings = { ...changes.settings, status: state.settings.status };
    state.plans = changes.plans;
    state.methods = changes.methods;
    state.faqs = changes.faqs;
  });
}
