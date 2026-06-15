import { createClient } from "@/lib/supabase/client";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";

type ParticipantRow = {
  conversation_id: string;
};

async function ensureParticipants(
  supabase: ReturnType<typeof createClient>,
  conversationId: string
): Promise<void> {
  const { data: session } = await supabase.auth.getSession();

  if (!session?.session) {
    console.error("NO ACTIVE SESSION");
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("SESSION USER:", session.session.user.id);
  console.log("GETUSER ID:", user?.id);

  if (!user) return;

  if (user.id !== session.session.user.id) {
    throw new Error("Auth mismatch between session and user");
  }

  const { error } = await supabase.from("conversation_participants").insert({
    conversation_id: conversationId,
    user_id: user.id,
  });

  if (error && error.code !== "23505") {
    throw new Error(supabaseErrorMessage(error));
  }
}

function pickSharedConversationId(rows: ParticipantRow[]): string | null {
  if (rows.length === 0) return null;

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.conversation_id, (counts.get(row.conversation_id) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  return sorted[0]?.[0] ?? null;
}

/**
 * Returns the active internal team conversation for the current user.
 * Reuses an existing shared conversation when possible; otherwise creates one
 * and adds the current user as a participant.
 */
export async function getOrCreateInternalConversation(
  userId: string,
  _extraParticipantIds: string[] = []
): Promise<string> {
  const supabase = createClient();

  const { data: myRows, error: myError } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);

  if (myError) {
    throw new Error(supabaseErrorMessage(myError));
  }

  if (myRows?.length) {
    const myConversationIds = new Set(myRows.map((row) => row.conversation_id));
    const { data: allRows, error: allError } = await supabase
      .from("conversation_participants")
      .select("conversation_id");

    if (allError) {
      throw new Error(supabaseErrorMessage(allError));
    }

    const counts = new Map<string, number>();
    for (const row of allRows ?? []) {
      if (!myConversationIds.has(row.conversation_id)) continue;
      counts.set(row.conversation_id, (counts.get(row.conversation_id) ?? 0) + 1);
    }

    const conversationId =
      [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
      myRows[0].conversation_id;

    await ensureParticipants(supabase, conversationId);
    return conversationId;
  }

  const { data: allRows, error: allError } = await supabase
    .from("conversation_participants")
    .select("conversation_id");

  if (allError) {
    throw new Error(supabaseErrorMessage(allError));
  }

  const sharedConversationId = pickSharedConversationId(allRows ?? []);
  if (sharedConversationId) {
    await ensureParticipants(supabase, sharedConversationId);
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

  await ensureParticipants(supabase, conversation.id);
  return conversation.id;
}
