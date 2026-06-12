"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  commentAuthorLabel,
  createTaskComment,
  formatPanelTimestamp,
  type CommentType,
  type TaskComment,
} from "@/lib/tasks/comments";
import { ui } from "@/lib/ui/classes";

type TaskCommentSectionProps = {
  title: string;
  type: CommentType;
  taskId: string;
  comments: TaskComment[];
  loading?: boolean;
  canPost?: boolean;
  onCommentAdded?: () => void;
};

const textareaClass = `${ui.input} ${ui.textarea}`;

export default function TaskCommentSection({
  title,
  type,
  taskId,
  comments,
  loading = false,
  canPost = true,
  onCommentAdded,
}: TaskCommentSectionProps) {
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;

    setPosting(true);
    setPostError(null);
    try {
      await createTaskComment(taskId, type, message);
      setMessage("");
      onCommentAdded?.();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Failed to post comment.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-primary">{title}</h3>

      <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-sm text-muted">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted">No comments yet.</p>
        ) : (
          comments.map((comment) => (
            <article
              key={comment.id}
              className="rounded-lg border border-border bg-background/60 p-3"
            >
              <p className="whitespace-pre-wrap break-words text-sm text-primary">
                {comment.message}
              </p>
              <p className="mt-2 text-xs text-muted">
                {commentAuthorLabel(comment, currentUserId)} ·{" "}
                {formatPanelTimestamp(comment.created_at)}
              </p>
            </article>
          ))
        )}
      </div>

      {canPost ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <label className="sr-only" htmlFor={`comment-${type}-${taskId}`}>
            Add {title.toLowerCase()}
          </label>
          <textarea
            id={`comment-${type}-${taskId}`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={textareaClass}
            rows={3}
            placeholder={`Add a ${type} comment…`}
          />
          {postError ? <p className="text-xs text-red-600">{postError}</p> : null}
          <button
            type="submit"
            disabled={posting || !message.trim()}
            className={`${ui.btnPrimarySm} disabled:opacity-50`}
          >
            {posting ? "Posting…" : "Add comment"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
