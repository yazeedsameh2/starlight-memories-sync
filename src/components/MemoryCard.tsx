import { Heart, Trash2, MessageCircle, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { addComment, listComments } from "@/server/space.functions";
import { useSpace } from "@/components/SpaceProvider";
import { supabase } from "@/integrations/supabase/client";

export interface Memory {
  id: string;
  image_url: string;
  caption: string;
  liked: boolean;
  created_at: string;
}

interface Comment {
  id: string;
  memory_id: string;
  sender: "me" | "meiso";
  text: string;
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
  onDelete,
}: {
  memory: Memory;
  index: number;
  onToggleLike?: (id: string, liked: boolean) => void;
  onDelete?: (id: string) => void | Promise<void>;
}) {
  const { token, viewer } = useSpace();
  const [animating, setAnimating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const toggle = () => {
    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);
    onToggleLike?.(memory.id, !memory.liked);
  };

  const handleDeleteClick = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      setTimeout(() => setConfirmingDelete(false), 3000);
      return;
    }
    onDelete?.(memory.id);
  };

  const refreshComments = async () => {
    if (!token) return;
    try {
      const { comments } = await listComments({ data: { token, memoryId: memory.id } });
      setComments(comments as Comment[]);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (commentsOpen) refreshComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentsOpen]);

  useEffect(() => {
    if (!commentsOpen) return;
    const channel = supabase
      .channel(`comments-${memory.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "memory_comments", filter: `memory_id=eq.${memory.id}` },
        () => refreshComments(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentsOpen, memory.id]);

  const handlePost = async () => {
    const text = draft.trim();
    if (!text || !token) return;
    setPosting(true);
    try {
      await addComment({ data: { token, memoryId: memory.id, sender: viewer, text } });
      setDraft("");
      refreshComments();
    } catch (e) {
      console.error(e);
    } finally {
      setPosting(false);
    }
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
        <p dir="auto" className="font-display text-lg leading-snug text-foreground">
          {memory.caption}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {formatTimestamp(memory.created_at)}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCommentsOpen((o) => !o)}
              aria-label="Toggle comments"
              className="group flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-accent/40 transition-colors active:scale-95 text-muted-foreground"
            >
              <MessageCircle className="w-5 h-5" />
              {comments.length > 0 && (
                <span className="text-xs font-medium">{comments.length}</span>
              )}
            </button>
            <button
              onClick={toggle}
              aria-label={memory.liked ? "Unlike" : "Like"}
              className="group flex items-center px-2.5 py-1.5 rounded-full hover:bg-accent/40 transition-colors active:scale-95"
            >
              <Heart
                className={cn(
                  "w-5 h-5 transition-colors",
                  memory.liked
                    ? "fill-[var(--coral)] stroke-[var(--coral)]"
                    : "stroke-muted-foreground",
                  animating && "heart-pop",
                )}
              />
            </button>
            <button
              onClick={handleDeleteClick}
              aria-label={confirmingDelete ? "Confirm delete" : "Delete memory"}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all active:scale-95",
                confirmingDelete
                  ? "bg-destructive text-destructive-foreground"
                  : "text-muted-foreground hover:bg-accent/40",
              )}
            >
              <Trash2 className="w-4 h-4" />
              {confirmingDelete && <span className="text-xs font-medium">Sure?</span>}
            </button>
          </div>
        </div>

        {commentsOpen && (
          <div className="pt-3 border-t border-border space-y-3">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-2">
                  No comments yet.
                </p>
              )}
              {comments.map((c) => {
                const mine = c.sender === viewer;
                return (
                  <div
                    key={c.id}
                    className={cn("flex flex-col", mine ? "items-end" : "items-start")}
                  >
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5 px-1">
                      {c.sender === "me" ? "Yazeed" : "Meiso"}
                    </span>
                    <div
                      dir="auto"
                      className={cn(
                        "max-w-[85%] px-3 py-2 rounded-2xl text-sm",
                        mine
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm",
                      )}
                    >
                      {c.text}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input
                dir="auto"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handlePost();
                  }
                }}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 text-sm rounded-full bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={handlePost}
                disabled={!draft.trim() || posting}
                aria-label="Send comment"
                className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 active:scale-90 transition-transform"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
