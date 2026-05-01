import { Heart } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface Memory {
  id: string;
  image_url: string;
  caption: string;
  liked: boolean;
  created_at: string;
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MemoryCard({
  memory,
  index,
  onToggleLike,
}: {
  memory: Memory;
  index: number;
  onToggleLike?: (id: string, liked: boolean) => void;
}) {
  const [animating, setAnimating] = useState(false);

  const toggle = () => {
    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);
    onToggleLike?.(memory.id, !memory.liked);
  };

  return (
    <article
      className="bg-card rounded-3xl overflow-hidden shadow-card animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 6) * 80}ms` }}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={memory.image_url}
          alt={memory.caption}
          loading="lazy"
          width={1024}
          height={1024}
          className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
        />
      </div>
      <div className="p-5 space-y-3">
        <p className="font-display text-lg leading-snug text-foreground">{memory.caption}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {formatTimestamp(memory.created_at)}
          </span>
          <button
            onClick={toggle}
            aria-label={memory.liked ? "Unlike" : "Like"}
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-accent/40 transition-colors active:scale-95"
          >
            <Heart
              className={cn(
                "w-5 h-5 transition-colors",
                memory.liked
                  ? "fill-[var(--coral)] stroke-[var(--coral)]"
                  : "stroke-muted-foreground",
                animating && "heart-pop"
              )}
            />
          </button>
        </div>
      </div>
    </article>
  );
}
