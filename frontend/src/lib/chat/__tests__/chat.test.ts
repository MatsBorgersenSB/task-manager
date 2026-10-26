import assert from "node:assert/strict";
import test from "node:test";
import { pickSharedConversationId } from "../conversations";
import {
  resolveParticipationWithFallback,
  updateLastReadWithFallback,
} from "../unread";

test("pickSharedConversationId selects the shared conversation with the most participants", () => {
  const rows = [
    { conversation_id: "conv-1", user_id: "user-a" },
    { conversation_id: "conv-2", user_id: "user-b" },
    { conversation_id: "conv-2", user_id: "user-c" },
    { conversation_id: "conv-3", user_id: "user-d" },
  ];

  assert.equal(pickSharedConversationId(rows), "conv-2");
});

test("pickSharedConversationId returns first conversation when participant counts are tied and null when empty", () => {
  assert.equal(pickSharedConversationId([]), null);

  const tied = [
    { conversation_id: "conv-first", user_id: "user-1" },
    { conversation_id: "conv-second", user_id: "user-2" },
  ];
  assert.equal(pickSharedConversationId(tied), "conv-first");
});

test("resolveParticipationWithFallback falls back when last_read_at column is missing", async () => {
  const calls: string[] = [];

  const result = await resolveParticipationWithFallback({
    queryWithLastRead: async () => {
      calls.push("with_last_read");
      return {
        data: null,
        error: {
          message: "column conversation_participants.last_read_at does not exist",
        },
      };
    },
    queryWithoutLastRead: async () => {
      calls.push("without_last_read");
      return {
        data: { conversation_id: "conv-shared" },
        error: null,
      };
    },
    getFallbackLastReadAt: (conversationId) =>
      conversationId === "conv-shared" ? "2026-10-26T08:00:00.000Z" : null,
  });

  assert.deepEqual(calls, ["with_last_read", "without_last_read"]);
  assert.deepEqual(result, {
    conversation_id: "conv-shared",
    last_read_at: "2026-10-26T08:00:00.000Z",
  });
});

test("updateLastReadWithFallback falls back to local storage callback when last_read_at column is missing", async () => {
  let savedFallback: { conversationId: string; readAt: string } | null = null;

  await updateLastReadWithFallback({
    conversationId: "conv-shared",
    readAt: "2026-10-26T09:00:00.000Z",
    updateDb: async () => ({
      error: {
        message: "column conversation_participants.last_read_at does not exist",
      },
    }),
    saveFallbackLastReadAt: (conversationId, readAt) => {
      savedFallback = { conversationId, readAt };
    },
  });

  assert.deepEqual(savedFallback, {
    conversationId: "conv-shared",
    readAt: "2026-10-26T09:00:00.000Z",
  });
});
