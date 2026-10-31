const PICKING_KEY = "premium-store:picking-picture";
const PICKING_FORGOTTEN_MS = 5 * 60 * 1000;

export function rememberPicking(customerId: string) {
  try {
    localStorage.setItem(PICKING_KEY, JSON.stringify({ customerId, at: Date.now() }));
  } catch {}
}

export function forgetPicking() {
  try {
    localStorage.removeItem(PICKING_KEY);
  } catch {}
}

export function pickingWasInterrupted(customerId: string) {
  try {
    const saved = JSON.parse(localStorage.getItem(PICKING_KEY) ?? "null");
    return saved?.customerId === customerId && Date.now() - saved.at < PICKING_FORGOTTEN_MS;
  } catch {
    return false;
  }
}
