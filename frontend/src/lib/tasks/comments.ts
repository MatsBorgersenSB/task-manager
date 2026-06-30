"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logTaskEvent } from "@/lib/tasks/activityLogging";
import { logProjectActivity } from "@/lib/tasks/projectActivity";
import { notifyClientComment, notifyCommentMention } from "@/lib/tasks/notifications";
import { userIdsForMentions } from "@/lib/attention/mentions";
import { fetchAppUsers } from "@/lib/tasks/api";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import { formatPanelTimestamp } from "@/lib/tasks/taskPanel";
import type { TaskViewMode } from "@/lib/tasks/types";

export type CommentType = "client" | "internal";

export type TaskComment = {
  id: string;
  task_id: string;
  user_id: string;
  type: CommentType;
  message: string;
  created_at: string;
  author_email: string | null;
};

type CommentRow = {
  id: string;
  task_id: string;
  user_id: string;
  type: CommentType;
  message: string;
  created_at: string;
  profiles: { email: string } | { email: string }[] | null;
};

function mapCommentRow(row: CommentRow): TaskComment {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    task_id: row.task_id,
    user_id: row.user_id,
    type: row.type,
    message: row.message,
    created_at: row.created_at,
    author_email: profile?.email ?? null,
  };
}

export async function fetchTaskComments(
  taskId: string,
  mode: TaskViewMode
): Promise<TaskComment[]> {
  const supabase = createClient();
  let query = supabase
    .from("comments")
    .select("id, task_id, user_id, type, message, created_at, profiles:user_id (email)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (mode === "client") {
    query = query.eq("type", "client");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return ((data ?? []) as CommentRow[]).map(mapCommentRow);
}

export async function createTaskComment(
  taskId: string,
  type: CommentType,
  message: string,
  projectId?: string | null,
  taskLabel?: string | null
): Promise<TaskComment> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Comment cannot be empty.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to comment.");
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({
      task_id: taskId,
      user_id: user.id,
      type,
      message: trimmed,
    })
    .select("id, task_id, user_id, type, message, created_at, profiles:user_id (email)")
    .single();

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  const comment = mapCommentRow(data as CommentRow);
  try {
    await logTaskEvent(
      taskId,
      "comment_added",
      type === "internal" ? "Internal Comment" : "Client Comment",
      null,
      trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed
    );
    if (projectId) {
      await logProjectActivity({
        projectId,
        taskId,
        eventType:
          type === "client" ? "client_comment_added" : "internal_comment_added",
        summary:
          type === "client"
            ? "Client added comment"
            : "Internal note added",
        detail: trimmed.length > 200 ? `${trimmed.slice(0, 197)}…` : trimmed,
        clientVisible: type === "client",
      });
      if (type === "client") {
        void notifyClientComment({
          projectId,
          taskId,
          taskLabel: taskLabel?.trim() || "Task",
          message: trimmed,
        });
      } else {
        void (async () => {
          const users = await fetchAppUsers();
          const mentionIds = userIdsForMentions(trimmed, users, user.id);
          if (mentionIds.length > 0) {
            void notifyCommentMention({
              projectId,
              taskId,
              taskLabel: taskLabel?.trim() || "Task",
              userIds: mentionIds,
              message: trimmed,
            });
          }
        })();
      }
    }
  } catch {
    /* history is best-effort */
  }

  return comment;
}

export function useTaskComments(taskId: string | null, mode: TaskViewMode) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(Boolean(taskId));
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    if (!taskId) {
      setComments([]);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const next = await fetchTaskComments(taskId, mode);
      setComments(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments.");
    } finally {
      setLoading(false);
    }
  }, [mode, taskId]);

  useEffect(() => {
    if (!taskId) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadComments();
  }, [loadComments, taskId]);

  useEffect(() => {
    if (!taskId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`comments:${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `task_id=eq.${taskId}`,
        },
        () => {
          void loadComments();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadComments, taskId]);

  const commentsForType = useCallback(
    (type: CommentType) => comments.filter((comment) => comment.type === type),
    [comments]
  );

  return {
    comments,
    commentsForType,
    loading,
    error,
    reload: loadComments,
    createComment: createTaskComment,
  };
}

export function commentAuthorLabel(
  comment: TaskComment,
  currentUserId: string | null
): string {
  if (currentUserId && comment.user_id === currentUserId) {
    return "You";
  }
  if (comment.author_email) {
    return comment.author_email.split("@")[0] || comment.author_email;
  }
  return "User";
}

export { formatPanelTimestamp };
