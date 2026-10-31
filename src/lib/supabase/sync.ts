import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { serverNow, syncClock } from "../clock";
import { setOnline, setSlow } from "../store/connection";
import { keepsChat } from "../store/helpers";
import { applyRemoteChange, clearState, getState, setChangeHandler } from "../store/state";
import type { AppState, StoreConfig } from "../types";
import { getSupabase, type AppRole } from "./client";
import { configFromRow, configToRow, messageFromRow } from "./mappers";
import { tables, type TableSync } from "./tables";

type Row = Record<string, unknown>;

let activeRole: AppRole | null = null;
let channel: RealtimeChannel | null = null;

// Our own changes are protected from older echoes for this long after the server confirmed them,
// so a slow mobile connection cannot bring back an earlier chat step.
const LOCAL_WRITE_WINDOW_MS = 10_000;
const recentLocalWrites = new Map<string, { at: number; columns: Set<string> }>();

// Empty columns of a new row are not ours to keep: the other side fills them in (delivered and seen ticks).
function rememberLocalWrite(tableName: string, row: Row, key: string, inserted: boolean) {
  const id = `${tableName}:${row[key]}`;
  const previous = recentLocalWrites.get(id);
  const columns = previous && Date.now() - previous.at < LOCAL_WRITE_WINDOW_MS ? previous.columns : new Set<string>();
  for (const [column, value] of Object.entries(row)) {
    // created_at is set by the server, so its value always wins.
    if (column !== key && column !== "created_at" && !(inserted && value == null)) columns.add(column);
  }
  recentLocalWrites.set(id, { at: Date.now(), columns });
}

// The window starts again once the server has the change, however long the request took.
function refreshLocalWrite(tableName: string, id: string) {
  const write = recentLocalWrites.get(`${tableName}:${id}`);
  if (write) write.at = Date.now();
}

// Columns this client wrote in the last few seconds. Their echoes can be older than local state, so they are ignored.
function recentlyWrittenColumns(tableName: string, id: string) {
  const write = recentLocalWrites.get(`${tableName}:${id}`);
  return write && Date.now() - write.at < LOCAL_WRITE_WINDOW_MS ? write.columns : null;
}

// Counts local changes, so a reload that raced with a tap is thrown away instead of undoing the tap.
let localVersion = 0;

export function getActiveClient() {
  if (!activeRole) throw new Error("Data sync has not started");
  return getSupabase(activeRole);
}

function pickConfig(state: AppState): StoreConfig {
  return { settings: state.settings, plans: state.plans, methods: state.methods, faqs: state.faqs };
}

type TableChanges = {
  table: TableSync;
  inserted: Row[];
  updated: Row[];
  deletedIds: string[];
};

// Items that were not touched are the same objects in both states, so only new objects are compared.
function findTableChanges(table: TableSync, before: AppState, after: AppState): TableChanges {
  const oldItems = table.items(before);
  const newItems = table.items(after);
  const changes: TableChanges = { table, inserted: [], updated: [], deletedIds: [] };
  if (oldItems.length === newItems.length && oldItems.every((item, index) => item === newItems[index])) return changes;

  const oldById = new Map(oldItems.map((item) => [table.idOf(item), item]));
  const newIds = new Set<string>();
  for (const item of newItems) {
    const id = table.idOf(item);
    newIds.add(id);
    const previous = oldById.get(id);
    if (previous === undefined) {
      changes.inserted.push(table.toRow(item));
      continue;
    }
    if (previous === item) continue;

    // Send only the columns that changed, so a write never overwrites what someone else changed in another column.
    const row = table.toRow(item);
    const oldRow = table.toRow(previous);
    const changed: Row = { [table.key]: row[table.key] };
    let anyColumn = false;
    for (const [column, value] of Object.entries(row)) {
      if (JSON.stringify(value) !== JSON.stringify(oldRow[column])) {
        changed[column] = value;
        anyColumn = true;
      }
    }
    if (anyColumn) changes.updated.push(changed);
  }
  changes.deletedIds = [...oldById.keys()].filter((id) => !newIds.has(id));
  return changes;
}

// ---------- Outbox ----------
// Every change is kept on the device until the server has it. Changes are sent one by one, in order.
// If the connection drops or the app closes, they are sent again when it comes back, so nothing is lost.
// If the server refuses a change (for example the store has just closed), the screen reloads from the server
// so it always matches what is really saved.

