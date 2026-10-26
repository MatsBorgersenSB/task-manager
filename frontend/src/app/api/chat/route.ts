import { NextResponse } from "next/server";
import { getAIReply } from "@/lib/chatbot/reply";
import { getCurrentUserRoleServer } from "@/lib/profiles-server";
import { isInternal } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/tasks/taskDates";
import { toCompactTaskHeader } from "@/types/task-compact";

const COMPACT_SELECT_COLUMNS =
  "id, task_number, title, status, priority, sb_status, sb_priority, sb_owner, responsible, date_due, date_completed, area_name, area_code, project_id, parent_task_id, is_milestone, is_critical, board_label_ids, visibility_scope";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { message?: string; projectId?: string | null };
  try {
    body = (await request.json()) as { message?: string; projectId?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (message.length > 2000) {
    return NextResponse.json({ error: "Message is too long" }, { status: 400 });
  }

  const projectId =
    typeof body.projectId === "string" && body.projectId.trim().length > 0
      ? body.projectId.trim()
      : null;

  const role = await getCurrentUserRoleServer();
  const mode = isInternal(role) ? "internal" : "client";
  const today = todayIso();

  const reply = await getAIReply(message, {
    completeTask: async (taskId) => {
      let query = supabase
        .from("tasks")
        .update({
          status: "Complete",
          date_completed: today,
          updated_at: new Date().toISOString(),
          updated_by: user.email ?? null,
        })
        .eq("task_number", taskId);

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      if (mode === "client") {
        query = query.eq("visibility_scope", "internal_client");
      }

      const { data, error } = await query
        .select(COMPACT_SELECT_COLUMNS)
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      return toCompactTaskHeader(data, { mode });
    },
    listCompactTasks: async (filter) => {
      let query = supabase
        .from("tasks")
        .select(COMPACT_SELECT_COLUMNS)
        .order("task_number", { ascending: true });

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      if (mode === "client") {
        query = query.eq("visibility_scope", "internal_client");
      }

      if (filter === "today") {
        query = query.eq("date_due", today).neq("status", "Complete");
      } else if (filter === "overdue") {
        query = query.lt("date_due", today).neq("status", "Complete");
      }

      const { data, error } = await query;
      if (error || !data) return [];
      return data.map((row) => toCompactTaskHeader(row, { mode }));
    },
  });

  return NextResponse.json({ reply });
}
