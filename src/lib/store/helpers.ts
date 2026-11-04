import { formatDuration, minutesUntilOpen, workingHoursLabel } from "../availability";
import { serverNow } from "../clock";
import { createId } from "../format";
import type { AdminNotification, AppState, BankAccount, BotMessageKey, Customer, Message, Order } from "../types";
import { whenOnline } from "./connection";
import { updateState } from "./state";

const BOT_TYPING_DELAY = 650;

export const ADMIN_CANCEL_REASON = "Cancelled by admin";

export function fillPlaceholders(text: string, state: AppState, bank: BankAccount = state.settings.bank) {
  const { timers } = state.settings;
  return text
    .replaceAll("{timer}", String(timers.orderMinutes))
    .replaceAll("{hours}", workingHoursLabel(state.settings))
    .replaceAll("{back_in}", formatDuration(minutesUntilOpen(state.settings)))
    .replaceAll("{bank}", bank.bankName)
    .replaceAll("{account}", bank.accountNumber.replace(/\s/g, ""))
    .replaceAll("{iban}", bank.iban ?? "")
    .replaceAll("{title}", bank.accountTitle);
}

export function botText(state: AppState, key: BotMessageKey, values: Record<string, string> = {}) {
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), fillPlaceholders(state.settings.messages[key], state));
}

export function stepLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

export function orderBank(state: AppState, order?: Order) {
  return order?.bank ?? state.settings.bank;
}

export function orderSteps(state: AppState, customerId: string) {
  const order = getActiveOrder(state, customerId);
  const steps = order?.paymentSteps ?? findOrderMethod(state, customerId)?.steps ?? "";
  return stepLines(fillPlaceholders(steps, state, orderBank(state, order)));
}

export function addMessage(state: AppState, customerId: string, sender: Message["sender"], text: string, extra: Partial<Message> = {}) {
  const message: Message = {
    id: createId(),
    customerId,
    sender,
    kind: "text",
    text,
    createdAt: serverNow(),
    ...extra,
  };

  state.messages.push(message);

  const conversation = state.conversations[customerId];
  if (conversation) conversation.lastMessageAt = message.createdAt;

  return message;
}

export function notifyAdmin(state: AppState, notification: Omit<AdminNotification, "id" | "read" | "createdAt">) {
  state.notifications.unshift({ ...notification, id: createId(), read: false, createdAt: serverNow() });
  state.notifications = state.notifications.slice(0, 60);
}

const typingReplies = new Set<() => void>();

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") typingReplies.forEach((finish) => finish());
  });
}

// The bot answers only with a connection; offline, the answer waits and comes when it is back.
// A phone pauses a page in the background, so an answer that is still typing is sent before that.
export function replyAsBot(customerId: string, reply: (state: AppState) => void) {
  whenOnline(() => {
    updateState((state) => {
      state.conversations[customerId].typing = true;
    });

    const finish = () => {
      clearTimeout(timer);
      typingReplies.delete(finish);
      updateState((state) => {
        state.conversations[customerId].typing = false;
        reply(state);
      });
    };
    const timer = setTimeout(finish, BOT_TYPING_DELAY);
    typingReplies.add(finish);
    if (document.visibilityState === "hidden") finish();
  });
}

function shortCode() {
  const time = serverNow().toString(36).slice(-5);
  const random = Math.floor(Math.random() * 36).toString(36);
  return (time + random).toUpperCase();
}

export function createOrderNumber() {
  return `PS-${shortCode()}`;
}

export function createTicketNumber() {
  return `T-${shortCode()}`;
}

export function findCustomerEmail(state: AppState, customerId: string) {
  return state.customers.find((customer) => customer.id === customerId)?.email ?? "Customer";
}

export function findCustomerTitle(state: AppState, customerId: string) {
  const customer = state.customers.find((item) => item.id === customerId);
  return customer ? customerTitle(customer) : "Customer";
}

export function customerNumberLabel(customer?: Customer) {
  return customer?.number ? `#${customer.number}` : "New";
}

export function liftPaymentPause(state: AppState, customerId: string) {
  const customer = state.customers.find((item) => item.id === customerId);
  if (customer) customer.paymentBlockedUntil = undefined;
}

// A customer with a code marked as unused keeps the whole chat; it is not cleared after 15 days.
// Customers are shown by their WhatsApp number; older accounts without one by their email.
export function customerTitle(customer: Customer) {
  return customer.whatsapp || customer.email;
}

export function keepsChat(state: AppState, customerId: string) {
  return state.orders.some((order) => order.customerId === customerId && order.codeUnused);
}

export function findLatestCode(state: AppState, customerId: string) {
  return state.orders.filter((order) => order.customerId === customerId && order.code).sort((a, b) => (b.reviewedAt ?? 0) - (a.reviewedAt ?? 0))[0];
}

export function extractCodes(text: string) {
  const words = text.match(/\b[A-Z0-9]{6}\b/gi) ?? [];
  return words.filter((word) => /\d/.test(word));
}

export function getActiveOrder(state: AppState, customerId: string) {
  const orderId = state.conversations[customerId]?.activeOrderId;
  return state.orders.find((order) => order.id === orderId);
}

export function findOrderMethod(state: AppState, customerId: string) {
  const order = getActiveOrder(state, customerId);
  const methodId = state.conversations[customerId]?.methodId;
  return state.methods.find((method) => method.id === methodId) ?? state.methods.find((method) => method.name === order?.methodName);
}

export function canStillPay(order: Order, now = serverNow()) {
  return order.status === "awaiting_payment" && order.expiresAt > now;
}