type Op =
  | { kind: "insert"; table: string; key: string; rows: Row[]; tries: number }
  | { kind: "update"; table: string; key: string; row: Row; tries: number }
  | { kind: "delete"; table: string; key: string; ids: string[]; tries: number }
  | { kind: "config"; row: Row; tries: number };

const PROOF_SAVE_ATTEMPTS = 3;

let outbox: Op[] = [];
let outboxKey = "";
let flushing: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let refreshWanted = false;
const problemListeners = new Set<(message: string) => void>();
const pendingListeners = new Set<() => void>();
let pendingVersion = 0;

// Messages written on this device that the server does not have yet (shown with a clock).
export function pendingMessageIds() {
  const ids = new Set<string>();
  for (const op of outbox) if (op.kind === "insert" && op.table === "messages") op.rows.forEach((row) => ids.add(String(row.id)));
  return ids;
}

export function subscribePending(listener: () => void) {
  pendingListeners.add(listener);
  return () => {
    pendingListeners.delete(listener);
  };
}

export function pendingSnapshot() {
  return pendingVersion;
}

// Lets the apps tell the person when the server refused something they did.
export function onSyncProblem(listener: (message: string) => void) {
  problemListeners.add(listener);
  return () => {
    problemListeners.delete(listener);
  };
}

function saveOutbox() {
  pendingVersion += 1;
  pendingListeners.forEach((listener) => listener());
  try {
    if (outbox.length) localStorage.setItem(outboxKey, JSON.stringify(outbox));
    else localStorage.removeItem(outboxKey);
  } catch {
    // Without storage the outbox still works while the app is open.
  }
}

function loadOutbox(key: string) {
  outboxKey = key;
  try {
    outbox = JSON.parse(localStorage.getItem(key) ?? "[]") as Op[];
  } catch {
    outbox = [];
  }
}

type WriteResult = { error: { message: string; code?: string } | null; status: number };

// No answer, a server hiccup or an expired sign-in can pass; a refusal by the database rules cannot.
function canRetry({ error, status }: WriteResult) {
  if (!error) return false;
  if (!error.code || status === 0 || status === 401 || status === 408 || status === 429 || status >= 500) return true;
  return error.code === "PGRST301" || error.code === "PGRST303";
}

async function runOp(client: SupabaseClient, op: Op): Promise<WriteResult> {
  if (op.kind === "insert") {
    let rows = op.rows;
    // After a failed attempt the rows may have arrived anyway, so only the missing ones are sent again.
    if (op.tries > 0) {
      const ids = rows.map((row) => row[op.key]);
      const { data, error, status } = await client.from(op.table).select(op.key).in(op.key, ids);
      if (error) return { error, status };
      const saved = new Set((data ?? []).map((row) => String((row as unknown as Row)[op.key])));
      rows = rows.filter((row) => !saved.has(String(row[op.key])));
      if (rows.length === 0) return { error: null, status: 200 };
    }
    return await client.from(op.table).insert(rows);
  }
  if (op.kind === "update") return await client.from(op.table).update(op.row).eq(op.key, op.row[op.key]);
  if (op.kind === "delete") return await client.from(op.table).delete().in(op.key, op.ids);
  return await client.from("store_config").upsert(op.row);
}

function forgetLocalWrites(op: Op) {
  if (op.kind === "insert") op.rows.forEach((row) => recentLocalWrites.delete(`${op.table}:${row[op.key]}`));
  if (op.kind === "update") recentLocalWrites.delete(`${op.table}:${op.row[op.key]}`);
}

function scheduleRetry(tries: number) {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void flushOutbox(), Math.min(30_000, 1000 * 2 ** Math.min(tries, 5)));
}

