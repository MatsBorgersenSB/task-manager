import { createClient } from "@/lib/supabase/client";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";

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

/**
 * Returns the current user's personal conversation (single-user model).
 */
export async function getOrCreateInternalConversation(userId: string): Promise<string> {
  const supabase = createClient();

  const { data: existing, error: selectError } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) {
    throw new Error(supabaseErrorMessage(selectError));
  }

  if (existing?.conversation_id) {
    return existing.conversation_id;
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
