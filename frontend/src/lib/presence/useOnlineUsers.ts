"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type OnlineUser = {
  id: string;
  name: string;
};

const PRESENCE_CHANNEL = "online-users";

function displayNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? email;
  return localPart.trim() || email || "User";
}

function parsePresenceState(
  state: Record<string, { id?: string; name?: string }[]>
): OnlineUser[] {
  const users = new Map<string, OnlineUser>();

  for (const presences of Object.values(state)) {
    for (const meta of presences) {
      const id = meta.id?.trim();
      if (!id) continue;
      users.set(id, {
        id,
        name: meta.name?.trim() || "User",
      });
    }
  }

  return [...users.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function useOnlineUsers(): OnlineUser[] {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    async function setup() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) return;

      const name = displayNameFromEmail(user.email ?? "");

      channel = supabase.channel(PRESENCE_CHANNEL, {
        config: { presence: { key: user.id } },
      });

      channel.on("presence", { event: "sync" }, () => {
        if (!channel) return;
        setOnlineUsers(parsePresenceState(channel.presenceState()));
      });

      channel.subscribe(async (status) => {
        if (status !== "SUBSCRIBED" || !channel || cancelled) return;
        await channel.track({ id: user.id, name });
      });
    }

    void setup();

    return () => {
      cancelled = true;
      if (channel) {
        void channel.untrack();
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  return onlineUsers;
}
