import assert from "node:assert/strict";
import test from "node:test";
import {
  toCompactTaskHeader,
  serializeCompactTask,
  serializeCompactTaskList,
} from "../../../types/task-compact";
import {
  matchDeterministicCommand,
  routeChatMessage,
} from "../router";
import { getAIReply } from "../reply";
import { formatAssistantReply } from "../formatReply";

test("toCompactTaskHeader strips descriptions, comment trees, audit logs, nulls, empty arrays, and default values", () => {
  const verboseTask = {
    id: 42,
    _uuid: "uuid-42",
    Issue: "Pump cavitation check",
    status: "Open", // default value -> stripped
    "SB Status": "Not started", // default value -> stripped
    Priority: "High",
    Responsible: "", // empty string -> stripped
    "SB Owner": null, // null -> stripped
    "Date Due": "2026-10-26",
    "Date Completed": null,
    "CE Comments": "## Long markdown description\nWith multiple lines and details...",
    description: "Long raw description body",
    "Response or Action taken by SB": "Detailed action log markdown",
    "SB Note": "Internal long note",
    "Risk Comment": "Detailed risk explanation",
    template_notes: "Template markdown body",
    is_milestone: false, // default boolean -> stripped
    is_critical: true, // non-default boolean -> kept
    board_label_ids: [], // empty array -> stripped
    links: [], // empty array -> stripped
    comments: [
      {
        id: "c-1",
        body: "Nested comment 1",
        replies: [{ id: "c-2", body: "Nested reply" }],
      },
    ],
    audit_logs: [
      { id: "a-1", action: "updated", actor: "user@standard.bio" },
    ],
    activity: [{ id: "act-1", type: "status_change" }],
    _createdAt: "2026-10-01T10:00:00Z",
    _updatedAt: "2026-10-20T12:00:00Z",
    _updatedBy: "user@standard.bio",
    _createdByEmail: "creator@standard.bio",
    _createdByRole: "internal",
    acknowledged_by: null,
    acknowledged_at: null,
  };

  const compact = toCompactTaskHeader(verboseTask);

  assert.deepEqual(compact, {
    id: 42,
    _uuid: "uuid-42",
    title: "Pump cavitation check",
    priority: "High",
    dateDue: "2026-10-26",
    is_critical: true,
  });

  const json = serializeCompactTask(verboseTask);
  const parsed = JSON.parse(json);

  assert.equal(parsed.id, 42);
  assert.equal(parsed.title, "Pump cavitation check");
  assert.equal("description" in parsed, false);
  assert.equal("CE Comments" in parsed, false);
  assert.equal("comments" in parsed, false);
  assert.equal("audit_logs" in parsed, false);
  assert.equal("activity" in parsed, false);
  assert.equal("board_label_ids" in parsed, false);
  assert.equal("is_milestone" in parsed, false);
  assert.equal("SB Owner" in parsed, false);
  assert.equal("sbOwner" in parsed, false);
});

test("serializeCompactTaskList returns compact JSON array without heavy fields", () => {
  const tasks = [
    {
      id: 1,
      _uuid: "u-1",
      Issue: "Valve inspection",
      status: "In Progress",
      description: "Very long markdown body that should never reach the LLM",
      comments: [{ id: "c1", text: "hello" }],
      audit_logs: [{ id: "l1" }],
      board_label_ids: [],
    },
  ];

  const serialized = serializeCompactTaskList(tasks);
  const decoded = JSON.parse(serialized);

  assert.equal(Array.isArray(decoded), true);
  assert.equal(decoded.length, 1);
  assert.deepEqual(decoded[0], {
    id: 1,
    _uuid: "u-1",
    title: "Valve inspection",
    status: "In Progress",
  });
});