function flushOutbox(): Promise<void> {
  if (!flushing) {
    flushing = sendOutbox().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function sendOutbox() {
  let refused = false;
  while (activeRole && outbox.length) {
    const op = outbox[0];
    const result: WriteResult = await runOp(getActiveClient(), op).catch((error: unknown) => ({ error: { message: String(error) }, status: 0 }));

    if (result.error && canRetry(result)) {
      if (result.status === 0) setOnline(false);
      op.tries += 1;
      saveOutbox();
      scheduleRetry(op.tries);
      return;
    }

    setOnline(true);
    outbox.shift();
    saveOutbox();
    if (result.error) {
      const message = result.error.message;
      console.warn(`The server refused a change to ${op.kind === "config" ? "settings" : op.table}`, message);
      forgetLocalWrites(op);
      refused = true;
      problemListeners.forEach((listener) => listener(message));
    } else if (op.kind === "update") {
      refreshLocalWrite(op.table, String(op.row[op.key]));
    }
  }

  // After a refusal the screen holds something the server does not have, so everything is loaded again.
  if (activeRole && (refused || refreshWanted)) {
    refreshWanted = false;
    void catchUp(false, refused);
  }
}

export async function saveProofNow(orderId: string, screenshot: string, senderName: string) {
  const client = getActiveClient();
  for (let attempt = 1; ; attempt++) {
    await flushOutbox();
    const result = await client.from("orders").update({ status: "pending_review", screenshot, sender_name: senderName }).eq("id", orderId).select("id");
    if (!result.error && result.data?.length) return null;

    const { data } = await client.from("orders").select("screenshot").eq("id", orderId).maybeSingle();
    if (data?.screenshot === screenshot) return null;

    if (attempt === PROOF_SAVE_ATTEMPTS || (result.error && !canRetry(result))) return result.error?.message ?? "The order is not on the server yet";
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }
}

function queueChanges(changes: TableChanges[], config: StoreConfig | null) {
  for (const { table, inserted, updated, deletedIds } of changes) {
    if (inserted.length) outbox.push({ kind: "insert", table: table.name, key: table.key, rows: inserted, tries: 0 });
    for (const row of updated) outbox.push({ kind: "update", table: table.name, key: table.key, row, tries: 0 });
    if (deletedIds.length && activeRole === "admin") outbox.push({ kind: "delete", table: table.name, key: table.key, ids: deletedIds, tries: 0 });
  }
  if (config) outbox.push({ kind: "config", row: configToRow(config), tries: 0 });
  saveOutbox();
  void flushOutbox();
}

function handleLocalChange(before: AppState, after: AppState) {
  const changes = tables.map((table) => findTableChanges(table, before, after));
  localVersion += 1;

  for (const change of changes) {
    for (const row of change.inserted) rememberLocalWrite(change.table.name, row, change.table.key, true);
    for (const row of change.updated) rememberLocalWrite(change.table.name, row, change.table.key, false);
  }

  const configTouched = before.settings !== after.settings || before.plans !== after.plans || before.methods !== after.methods || before.faqs !== after.faqs;
  const configChanged = activeRole === "admin" && configTouched && JSON.stringify(pickConfig(before)) !== JSON.stringify(pickConfig(after));
  queueChanges(changes, configChanged ? pickConfig(after) : null);
  saveCache();
}

function handleOnline() {
  void flushOutbox();
  void catchUp();
}

const PAGE_SIZE = 1000;

// Supabase returns at most 1000 rows per request, so larger tables are read page by page. The first page
// also gives the row count, and the remaining pages are then read all at once instead of one after another.
async function fetchAllRows(client: SupabaseClient, table: TableSync, messagesSince?: number, changedSince?: string, messagesBefore?: number) {
  const page = (from: number, withCount = false) => {
    let query = client.from(table.name).select("*", withCount ? { count: "exact" } : undefined);
    if (messagesSince !== undefined && table.name === "messages") query = query.gt("created_at", messagesSince);
    if (messagesBefore !== undefined && table.name === "messages") query = query.lte("created_at", messagesBefore);
    if (changedSince) query = query.gte("updated_at", changedSince);
    return query.order(table.key).range(from, from + PAGE_SIZE - 1);
  };
  const first = await page(0, true);
  if (first.error) return { data: null, error: first.error };
  const rows: Row[] = [...(first.data ?? [])];
  if (rows.length < PAGE_SIZE) return { data: rows, error: null };

  const total = first.count ?? 0;
  const starts: number[] = [];
  for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) starts.push(from);
  const pages = await Promise.all(starts.map((from) => page(from)));
  for (const next of pages) {
    if (next.error) return { data: null, error: next.error };
    rows.push(...(next.data ?? []));
  }
  // Rows added while reading (or a missing count) are picked up page by page as before.
  for (let from = PAGE_SIZE + starts.length * PAGE_SIZE; rows.length === from; from += PAGE_SIZE) {
    const next = await page(from);
    if (next.error) return { data: null, error: next.error };
    rows.push(...(next.data ?? []));
  }
  // A row saved while the pages were read can shift into two pages; it is kept once.
  const unique = new Map(rows.map((row) => [row[table.key], row]));
  return { data: unique.size === rows.length ? rows : [...unique.values()], error: null };
}

// With messagesSince, only newer messages are read; older ones on screen are kept as they are.
async function fetchEverything(client: SupabaseClient, messagesSince?: number) {
  const [results, config] = await Promise.all([
    Promise.all(tables.map((table) => fetchAllRows(client, table, messagesSince))),
    client.from("store_config").select("*").maybeSingle(),
  ]);
  return { results, config, messagesSince };
}

// ---------- Changes only ----------
// After a full load, the regular checks ask only for rows changed since the last check (updated_at,
// set by the database). Nothing changed means almost no data. Until the updated_at columns exist
// (supabase/updates/023_updated_at.sql) the app keeps loading everything as before.
const CHANGES_OVERLAP_MS = 60_000;
const FULL_LOAD_EVERY_MS = 24 * 60 * 60_000;
const CHAT_KEPT_MS = 15 * 24 * 60 * 60_000;
let changesSince: number | null = null;
let lastFullLoadAt = 0;
let changesSupported = true;

async function fetchChanges(client: SupabaseClient, since: number) {
  const changedSince = new Date(since - CHANGES_OVERLAP_MS).toISOString();
  const [results, config] = await Promise.all([
    Promise.all(tables.map((table) => fetchAllRows(client, table, undefined, changedSince))),
    client.from("store_config").select("*").gte("updated_at", changedSince).maybeSingle(),
  ]);
  return { results, config };
}

// A row from the server, keeping the columns this device changed in the last few seconds.
function mergeRemoteRow(draft: AppState, table: TableSync, row: Row) {
  const ownColumns = recentlyWrittenColumns(table.name, String(row[table.key]));
  if (!ownColumns) return table.apply(draft, row);
  const localItem = table.items(draft).find((item) => table.idOf(item) === String(row[table.key]));
  const local = localItem === undefined ? undefined : table.toRow(localItem);
  if (!local) return table.apply(draft, row);
  const merged: Row = { ...row };
  for (const column of ownColumns) if (column in local) merged[column] = local[column];
  table.apply(draft, merged);
  table.applyServerFields?.(draft, row);
}

// The server deletes chat messages after 15 days; the copy on the device does the same.
function removeOldMessages(draft: AppState) {
  const cutoff = serverNow() - CHAT_KEPT_MS;
  if (!draft.messages.some((message) => message.createdAt < cutoff)) return;
  draft.messages = draft.messages.filter((message) => message.createdAt >= cutoff || keepsChat(draft, message.customerId));
}

type ChangesResult = "done" | "failed" | "unsupported";

async function catchUpChanges(client: SupabaseClient): Promise<ChangesResult> {
  if (changesSince === null) return "unsupported";
  for (let attempt = 0; attempt < 3; attempt++) {
    const version = localVersion;
    const startedAt = serverNow();
    const started = Date.now();
    const { results, config } = await fetchChanges(client, changesSince);
    setSlow(Date.now() - started > SLOW_CONNECTION_MS);
    if (!activeRole) return "failed";

    const errors = [...results.map((result) => result.error), config.error].filter((error) => error);
    if (errors.some((error) => error?.code === "42703")) {
      changesSupported = false;
      return "unsupported";
    }
    if (errors.length) {
      if (errors.some((error) => error && !error.code)) setOnline(false);
      return "failed";
    }
    setOnline(true);
    if (version !== localVersion) continue;

    applyRemoteChange((draft) => {
      tables.forEach((table, index) => results[index].data?.forEach((row) => mergeRemoteRow(draft, table, row)));
      if (config.data) Object.assign(draft, configFromRow(config.data));
      removeOldMessages(draft);
    });
    changesSince = startedAt;
    saveCache();
    return "done";
  }
  return "failed";
}

// The data is kept on the device: a signed-in customer can open the chat without a connection, and the
// admin panel opens at once with what it showed last time while the fresh data loads.
let cacheKey = "";
const cacheVersion = () => (activeRole === "admin" ? 3 : 2);
let cacheTimer: ReturnType<typeof setTimeout> | undefined;
const CACHE_DELAY_MS = 1500;

// Writing the copy takes a moment with thousands of messages, so it happens once things go quiet, not on every tap.
function saveCache() {
  if (!cacheKey) return;
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(writeCache, CACHE_DELAY_MS);
}

// Leaving the page (or the phone hiding it) writes a waiting copy straight away.
function flushCache() {
  if (cacheTimer) writeCache();
}

function writeCache() {
  clearTimeout(cacheTimer);
  cacheTimer = undefined;
  if (!cacheKey) return;
  try {
    const state = getState();
    const recentFrom = serverNow() - RECENT_MESSAGES_MS;
    const rowsFor = (table: TableSync) =>
      table.name === "messages" && activeRole === "admin" ? table.readRows({ ...state, messages: state.messages.filter((message) => message.createdAt > recentFrom) }) : table.readRows(state);
    const snapshot = {
      version: cacheVersion(),
      tables: Object.fromEntries(tables.map((table) => [table.name, rowsFor(table)])),
      config: configToRow(pickConfig(state)),
      changesSince,
      lastFullLoadAt,
    };
    localStorage.setItem(cacheKey, JSON.stringify(snapshot));
  } catch {
    try {
      localStorage.removeItem(cacheKey);
    } catch {}
  }
}

function loadCache() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(cacheKey) ?? "null") as {
      version?: number;
      tables: Record<string, Row[]>;
      config: Row;
      changesSince?: number | null;
      lastFullLoadAt?: number;
    } | null;
    if (!snapshot || snapshot.version !== cacheVersion()) return false;
    applyRemoteChange((draft) => {
      tables.forEach((table) => table.replaceAll(draft, snapshot.tables[table.name] ?? []));
      Object.assign(draft, configFromRow(snapshot.config));
      removeOldMessages(draft);
      draft.loaded = true;
    });
    changesSince = snapshot.changesSince ?? null;
    lastFullLoadAt = snapshot.lastFullLoadAt ?? 0;
    return true;
  } catch {
    return false;
  }
}

