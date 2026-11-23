import { serverNow } from "./clock.ts";

export function createId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function formatMoney(amount: number) {
  return "Rs " + amount.toLocaleString("en-PK");
}

// Times are always shown in Pakistan time, whatever time zone the phone is set to.
const TIME_ZONE = "Asia/Karachi";
// Pakistan has no daylight saving, so its days always start at 19:00 UTC.
const PAKISTAN_OFFSET_MS = 5 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

const timeFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" });
const shortDateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
const weekdayFormat = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "long" });
const yearFormat = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, year: "numeric" });

export function formatTime(time: number) {
  return timeFormat.format(time);
}

export function formatDate(time: number) {
  return dateFormat.format(time);
}

export function formatDateTime(time: number) {
  return `${formatDate(time)}, ${formatTime(time)}`;
}

// The day number in Pakistan, for telling whether two times fall on the same day.
export function pakistanDay(time: number) {
  return Math.floor((time + PAKISTAN_OFFSET_MS) / DAY_MS);
}

export function pakistanMinutesIntoDay(time: number) {
  return Math.floor(((time + PAKISTAN_OFFSET_MS) % DAY_MS) / 60_000);
}

// The divider above each day in a chat, like WhatsApp: Today, Yesterday, Monday, 23 Oct 2026.
export function chatDayLabel(time: number, now: number) {
  const daysAgo = pakistanDay(now) - pakistanDay(time);
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return weekdayFormat.format(time);
  return formatDate(time);
}

// The time beside a chat in the inbox list: 7:50 PM today, then Yesterday, 7:50 PM, then 21 Nov, 7:50 PM, and only the date in an earlier year.
export function chatListTime(time: number, now: number) {
  const daysAgo = pakistanDay(now) - pakistanDay(time);
  if (daysAgo <= 0) return formatTime(time);
  if (daysAgo === 1) return `Yesterday, ${formatTime(time)}`;
  if (yearFormat.format(time) !== yearFormat.format(now)) return formatDate(time);
  return `${shortDateFormat.format(time)}, ${formatTime(time)}`;
}

export function timeAgo(time: number, now = serverNow()) {
  const seconds = Math.max(0, Math.floor((now - time) / 1000));
  if (seconds < 45) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(time);
}

export function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function classNames(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

export function textColorFor(hex: string) {
  const value = parseInt(hex.replace("#", ""), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const brightness = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return brightness > 0.55 ? "#15130d" : "#ffffff";
}
