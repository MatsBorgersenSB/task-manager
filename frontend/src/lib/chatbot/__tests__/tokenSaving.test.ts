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