const LOAD_RETRY_MS = 5000;

// The admin panel opens with the last two days of chat; older messages follow in the background.
const RECENT_MESSAGES_MS = 2 * 24 * 60 * 60_000;
let olderMessagesLoaded = false;
let olderMessagesDone = false;
const loadedChats = new Set<string>();

function mergeOlderMessages(rows: Row[]) {
  applyRemoteChange((draft) => {
    const known = new Set(draft.messages.map((message) => message.id));
    const older = rows.filter((row) => !known.has(String(row.id))).map(messageFromRow);
    if (older.length) draft.messages = [...older, ...draft.messages].sort((a, b) => a.createdAt - b.createdAt);
  });
}

export function chatHistoryReady(customerId: string) {
  return activeRole !== "admin" || olderMessagesDone || loadedChats.has(customerId);
}

// Opening a chat before the older messages have arrived loads that one chat straight away.
export async function loadChatHistory(customerId: string) {
  if (chatHistoryReady(customerId)) return;
  const { data, error } = await getSupabase("admin").from("messages").select("*").eq("customer_id", customerId).order("created_at");
  if (error || !data || activeRole !== "admin") return;
  loadedChats.add(customerId);
  mergeOlderMessages(data);
}

function recentMessagesFrom() {
  return activeRole === "admin" ? serverNow() - RECENT_MESSAGES_MS : undefined;
}

