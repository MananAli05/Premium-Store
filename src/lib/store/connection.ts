// Whether the app can reach the server, and the bot replies waiting for it.
// While offline, a tap still shows the customer's message (with a clock), but the bot does not answer:
// its reply waits here and runs once the connection is back, in the same order as the taps.

type Listener = () => void;

export const NO_INTERNET_MESSAGE = "No internet connection. Please connect and try again.";

let online = typeof navigator === "undefined" ? true : navigator.onLine;
let slow = false;
const waiting: (() => void)[] = [];
const listeners = new Set<Listener>();
let version = 0;

function notify() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function runWaiting() {
  const hadWaiting = waiting.length > 0;
  while (isOnline() && waiting.length) waiting.shift()!();
  if (hadWaiting && waiting.length === 0) notify();
}

export function setOnline(value: boolean) {
  if (online !== value) {
    online = value;
    notify();
  }
  runWaiting();
}

// The browser is asked as well, in case its offline event has not arrived yet.
export function isOnline() {
  return online && (typeof navigator === "undefined" || navigator.onLine);
}

// Runs now when online, otherwise as soon as the connection returns.
export function whenOnline(run: () => void) {
  if (isOnline() && waiting.length === 0) return run();
  waiting.push(run);
  notify();
  runWaiting();
}

let refreshing = false;

export function setRefreshing(value: boolean) {
  if (refreshing === value) return;
  refreshing = value;
  notify();
}

export function isRefreshing() {
  return refreshing;
}

// Requests are answered, but slowly.
export function setSlow(value: boolean) {
  if (slow === value) return;
  slow = value;
  notify();
}

export function isSlow() {
  return slow;
}

export function hasWaitingReplies() {
  return waiting.length > 0;
}

export function subscribeConnection(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function connectionVersion() {
  return version;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => setOnline(true));
  window.addEventListener("offline", () => setOnline(false));
}