test("matchDeterministicCommand parses task completion and list commands", () => {
  assert.deepEqual(matchDeterministicCommand("done #42"), {
    type: "complete_task",
    action: "done",
    taskId: 42,
  });
  assert.deepEqual(matchDeterministicCommand("complete 7"), {
    type: "complete_task",
    action: "complete",
    taskId: 7,
  });
  assert.deepEqual(matchDeterministicCommand("FINISH #105"), {
    type: "complete_task",
    action: "finish",
    taskId: 105,
  });

  assert.deepEqual(matchDeterministicCommand("list today"), {
    type: "list_tasks",
    verb: "list",
    filter: "today",
  });
  assert.deepEqual(matchDeterministicCommand("show overdue"), {
    type: "list_tasks",
    verb: "show",
    filter: "overdue",
  });
  assert.deepEqual(matchDeterministicCommand("LIST ALL"), {
    type: "list_tasks",
    verb: "list",
    filter: "all",
  });
  assert.deepEqual(matchDeterministicCommand("show blocked"), {
    type: "list_tasks",
    verb: "show",
    filter: "blocked",
  });
  assert.deepEqual(matchDeterministicCommand("list critical"), {
    type: "list_tasks",
    verb: "list",
    filter: "critical",
  });
  assert.deepEqual(matchDeterministicCommand("show unassigned"), {
    type: "list_tasks",
    verb: "show",
    filter: "unassigned",
  });
  assert.deepEqual(matchDeterministicCommand("standup"), {
    type: "standup",
  });
  assert.deepEqual(matchDeterministicCommand("project status"), {
    type: "standup",
  });
  assert.deepEqual(matchDeterministicCommand("workload"), {
    type: "workload",
  });

  assert.equal(matchDeterministicCommand("how do I export tasks to excel?"), null);
  assert.equal(matchDeterministicCommand("done #42 extra words"), null);
});

test("routeChatMessage executes completion pattern without calling LLM wrapper", async () => {
  let llmCalled = false;
  let completedTaskId: number | null = null;

  const result = await routeChatMessage("complete #19", {
    completeTask: async (taskId) => {
      completedTaskId = taskId;
      return {
        id: taskId,
        _uuid: `uuid-${taskId}`,
        Issue: "Calibrate pressure sensor",
        status: "Complete",
        "Date Completed": "2026-10-26",
        description: "Should be stripped from compact response",
        audit_logs: [{ event: "completed" }],
      };
    },
    listCompactTasks: async () => {
      throw new Error("listCompactTasks should not be called");
    },
    callLLM: async () => {
      llmCalled = true;
      return "LLM response";
    },
  });

  assert.equal(llmCalled, false);
  assert.equal(completedTaskId, 19);
  assert.equal(result.bypassedLLM, true);
  assert.equal(result.intent, "complete_task");

  const payload = JSON.parse(result.reply);
  assert.equal(payload.ok, true);
  assert.equal(payload.action, "complete_task");
  assert.equal(payload.task.id, 19);
  assert.equal(payload.task.status, "Complete");
  assert.equal("description" in payload.task, false);
  assert.equal("audit_logs" in payload.task, false);
});

test("routeChatMessage executes list pattern and returns compact headers without calling LLM wrapper", async () => {
  let llmCalled = false;
  let requestedFilter: string | null = null;

  const result = await routeChatMessage("show overdue", {
    completeTask: async () => {
      throw new Error("completeTask should not be called");
    },
    listCompactTasks: async (filter) => {
      requestedFilter = filter;
      return [
        {
          id: 8,
          _uuid: "uuid-8",
          Issue: "Replace gasket",
          Priority: "High",
          "Date Due": "2026-10-20",
          "CE Comments": "Long markdown comment body",
          comments: [{ id: 1, body: "Nested thread" }],
          audit_logs: [{ id: 99 }],
          board_label_ids: [],
          is_milestone: false,
        },
      ];
    },
    callLLM: async () => {
      llmCalled = true;
      return "LLM response";
    },
  });

  assert.equal(llmCalled, false);
  assert.equal(requestedFilter, "overdue");
  assert.equal(result.bypassedLLM, true);
  assert.equal(result.intent, "list_tasks");

  const payload = JSON.parse(result.reply);
  assert.equal(payload.filter, "overdue");
  assert.equal(payload.count, 1);
  assert.deepEqual(payload.tasks, [
    {
      id: 8,
      _uuid: "uuid-8",
      title: "Replace gasket",
      priority: "High",
      dateDue: "2026-10-20",
    },
  ]);
});