async function loadOlderMessages(client: SupabaseClient) {
  if (activeRole !== "admin" || olderMessagesLoaded) return;
  olderMessagesLoaded = true;
  const messages = tables.find((table) => table.name === "messages")!;
  const result = await fetchAllRows(client, messages, undefined, undefined, serverNow() - RECENT_MESSAGES_MS + 60 * 60_000);
  if (activeRole !== "admin") return;
  if (!result.data) {
    olderMessagesLoaded = false;
  olderMessagesDone = false;
  loadedChats.clear();
    return;
  }
  mergeOlderMessages(result.data);
  olderMessagesDone = true;
}
let loadRetryTimer: ReturnType<typeof setTimeout> | undefined;

// The first load must be complete before anything shows; half a load would look like the data was gone.
// Until it succeeds the app keeps its loading screen (or the customer's copy on the device) and tries again.
async function loadEverything(client: SupabaseClient) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const version = localVersion;
    const startedAt = serverNow();
    const data = await fetchEverything(client, recentMessagesFrom());
    if (!activeRole) return;
    if (!looksComplete(data)) break;
    // A change made on the device's copy while loading is newer than this load, so it loads again.
    if (version === localVersion || attempt === 2) {
      await applyEverything(client, data, startedAt);
      void loadOlderMessages(client);
      return;
    }
  }
  if (activeRole === "customer" && !getState().loaded) loadCache();
  clearTimeout(loadRetryTimer);
  loadRetryTimer = setTimeout(() => {
    if (activeRole) void loadEverything(client);
  }, LOAD_RETRY_MS);
}

