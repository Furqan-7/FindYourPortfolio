"use client";

import { memo } from "react";
import { useLike } from "./LikesProvider";
import { HeartIcon } from "./Icons";
import { formatCount } from "@/lib/format";

export const LikeButton = memo(function LikeButton({
  id,
  name,
  size = "sm",
}: {
  id: number;
  name: string;
  size?: "sm" | "md";
}) {
  const { liked, counts, toggle } = useLike(id);
  return (
    <button
      type="button"
      className={`like-btn like-btn-${size}${liked ? " liked" : ""}`}
      aria-pressed={liked}
      aria-label={`${liked ? "Unlike" : "Like"} ${name}'s portfolio (${counts.total} likes)`}
      title={liked ? "Unlike" : "Like"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
    >
      <HeartIcon className="heart-icon" filled={liked} />
      <span className="like-count">{formatCount(counts.total)}</span>
    </button>
  );
});
