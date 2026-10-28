import { NextResponse } from "next/server";
import { COMPACT_TASK_SELECT_COLUMN_SETS } from "@/lib/chatbot/compactColumns";
import { getAIReply } from "@/lib/chatbot/reply";
import { filterCompactTaskHeaders } from "@/lib/chatbot/router";
import { getCurrentUserRoleServer } from "@/lib/profiles-server";
import { isInternal } from "@/lib/roles";
import {
  isMissingColumnError,
  selectWithColumnFallback,
  type SelectQueryResult,
} from "@/lib/supabase/schemaFallback";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/tasks/taskDates";
import { toCompactTaskHeader, type CompactTaskInput } from "@/types/task-compact";

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
    today,
    mode,
    completeTask: async (taskId) => {
      try {
        const { data } = await selectWithColumnFallback(
          COMPACT_TASK_SELECT_COLUMN_SETS,
          async (columns): Promise<SelectQueryResult> => {
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

            if (mode === "client" && columns.includes("visibility_scope")) {
              query = query.eq("visibility_scope", "internal_client");
            }

            const result = await (
              query as unknown as {
                select: (cols: string) => {
                  limit: (n: number) => {
                    maybeSingle: () => Promise<SelectQueryResult>;
                  };
                };
              }
            )
              .select(columns)
              .limit(1)
              .maybeSingle();

            return result;
          }
        );

        if (!data || typeof data !== "object") return null;
        return toCompactTaskHeader(data as CompactTaskInput, { mode });
      } catch (err) {
        if (!isMissingColumnError(err as { message?: string })) {
          console.error("[/api/chat] completeTask failed:", err);
        }
        return null;
      }
    },
    listCompactTasks: async (filter) => {
      try {
        const { data } = await selectWithColumnFallback(
          COMPACT_TASK_SELECT_COLUMN_SETS,
          async (columns): Promise<SelectQueryResult> => {
            let query = (
              supabase.from("tasks") as unknown as {
                select: (cols: string) => typeof baseQuery;
              }
            ).select(columns);

            const baseQuery = supabase
              .from("tasks")
              .select("*")
              .order("task_number", { ascending: true });
            void baseQuery;

            query = query.order("task_number", { ascending: true });

            if (projectId) {
              query = query.eq("project_id", projectId);
            }

            if (mode === "client" && columns.includes("visibility_scope")) {
              query = query.eq("visibility_scope", "internal_client");
            }

            if (filter === "today") {
              query = query.eq("date_due", today).neq("status", "Complete");
            } else if (filter === "overdue") {
              query = query.lt("date_due", today).neq("status", "Complete");
            } else if (filter !== "all") {
              query = query.neq("status", "Complete");
            }

            const result = await (query as unknown as Promise<SelectQueryResult>);
            return result;
          }
        );

        if (!Array.isArray(data)) return [];
        const headers = data.map((row) =>
          toCompactTaskHeader(row as CompactTaskInput, { mode })
        );
        return filterCompactTaskHeaders(headers, filter, { today, mode });
      } catch (err) {
        console.error("[/api/chat] listCompactTasks failed:", err);
        return [];
      }
    },
  });

  return NextResponse.json({ reply });
}