// startedAt marks a full load: later checks only ask for changes made after it.
async function applyEverything(client: SupabaseClient, { results, config, messagesSince }: Awaited<ReturnType<typeof fetchEverything>>, startedAt?: number) {
  applyRemoteChange((draft) => {
    // A table that failed to load keeps what is on screen instead of being emptied.
    tables.forEach((table, index) => {
      const rows = results[index].data;
      if (!rows) return;
      if (messagesSince !== undefined && table.replaceRecent) {
        table.replaceRecent(draft, rows, messagesSince);
      } else {
        table.replaceAll(draft, rows);
      }
    });
    if (config.data) Object.assign(draft, configFromRow(config.data));
    draft.loaded = true;
  });
  if (startedAt !== undefined) {
    changesSince = changesSupported ? startedAt : null;
    lastFullLoadAt = Date.now();
  }
  saveCache();

  if (!config.data && activeRole === "admin") {
    await client.from("store_config").insert(configToRow(pickConfig(getState())));
  }
}

function listenForChanges(client: SupabaseClient) {
  // A fresh name each time, so a channel that is still closing (for example after going offline) is never reused.
  channel = client.channel(`premium-store-data-${Math.random().toString(36).slice(2)}`);

  for (const table of tables) {
    channel.on("postgres_changes", { event: "*", schema: "public", table: table.name }, (payload) => {
      if (payload.eventType === "DELETE") {
        const id = String((payload.old as Row)[table.key]);
        applyRemoteChange((draft) => table.remove(draft, id));
        return;
      }

      const row = payload.new as Row;
      applyRemoteChange((draft) => mergeRemoteRow(draft, table, row));
    });
  }

  channel.on("postgres_changes", { event: "*", schema: "public", table: "store_config" }, (payload) => {
    if (payload.eventType === "DELETE") return;
    applyRemoteChange((draft) => Object.assign(draft, configFromRow(payload.new as Row)));
  });

  let subscribedBefore = false;
  channel.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    if (subscribedBefore) void catchUp();
    subscribedBefore = true;
  });
}

const CATCH_UP_AFTER_HIDDEN_MS = 10_000;
let hiddenSince = 0;

// A phone can lose the live connection without saying so, even with the app on screen.
// Both apps therefore refresh every 20 seconds; messages only for the last 30 minutes to keep it light.
const ADMIN_REFRESH_MS = 20_000;
const ADMIN_REFRESH_MESSAGES_MS = 30 * 60_000;
let refreshTimer: ReturnType<typeof setInterval> | undefined;