test("routeChatMessage delegates non-matching prompts to LLM wrapper", async () => {
  let llmCalledWith: string | null = null;

  const result = await routeChatMessage("How do I filter by SB Owner?", {
    completeTask: async () => {
      throw new Error("Should not call completeTask");
    },
    listCompactTasks: async () => {
      throw new Error("Should not call listCompactTasks");
    },
    callLLM: async (msg) => {
      llmCalledWith = msg;
      return "Use the SB Owner filter in the toolbar.";
    },
  });

  assert.equal(llmCalledWith, "How do I filter by SB Owner?");
  assert.equal(result.bypassedLLM, false);
  assert.equal(result.intent, "llm");
  assert.equal(result.reply, "Use the SB Owner filter in the toolbar.");
});

test("getAIReply pre-filters deterministic commands before calling LLM", async () => {
  let llmInvoked = false;
  const reply = await getAIReply("done #5", {
    completeTask: async (taskId) => ({
      id: taskId,
      Issue: "Check safety valve",
      status: "Complete",
      description: "Ignored body",
    }),
    listCompactTasks: async () => [],
    callLLM: async () => {
      llmInvoked = true;
      return "should not be returned";
    },
  });

  assert.equal(llmInvoked, false);
  const parsed = JSON.parse(reply);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.task.id, 5);
  assert.equal(parsed.task.title, "Check safety valve");
});

test("toCompactTaskHeader omits SB-only fields in client mode", () => {
  const internalTask = {
    id: 99,
    _uuid: "uuid-99",
    Issue: "Client visible task",
    status: "In Progress",
    Priority: "High",
    "SB Status": "In execution",
    "SB Priority": "Critical",
    "SB Owner": "alice@standard.bio",
    Responsible: "Bob",
  };

  const clientCompact = toCompactTaskHeader(internalTask, { mode: "client" });
  assert.equal(clientCompact.id, 99);
  assert.equal(clientCompact.title, "Client visible task");
  assert.equal(clientCompact.status, "In Progress");
  assert.equal(clientCompact.responsible, "Bob");
  assert.equal("sbStatus" in clientCompact, false);
  assert.equal("sbPriority" in clientCompact, false);
  assert.equal("sbOwner" in clientCompact, false);
  assert.equal("priority" in clientCompact, false);
});

test("formatAssistantReply converts compact JSON responses into user-friendly text and preserves plain LLM text", () => {
  const completedJson = JSON.stringify({
    ok: true,
    action: "complete_task",
    task: { id: 19, title: "Calibrate pressure sensor", status: "Complete" },
  });
  assert.equal(
    formatAssistantReply(completedJson),
    'Marked task #19 ("Calibrate pressure sensor") as Complete.'
  );

  const notFoundJson = JSON.stringify({
    ok: false,
    action: "complete_task",
    taskId: 404,
    error: "Task #404 not found",
  });
  assert.equal(
    formatAssistantReply(notFoundJson),
    "Task #404 not found"
  );

  const listJson = JSON.stringify({
    filter: "overdue",
    count: 2,
    tasks: [
      { id: 8, title: "Replace gasket", priority: "High", dateDue: "2026-10-20" },
      { id: 12, title: "Inspect burner", status: "In Progress" },
    ],
  });
  assert.equal(
    formatAssistantReply(listJson),
    "Found 2 overdue tasks:\n• #8 Replace gasket (High · Due 2026-10-20)\n• #12 Inspect burner (In Progress)"
  );

  const emptyListJson = JSON.stringify({
    filter: "today",
    count: 0,
    tasks: [],
  });
  assert.equal(
    formatAssistantReply(emptyListJson),
    "No tasks due today."
  );

  const plainText = "Use the Filter & sort section above the table.";
  assert.equal(formatAssistantReply(plainText), plainText);
});

