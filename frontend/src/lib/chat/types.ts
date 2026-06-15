export type ChatMessage = {
  id: string;
  user_id: string;
  message: string;
  mentioned_user_ids: string[];
  created_at: string;
  author_email: string | null;
};