// Events sent while the connection was down are not replayed, so what changed is loaded again.
// A reload that overlapped a local change is older than the screen, so it is retried.
async function catchUp(recentMessagesOnly = false, fullLoadNeeded = false) {
  void syncClock();
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!activeRole) return;
    // Changes still waiting to be sent are newer than the server; reload once they are through.
    if (outbox.length && outbox[0].tries < 3) {
      refreshWanted = true;
      void flushOutbox();
      return;
    }
    const version = localVersion;
    const client = getActiveClient();
    // Right after a phone wakes the tab, the sign-in may not be refreshed yet. A reload without it comes back
    // empty or half loaded, so what is on screen is kept and the next return tries again.
    const { data: auth } = await client.auth.getSession();
    if (!auth.session) return;
    // Only what changed, with a full load once a day in case something was missed.
    if (!fullLoadNeeded && changesSupported && Date.now() - lastFullLoadAt < FULL_LOAD_EVERY_MS) {
      const result = await catchUpChanges(client);
      if (result === "done") void loadOlderMessages(client);
      if (result !== "unsupported") return;
    }
    const fullLoad = !recentMessagesOnly;
    const startedAt = serverNow();
    const started = Date.now();
    const data = await fetchEverything(client, fullLoad ? recentMessagesFrom() : serverNow() - ADMIN_REFRESH_MESSAGES_MS);
    setSlow(Date.now() - started > SLOW_CONNECTION_MS);
    if (!activeRole) return;
    if (!looksComplete(data)) {
      if (lostConnection(data)) setOnline(false);
      return;
    }
    setOnline(true);
    if (version === localVersion) return applyEverything(client, data, fullLoad ? startedAt : undefined);
  }
}

const SLOW_CONNECTION_MS = 6000;

// Errors without a database code mean the request never got an answer.
function lostConnection({ results, config }: Awaited<ReturnType<typeof fetchEverything>>) {
  return [...results.map((result) => result.error), config.error].some((error) => error && !error.code);
}

// Every table loaded, and the customers did not vanish (which only happens when the request was not signed in).
function looksComplete({ results }: Awaited<ReturnType<typeof fetchEverything>>) {
  if (results.some((result) => result.error || !result.data)) return false;
  const customers = results[tables.findIndex((table) => table.name === "customers")]?.data ?? [];
  return customers.length > 0 || getState().customers.length === 0;
}

function handleVisibility() {
  if (document.visibilityState === "hidden") {
    hiddenSince = Date.now();
    flushCache();
    return;
  }
  if (hiddenSince && Date.now() - hiddenSince > CATCH_UP_AFTER_HIDDEN_MS) void catchUp();
  hiddenSince = 0;
}

export async function startSync(role: AppRole) {
  if (activeRole === role) return;
  await stopSync();

  activeRole = role;
  void syncClock();
  const client = getSupabase(role);
  // Changes left from an earlier visit (connection lost or app closed) are sent before loading.
  const { data: auth } = await client.auth.getSession();
  const userId = auth.session?.user.id ?? "guest";
  loadOutbox(`premium-store-outbox:${role}:${userId}`);
  cacheKey = role === "customer" ? `premium-store-cache:${userId}` : `premium-store-cache:admin:${userId}`;
  // The admin panel shows its copy from last time right away; changes made on it are sent as usual.
  const cached = role === "admin" && loadCache();
  if (cached) setChangeHandler(handleLocalChange);
  if (outbox.length) await flushOutbox();
  // With a copy from the last day, only what changed since then is loaded.
  const fresh = cached && changesSince !== null && Date.now() - lastFullLoadAt < FULL_LOAD_EVERY_MS;
  if (!fresh || (await catchUpChanges(client)) === "unsupported") await loadEverything(client);
  else void loadOlderMessages(client);
  setChangeHandler(handleLocalChange);
  listenForChanges(client);
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("online", handleOnline);
  window.addEventListener("pagehide", flushCache);
  refreshTimer = setInterval(() => {
    if (document.visibilityState === "visible") void catchUp(true);
  }, ADMIN_REFRESH_MS);
}

export async function stopSync() {
  clearInterval(refreshTimer);
  refreshTimer = undefined;
  clearTimeout(retryTimer);
  clearTimeout(loadRetryTimer);
  // Unsent changes stay saved on the device for this account and go out at the next sign-in.
  outbox = [];
  // Signing out removes the copy of the chat kept on the device.
  clearTimeout(cacheTimer);
  cacheTimer = undefined;
  try {
    if (cacheKey) localStorage.removeItem(cacheKey);
  } catch {
    // Nothing was stored.
  }
  cacheKey = "";
  changesSince = null;
  lastFullLoadAt = 0;
  olderMessagesLoaded = false;
  changesSupported = true;
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("pagehide", flushCache);
  document.removeEventListener("visibilitychange", handleVisibility);
  setChangeHandler(null);
  if (channel && activeRole) await getSupabase(activeRole).removeChannel(channel);
  channel = null;
  activeRole = null;
  clearState();
}