test("COMPACT_TASK_SELECT_COLUMN_SETS falls back when board_label_ids is missing", async () => {
  const { COMPACT_TASK_SELECT_COLUMN_SETS } = await import("../compactColumns");
  const { selectWithColumnFallback } = await import("../../supabase/schemaFallback");

  const attemptedColumnSets: string[] = [];
  const { data, columnsUsed } = await selectWithColumnFallback(
    COMPACT_TASK_SELECT_COLUMN_SETS,
    async (columns) => {
      attemptedColumnSets.push(columns);
      if (columns.includes("board_label_ids")) {
        return {
          data: null,
          error: { message: "column tasks.board_label_ids does not exist" },
        };
      }
      return {
        data: [{ id: "u-1", task_number: 7, title: "Fallback task", status: "Open" }],
        error: null,
      };
    }
  );

  assert.equal(attemptedColumnSets.length, 2);
  assert.equal(columnsUsed.includes("board_label_ids"), false);
  assert.equal(Array.isArray(data), true);
});

test("routeChatMessage executes standup command and computes project pulse without calling LLM", async () => {
  let llmCalled = false;

  const result = await routeChatMessage("standup", {
    today: "2026-10-28",
    mode: "internal",
    completeTask: async () => null,
    listCompactTasks: async (filter) => {
      assert.equal(filter, "all");
      return [
        {
          id: 1,
          Issue: "Overdue pump alignment",
          status: "In Progress",
          "Date Due": "2026-10-20",
          "SB Owner": "alice@standard.bio",
          is_critical: true,
        },
        {
          id: 2,
          Issue: "Today valve check",
          status: "Open",
          "Date Due": "2026-10-28",
          "SB Owner": "bob@standard.bio",
        },
        {
          id: 3,
          Issue: "Blocked electrical panel",
          status: "Blocked",
          "Date Due": "2026-11-01",
          "SB Owner": "",
          Responsible: "",
        },
        {
          id: 4,
          Issue: "Completed sensor test",
          status: "Complete",
          "Date Due": "2026-10-15",
          "SB Owner": "alice@standard.bio",
        },
      ];
    },
    callLLM: async () => {
      llmCalled = true;
      return "LLM";
    },
  });

  assert.equal(llmCalled, false);
  assert.equal(result.bypassedLLM, true);
  assert.equal(result.intent, "standup");

  const payload = JSON.parse(result.reply);
  assert.equal(payload.action, "standup");
  assert.equal(payload.openCount, 3);
  assert.equal(payload.overdue.length, 1);
  assert.equal(payload.overdue[0].id, 1);
  assert.equal(payload.dueToday.length, 1);
  assert.equal(payload.dueToday[0].id, 2);
  assert.equal(payload.blocked.length, 1);
  assert.equal(payload.blocked[0].id, 3);
  assert.equal(payload.critical.length, 1);
  assert.equal(payload.critical[0].id, 1);
  assert.equal(payload.unassignedCount, 1);

  const formatted = formatAssistantReply(result.reply);
  assert.equal(formatted.includes("Project Standup (3 open)"), true);
  assert.equal(formatted.includes("Overdue: 1"), true);
  assert.equal(formatted.includes("Due today: 1"), true);
  assert.equal(formatted.includes("Blocked: 1"), true);
  assert.equal(formatted.includes("Unassigned: 1"), true);
});

