"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { env } from "@/config/env";
import { MAX_EVENTS } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import { useLiveStore } from "@/stores/live-store";
import type { BotEvent, StreamMessage } from "@/types/api";

/**
 * One WebSocket to the bot for the whole app. Pushes server data straight into the
 * TanStack Query cache (so components just use their queries), ticks into Zustand.
 * Reconnects with exponential backoff (1s, 2s, 4s ... max 15s).
 */
export function useLiveStream() {
  const queryClient = useQueryClient();
  const setConnection = useLiveStore((s) => s.setConnection);
  const setTick = useLiveStore((s) => s.setTick);
  const setLiveEvent = useLiveStore((s) => s.setLiveEvent);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const handle = (msg: StreamMessage) => {
      switch (msg.kind) {
        case "status":
          queryClient.setQueryData(queryKeys.status, msg.data);
          break;
        case "history":
          queryClient.setQueryData<BotEvent[]>(queryKeys.events, [...msg.data].reverse());
          break;
        case "tick":
          setTick(msg.data);
          break;
        default:
          queryClient.setQueryData<BotEvent[]>(queryKeys.events, (old = []) =>
            [msg, ...old].slice(0, MAX_EVENTS),
          );
          setLiveEvent(msg);
          if (msg.kind === "order" || msg.kind === "trade") {
            void queryClient.invalidateQueries({ queryKey: ["trades"] });
          }
      }
    };

    const connect = () => {
      setConnection("connecting");
      socket = new WebSocket(env.wsUrl);
      socket.onopen = () => {
        retry = 0;
        setConnection("open");
      };
      socket.onmessage = (e) => handle(JSON.parse(e.data) as StreamMessage);
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        setConnection("closed");
        if (!disposed) timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
      };
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [queryClient, setConnection, setTick, setLiveEvent]);
}
