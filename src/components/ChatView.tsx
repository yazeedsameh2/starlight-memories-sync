import { Send, Check, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface Message {
  id: string;
  text: string;
  sender: "me" | "meiso";
  status: "sent" | "delivered" | "read";
  created_at: string;
}

function Ticks({ status }: { status: Message["status"] }) {
  if (status === "sent") {
    return <Check className="w-3.5 h-3.5 opacity-70" />;
  }
  return (
    <CheckCheck
      className={cn(
        "w-3.5 h-3.5",
        status === "read" ? "text-sky-400" : "opacity-70"
      )}
    />
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

interface Props {
  messages: Message[];
  viewer: "me" | "meiso";
  onSend: (text: string) => Promise<void>;
}

export function ChatView({ messages, viewer, onSend }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText("");
    try {
      await onSend(trimmed);
    } catch {
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 scroll-smooth">
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const grouped = prev && prev.sender === m.sender;
          const isMine = m.sender === viewer;
          return (
            <div
              key={m.id}
              className={cn(
                "flex max-w-[80%] animate-fade-up",
                isMine ? "ml-auto justify-end" : "mr-auto justify-start",
                grouped ? "mt-0.5" : "mt-2"
              )}
              style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
            >
              <div
                className={cn(
                  "relative px-3 py-2 pr-2 text-[15px] leading-snug shadow-card max-w-full",
                  isMine
                    ? "bg-gradient-primary text-primary-foreground rounded-2xl"
                    : "bg-card text-foreground rounded-2xl",
                  !grouped && isMine && "rounded-tr-md",
                  !grouped && !isMine && "rounded-tl-md"
                )}
              >
                <p className="whitespace-pre-wrap break-words pr-12">{m.text}</p>
                <span
                  className={cn(
                    "absolute bottom-1 right-2 flex items-center gap-1 text-[10px] font-medium",
                    isMine ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}
                >
                  {formatTime(m.created_at)}
                  {isMine && <Ticks status={m.status} />}
                </span>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground italic mt-12">
            Say something sweet to start the conversation 💌
          </p>
        )}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={send}
        className="px-4 pt-3 pb-4 bg-background/80 backdrop-blur-md border-t border-border"
      >
        <div className="flex items-center gap-2 bg-card rounded-full pl-5 pr-1.5 py-1.5 shadow-card">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write something sweet…"
            className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground py-2"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!text.trim() || sending}
            className="w-10 h-10 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-glow"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
