import { createClient } from "@/lib/supabase/client";
import {
  isMissingColumnError,
  isMissingTableError,
} from "@/lib/supabase/schemaFallback";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import {
  normalizeBoardLabelColor,
  type ProjectBoardLabel,
  type ProjectBucket,
} from "@/lib/tasks/boardMeta";

function isBoardSchemaMissing(error: { message?: string; code?: string } | null): boolean {
  return (
    isMissingTableError(error, "project_buckets") ||
    isMissingTableError(error, "project_board_labels") ||
    isMissingColumnError(error, "bucket_id") ||
    isMissingColumnError(error, "board_label_ids")
  );
}

export async function fetchProjectBuckets(
  projectId: string
): Promise<ProjectBucket[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_buckets")
    .select("id, project_id, name, position")
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (isBoardSchemaMissing(error)) return [];
    throw new Error(supabaseErrorMessage(error));
  }

  return (data ?? []) as ProjectBucket[];
}

export async function createProjectBucket(
  projectId: string,
  name: string
): Promise<ProjectBucket> {
  const supabase = createClient();
  const existing = await fetchProjectBuckets(projectId);
  const position =
    existing.reduce((max, bucket) => Math.max(max, bucket.position), -1) + 1;

  const { data, error } = await supabase
    .from("project_buckets")
    .insert({
      project_id: projectId,
      name: name.trim(),
      position,
    })
    .select("id, project_id, name, position")
    .single();

  if (error || !data) {
    throw new Error(
      error
        ? `${supabaseErrorMessage(error)} Apply migration 057_board_buckets_and_labels.sql in Supabase.`
        : "Failed to create bucket."
    );
  }

  return data as ProjectBucket;
}

export async function renameProjectBucket(
  bucketId: string,
  name: string
): Promise<ProjectBucket> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_buckets")
    .update({ name: name.trim() })
    .eq("id", bucketId)
    .select("id, project_id, name, position")
    .single();

  if (error || !data) {
    throw new Error(
      error ? supabaseErrorMessage(error) : "Failed to rename bucket."
    );
  }
  return data as ProjectBucket;
}

export async function deleteProjectBucket(bucketId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("project_buckets")
    .delete()
    .eq("id", bucketId);
  if (error) throw new Error(supabaseErrorMessage(error));
}

export async function fetchProjectBoardLabels(
  projectId: string
): Promise<ProjectBoardLabel[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_board_labels")
    .select("id, project_id, name, color, position")
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (isBoardSchemaMissing(error)) return [];
    throw new Error(supabaseErrorMessage(error));
  }

  return ((data ?? []) as ProjectBoardLabel[]).map((label) => ({
    ...label,
    color: normalizeBoardLabelColor(label.color),
  }));
}

export async function createProjectBoardLabel(
  projectId: string,
  name: string,
  color: string
): Promise<ProjectBoardLabel> {
  const supabase = createClient();
  const existing = await fetchProjectBoardLabels(projectId);
  const position =
    existing.reduce((max, label) => Math.max(max, label.position), -1) + 1;

  const { data, error } = await supabase
    .from("project_board_labels")
    .insert({
      project_id: projectId,
      name: name.trim(),
      color: normalizeBoardLabelColor(color),
      position,
    })
    .select("id, project_id, name, color, position")
    .single();

  if (error || !data) {
    throw new Error(
      error
        ? `${supabaseErrorMessage(error)} Apply migration 057_board_buckets_and_labels.sql in Supabase.`
        : "Failed to create label."
    );
  }

  return {
    ...(data as ProjectBoardLabel),
    color: normalizeBoardLabelColor((data as ProjectBoardLabel).color),
  };
}

export async function ensureDefaultBoardMeta(projectId: string): Promise<{
  buckets: ProjectBucket[];
  labels: ProjectBoardLabel[];
}> {
  let buckets = await fetchProjectBuckets(projectId);
  let labels = await fetchProjectBoardLabels(projectId);

  if (buckets.length === 0) {
    try {
      for (const [index, name] of ["To do", "In progress", "Done"].entries()) {
        await createProjectBucket(projectId, name);
        void index;
      }
      buckets = await fetchProjectBuckets(projectId);
    } catch {
      /* schema may be missing */
    }
  }

  if (labels.length === 0) {
    try {
      const defaults: [string, string][] = [
        ["Urgent", "rose"],
        ["Important", "amber"],
        ["Waiting", "sky"],
        ["Blocked", "violet"],
      ];
      for (const [name, color] of defaults) {
        await createProjectBoardLabel(projectId, name, color);
      }
      labels = await fetchProjectBoardLabels(projectId);
    } catch {
      /* schema may be missing */
    }
  }

  return { buckets, labels };
}