test("routeChatMessage executes workload command respecting mode and formats owner breakdown", async () => {
  const result = await routeChatMessage("workload", {
    today: "2026-10-28",
    mode: "client",
    completeTask: async () => null,
    listCompactTasks: async () => [
      {
        id: 10,
        Issue: "Client review P&ID",
        status: "In Progress",
        "Date Due": "2026-10-20",
        Responsible: "Sarah (Client)",
        "SB Owner": "secret-internal@standard.bio",
      },
      {
        id: 11,
        Issue: "Sign off safety checklist",
        status: "Open",
        "Date Due": "2026-11-05",
        Responsible: "Sarah (Client)",
      },
      {
        id: 12,
        Issue: "Provide site access list",
        status: "Open",
        Responsible: "",
      },
    ],
    callLLM: async () => "LLM",
  });

  assert.equal(result.bypassedLLM, true);
  assert.equal(result.intent, "workload");

  const payload = JSON.parse(result.reply);
  assert.equal(payload.action, "workload");
  assert.equal(payload.unassignedCount, 1);
  assert.deepEqual(payload.owners, [
    { owner: "Sarah (Client)", open: 2, overdue: 1 },
  ]);

  const formatted = formatAssistantReply(result.reply);
  assert.equal(formatted.includes("Sarah (Client): 2 open (1 overdue)"), true);
  assert.equal(formatted.includes("Unassigned: 1 open"), true);
  assert.equal(formatted.includes("secret-internal@standard.bio"), false);
});

test("filterCompactTaskHeaders filters blocked, critical, milestones, and unassigned tasks while respecting client mode", async () => {
  const { filterCompactTaskHeaders } = await import("../router");

  const sampleHeaders = [
    toCompactTaskHeader({
      id: 1,
      Issue: "Blocked by vendor",
      status: "Blocked",
      Responsible: "Alice",
    }),
    toCompactTaskHeader({
      id: 2,
      Issue: "Internal SB blocked only",
      status: "In Progress",
      "SB Status": "Blocked",
      "SB Owner": "internal@standard.bio",
      Responsible: "",
    }),
    toCompactTaskHeader({
      id: 3,
      Issue: "Critical safety valve",
      status: "Open",
      is_critical: true,
       is_milestone: true,
      Responsible: "",
      "SB Owner": "",
    }),
    toCompactTaskHeader({
      id: 4,
      Issue: "Completed milestone",
      status: "Complete",
      is_milestone: true,
      is_critical: true,
    }),
  ];

  const internalBlocked = filterCompactTaskHeaders(sampleHeaders, "blocked", {
    today: "2026-10-28",
    mode: "internal",
  });
  assert.deepEqual(
    internalBlocked.map((t) => t.id),
    [1, 2]
  );

  const clientHeaders = [
    toCompactTaskHeader(
      {
        id: 2,
        Issue: "Internal SB blocked only",
        status: "In Progress",
        "SB Status": "Blocked",
        "SB Owner": "internal@standard.bio",
        Responsible: "",
      },
      { mode: "client" }
    ),
  ];
  const clientBlocked = filterCompactTaskHeaders(clientHeaders, "blocked", {
    today: "2026-10-28",
    mode: "client",
  });
  assert.equal(clientBlocked.length, 0);

  const critical = filterCompactTaskHeaders(sampleHeaders, "critical", {
    today: "2026-10-28",
    mode: "internal",
  });
  assert.deepEqual(
    critical.map((t) => t.id),
    [3]
  );

  const milestones = filterCompactTaskHeaders(sampleHeaders, "milestones", {
    today: "2026-10-28",
    mode: "internal",
  });
  assert.deepEqual(
    milestones.map((t) => t.id),
    [3]
  );

  const unassignedInternal = filterCompactTaskHeaders(
    sampleHeaders,
    "unassigned",
    {
      today: "2026-10-28",
      mode: "internal",
    }
  );
  assert.deepEqual(
    unassignedInternal.map((t) => t.id),
    [3]
  );
});






