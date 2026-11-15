"use client";

import { useSyncExternalStore } from "react";
import { connectionVersion, hasWaitingReplies, isOnline, isRefreshing, isSlow, subscribeConnection } from "@/lib/store/connection";

// Online state and whether a bot reply is waiting for the connection.
export function useConnection() {
  useSyncExternalStore(subscribeConnection, connectionVersion, () => 0);
  return { online: isOnline(), slow: isSlow(), waiting: hasWaitingReplies(), refreshing: isRefreshing() };
}
