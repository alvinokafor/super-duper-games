import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

type Handlers = Record<string, (payload: unknown) => void>;

// Listens on a private channel while mounted. onSubscribed runs on every
// (re)connect, so callers can refetch anything missed while offline.
// The set of event names must stay the same for a given topic.
export function useChannel(topic: string | null, handlers: Handlers, onSubscribed?: () => void) {
  const handlersRef = useRef(handlers);
  const onSubscribedRef = useRef(onSubscribed);
  useEffect(() => {
    handlersRef.current = handlers;
    onSubscribedRef.current = onSubscribed;
  });

  useEffect(() => {
    if (!topic) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    void (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase.channel(topic, { config: { private: true } });
      for (const event of Object.keys(handlersRef.current)) {
        channel.on("broadcast", { event }, (message) => handlersRef.current[event]?.(message.payload));
      }
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") onSubscribedRef.current?.();
      });
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [topic]);
}
