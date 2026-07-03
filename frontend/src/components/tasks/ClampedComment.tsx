"use client";

import ClampedTableText from "@/components/tasks/ClampedTableText";

type ClampedCommentProps = {
  text: unknown;
};

export default function ClampedComment({ text }: ClampedCommentProps) {
  return <ClampedTableText text={text} maxLines={2} />;
}
