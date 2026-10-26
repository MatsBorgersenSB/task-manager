"use server";

import { createServiceRoleClient } from "@/lib/admin/delete-auth-user";
import { getCurrentUserRoleServer } from "@/lib/profiles-server";
import { isInternal } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

type ParticipantRow = {
  conversation_id: string;
  user_id: string;
};

type MessageConvRow = {
  conversation_id: string;
};

/**
 * Ensures a single shared internal team conversation exists, moves any stranded
 * messages from single-user conversations into it, and adds all internal/admin
 * users (plus the current user and any mentioned users) to `conversation_participants`.
 */
export async function ensureSharedTeamConversationAction(
  extraParticipantIds: string[] = []
): Promise<{ conversationId: string | null }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { conversationId: null };
    }

    const role = await getCurrentUserRoleServer();
    if (!isInternal(role)) {
      return { conversationId: null };
    }

    const admin = createServiceRoleClient();

    const [{ data: participants }, { data: messages }, { data: internalProfiles }] =
      await Promise.all([
        admin.from("conversation_participants").select("conversation_id, user_id"),
        admin.from("messages").select("conversation_id"),
        admin
          .from("profiles")
          .select("id")
          .in("role", ["admin", "internal"]),
      ]);

    const partRows = (participants ?? []) as ParticipantRow[];
    const msgRows = (messages ?? []) as MessageConvRow[];

    // Pick canonical conversation: prefer the one with the most messages, then most participants.
    const scoreByConv = new Map<string, { messages: number; participants: number }>();

    for (const row of partRows) {
      const current = scoreByConv.get(row.conversation_id) ?? {
        messages: 0,
        participants: 0,
      };
      current.participants += 1;
      scoreByConv.set(row.conversation_id, current);
    }

    for (const row of msgRows) {
      const current = scoreByConv.get(row.conversation_id) ?? {
        messages: 0,
        participants: 0,
      };
      current.messages += 1;
      scoreByConv.set(row.conversation_id, current);
    }

    let sharedConversationId: string | null = null;
    if (scoreByConv.size > 0) {
      const sorted = [...scoreByConv.entries()].sort(([, a], [, b]) => {
        if (b.messages !== a.messages) return b.messages - a.messages;
        return b.participants - a.participants;
      });
      sharedConversationId = sorted[0]?.[0] ?? null;
    }

    if (!sharedConversationId) {
      const { data: created, error: createErr } = await admin
        .from("conversations")
        .insert({})
        .select("id")
        .single();

      if (createErr || !created) {
        return { conversationId: null };
      }
      sharedConversationId = created.id as string;
    }

    // Consolidate any stranded messages from other conversations into the shared conversation.
    const otherMessageConvIds = [
      ...new Set(
        msgRows
          .map((row) => row.conversation_id)
          .filter((id) => id && id !== sharedConversationId)
      ),
    ];

    if (otherMessageConvIds.length > 0) {
      await admin
        .from("messages")
        .update({ conversation_id: sharedConversationId })
        .in("conversation_id", otherMessageConvIds);
    }

    // Ensure all internal/admin users + current user + extraParticipantIds are participants.
    const existingInShared = new Set(
      partRows
        .filter((row) => row.conversation_id === sharedConversationId)
        .map((row) => row.user_id)
    );

    const targetUserIds = new Set<string>([
      user.id,
      ...extraParticipantIds.filter(Boolean),
      ...(internalProfiles ?? []).map((p) => p.id as string).filter(Boolean),
    ]);

    const missingRows = [...targetUserIds]
      .filter((uid) => !existingInShared.has(uid))
      .map((uid) => ({
        conversation_id: sharedConversationId,
        user_id: uid,
      }));

    if (missingRows.length > 0) {
      for (const row of missingRows) {
        await admin.from("conversation_participants").insert(row);
      }
    }

    return { conversationId: sharedConversationId };
  } catch {
    return { conversationId: null };
  }
}
