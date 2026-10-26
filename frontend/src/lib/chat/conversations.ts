import { ensureSharedTeamConversationAction } from "@/lib/chat/actions";
import { createClient } from "@/lib/supabase/client";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";

export type ParticipantRow = {
  conversation_id: string;
  user_id?: string;
};

/**
 * Picks the canonical shared conversation ID from participant rows.
 * Selects the conversation with the highest participant count, tie-breaking
 * by first appearance order.
 */
export function pickSharedConversationId(
  rows: readonly ParticipantRow[]
): string | null {
  if (rows.length === 0) return null;

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.conversation_id) continue;
    counts.set(row.conversation_id, (counts.get(row.conversation_id) ?? 0) + 1);
  }

  if (counts.size === 0) return null;

  const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  return sorted[0]?.[0] ?? null;
}

async function ensureSelfParticipant(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  userId: string
): Promise<void> {
  if (!userId) return;

  const { error } = await supabase.from("conversation_participants").insert({
    conversation_id: conversationId,
    user_id: userId,
  });

  if (error && error.code !== "23505" && !error.message?.includes("duplicate")) {
    throw new Error(supabaseErrorMessage(error));
  }
}

/**
 * Returns the shared internal team conversation ID and ensures the current user
 * (plus any mentioned teammates when server action is available) is a participant.
 */
export async function getOrCreateInternalConversation(
  userId: string,
  extraParticipantIds: string[] = []
): Promise<string> {
  const synced = await ensureSharedTeamConversationAction(extraParticipantIds);
  if (synced.conversationId) {
    return synced.conversationId;
  }

  const supabase = createClient();

  const { data: allRows, error: allError } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id");

  if (allError) {
    throw new Error(supabaseErrorMessage(allError));
  }

  const participantRows = (allRows ?? []) as ParticipantRow[];
  const sharedConversationId = pickSharedConversationId(participantRows);

  if (sharedConversationId) {
    const alreadyInShared = participantRows.some(
      (row) =>
        row.conversation_id === sharedConversationId && row.user_id === userId
    );
    if (!alreadyInShared) {
      await ensureSelfParticipant(supabase, sharedConversationId, userId);
    }
    return sharedConversationId;
  }

  const { data: conversation, error: createError } = await supabase
    .from("conversations")
    .insert({})
    .select("id")
    .single();

  if (createError || !conversation) {
    throw new Error(supabaseErrorMessage(createError));
  }

  await ensureSelfParticipant(supabase, conversation.id, userId);
  return conversation.id;
}
