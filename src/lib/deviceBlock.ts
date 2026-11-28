const KEY = "premium-store-device-block";

export const DEVICE_BLOCKED_MESSAGE = "This device is blocked. Please contact support.";

export function markDeviceBlocked() {
  try {
    localStorage.setItem(KEY, "blocked");
  } catch {}
}

export function deviceBlocked() {
  try {
    return localStorage.getItem(KEY) === "blocked";
  } catch {
    return false;
  }
}
