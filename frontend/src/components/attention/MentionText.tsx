"use client";

import { renderMentionSegments } from "@/lib/attention/mentions";

export default function MentionText({ message }: { message: string }) {
  const segments = renderMentionSegments(message);

  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "mention" ? (
          <span
            key={`${segment.value}-${index}`}
            className="rounded bg-sky-100 px-0.5 font-semibold text-sky-900"
          >
            {segment.value}
          </span>
        ) : (
          <span key={`${index}-text`}>{segment.value}</span>
        )
      )}
    </>
  );
}
