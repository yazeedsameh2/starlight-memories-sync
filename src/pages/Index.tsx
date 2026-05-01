import { useCallback, useEffect, useRef, useState } from "react";
import { Image as ImageIcon, MessageCircle, Plus, Lock as LockIcon, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { MemoryCard, type Memory } from "@/components/MemoryCard";
import { ChatView, type Message } from "@/components/ChatView";
import { AddMemorySheet } from "@/components/AddMemorySheet";
import { LockScreen } from "@/components/LockScreen";
import { SharedMediaSheet } from "@/components/SharedMediaSheet";
import { useSpace } from "@/components/SpaceProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  createMemory,
  listMemories,
  listMessages,
  markMessagesRead,
  migrateLocalData,
  sendMediaMessage,
  sendMessage,
  toggleMemoryLike,
} from "@/server/space.functions";

type View = "memories" | "chat";
const MIGRATION_KEY = "ourspace.migrated.v1";

export default function Index() {
  const { token, viewer, lock } = useSpace();
  if (!token) return <LockScreen />;
  return <Space token={token} viewer={viewer} onLock={lock} />;
}

function Space({
  token,
  viewer,
  onLock,
}: {
  token: string;
  viewer: "me" | "meiso";
  onLock: () => void;
}) {
  const [view, setView] = useState<View>("memories");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const migratedRef = useRef(false);

  const refreshMemories = useCallback(async () => {
    const { memories } = await listMemories({ data: { token } });
    setMemories(memories as Memory[]);
  }, [token]);

  const refreshMessages = useCallback(async () => {
    const { messages } = await listMessages({ data: { token } });
    setMessages(messages as Message[]);
  }, [token]);

  useEffect(() => {
    refreshMemories().catch(console.error);
    refreshMessages().catch(console.error);
  }, [refreshMemories, refreshMessages]);

  useEffect(() => {
    const channel = supabase
      .channel("ourspace")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "memories" },
        () => {
          refreshMemories().catch(console.error);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          refreshMessages().catch(console.error);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshMemories, refreshMessages]);

  useEffect(() => {
    if (migratedRef.current) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(MIGRATION_KEY)) return;
    migratedRef.current = true;

    const oldMemoriesRaw = localStorage.getItem("ourspace.memories");
    const oldMessagesRaw = localStorage.getItem("ourspace.messages");

    type LocalMemory = { image?: string; caption?: string; liked?: boolean; timestamp?: string };
    type LocalMessage = {
      from?: "me" | "meiso";
      sender?: "me" | "meiso";
      text?: string;
      time?: string;
      status?: "sent" | "delivered" | "read";
    };

    let oldMemories: LocalMemory[] = [];
    let oldMessages: LocalMessage[] = [];
    try {
      oldMemories = oldMemoriesRaw ? (JSON.parse(oldMemoriesRaw) as LocalMemory[]) : [];
    } catch {
      /* ignore */
    }
    try {
      oldMessages = oldMessagesRaw ? (JSON.parse(oldMessagesRaw) as LocalMessage[]) : [];
    } catch {
      /* ignore */
    }

    const memoriesPayload = oldMemories
      .filter(
        (m): m is Required<Pick<LocalMemory, "image" | "caption">> & LocalMemory =>
          !!m.image && !!m.caption && m.image.startsWith("data:image/"),
      )
      .map((m) => ({
        image: m.image,
        caption: m.caption,
        liked: !!m.liked,
        timestamp: m.timestamp,
      }));

    const messagesPayload = oldMessages
      .map((m) => ({
        sender: (m.sender ?? m.from) as "me" | "meiso" | undefined,
        text: m.text,
        status: m.status,
        time: m.time,
      }))
      .filter(
        (m) =>
          (m.sender === "me" || m.sender === "meiso") &&
          typeof m.text === "string" &&
          m.text.length > 0,
      ) as Array<{
        sender: "me" | "meiso";
        text: string;
        status?: "sent" | "delivered" | "read";
        time?: string;
      }>;

    if (memoriesPayload.length === 0 && messagesPayload.length === 0) {
      localStorage.setItem(MIGRATION_KEY, "1");
      return;
    }

    migrateLocalData({
      data: { token, memories: memoriesPayload, messages: messagesPayload },
    })
      .then(() => {
        localStorage.setItem(MIGRATION_KEY, "1");
        localStorage.removeItem("ourspace.memories");
        localStorage.removeItem("ourspace.messages");
        refreshMemories().catch(console.error);
        refreshMessages().catch(console.error);
      })
      .catch((err) => {
        console.error("Migration failed", err);
      });
  }, [token, refreshMemories, refreshMessages]);

  useEffect(() => {
    if (view !== "chat") return;
    const hasUnread = messages.some(
      (m) => m.sender !== viewer && m.status !== "read",
    );
    if (!hasUnread) return;
    markMessagesRead({ data: { token, viewer } }).catch(console.error);
  }, [view, messages, viewer, token]);

  const handlePostMemory = async (input: {
    imageBase64: string;
    contentType: string;
    caption: string;
  }) => {
    await createMemory({ data: { token, ...input } });
    setView("memories");
    await refreshMemories();
  };

  const handleToggleLike = async (id: string, liked: boolean) => {
    setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, liked } : m)));
    try {
      await toggleMemoryLike({ data: { token, id, liked } });
    } catch (e) {
      console.error(e);
      setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, liked: !liked } : m)));
    }
  };

  const handleSendMessage = async (text: string) => {
    await sendMessage({ data: { token, sender: viewer, text } });
  };

  return (
    <div className="min-h-screen flex justify-center">
      <div className="relative w-full max-w-[430px] min-h-screen bg-background shadow-soft flex flex-col">
        <header className="sticky top-0 z-20 px-6 pt-6 pb-4 bg-background/80 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-[26px] font-semibold tracking-tight">
              Our Space <span className="text-coral">❤</span>
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {viewer === "me" ? "Yazeed" : viewer}
              </span>
              <button
                onClick={onLock}
                aria-label="Lock space"
                className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-90 transition-all"
              >
                <LockIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col overflow-hidden">
          {view === "memories" ? (
            <div className="flex-1 overflow-y-auto px-5 pt-2 pb-32 space-y-5 scroll-smooth">
              {memories.length === 0 && (
                <p className="text-center text-sm text-muted-foreground italic pt-16">
                  No memories yet. Tap the + to add your first ❤
                </p>
              )}
              {memories.map((m, i) => (
                <MemoryCard
                  key={m.id}
                  memory={m}
                  index={i}
                  onToggleLike={handleToggleLike}
                />
              ))}
              {memories.length > 0 && (
                <p className="text-center text-xs text-muted-foreground pt-4 italic">
                  The beginning of us.
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1 pb-24 flex flex-col">
              <ChatView messages={messages} viewer={viewer} onSend={handleSendMessage} />
            </div>
          )}
        </main>

        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-30 pointer-events-none">
          <div className="relative pointer-events-auto mx-4 mb-4 h-16 rounded-full bg-card/95 backdrop-blur-xl shadow-soft border border-border flex items-center justify-around px-6">
            <NavButton
              active={view === "memories"}
              onClick={() => setView("memories")}
              icon={<ImageIcon className="w-5 h-5" />}
              label="Memories"
            />
            <div className="w-16" aria-hidden />
            <NavButton
              active={view === "chat"}
              onClick={() => setView("chat")}
              icon={<MessageCircle className="w-5 h-5" />}
              label="Chat"
            />

            <button
              aria-label="Add memory"
              onClick={() => setAddOpen(true)}
              className="absolute left-1/2 -top-7 -translate-x-1/2 w-16 h-16 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center animate-glow transition-transform active:scale-90 hover:scale-105"
            >
              <Plus className="w-7 h-7" strokeWidth={2.5} />
            </button>
          </div>
        </nav>

        <AddMemorySheet open={addOpen} onOpenChange={setAddOpen} onPost={handlePostMemory} />
      </div>
    </div>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90",
        active ? "text-coral" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span className="text-[10px] font-medium tracking-wide">{label}</span>
    </button>
  );
}
