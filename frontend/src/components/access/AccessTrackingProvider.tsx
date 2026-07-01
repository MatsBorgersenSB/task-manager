"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  beginAccessSession,
  detectAuthProvider,
  sendActivityHeartbeat,
} from "@/lib/access/client";

const HEARTBEAT_MS = 60_000;

export default function AccessTrackingProvider() {
  useEffect(() => {
    const supabase = createClient();
    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function startTracking() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) return;

      const provider = detectAuthProvider(user.app_metadata);
      await beginAccessSession(provider);

      interval = setInterval(() => {
        void sendActivityHeartbeat();
      }, HEARTBEAT_MS);
    }

    void startTracking();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const provider = detectAuthProvider(session.user.app_metadata);
        void beginAccessSession(provider);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      if (interval) clearInterval(interval);
    };
  }, []);

  return null;
}
