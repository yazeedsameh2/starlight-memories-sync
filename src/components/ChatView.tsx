import { Send, Check, CheckCheck, Paperclip, Image as ImageIcon, Video, Mic, Square, X, Play, Pause } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface Message {
  id: string;
  text: string | null;
  sender: "me" | "meiso";
  status: "sent" | "delivered" | "read";
  created_at: string;
  media_url?: string | null;
  media_type?: "image" | "video" | "audio" | null;
  duration_ms?: number | null;
}

function Ticks({ status, mine }: { status: Message["status"]; mine: boolean }) {
  const cls = mine ? "text-primary-foreground/80" : "text-muted-foreground";
  if (status === "sent") return <Check className={cn("w-3.5 h-3.5", cls)} />;
  return (
    <CheckCheck
      className={cn("w-3.5 h-3.5", status === "read" ? "text-sky-400" : cls)}
    />
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDuration(ms?: number | null) {
  if (!ms || ms <= 0) return "0:00";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function VoiceBubble({ url, durationMs, mine }: { url: string; durationMs?: number | null; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play();
  };
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => { setPlaying(false); setProgress(0); };
    const onTime = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnd);
    a.addEventListener("timeupdate", onTime);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("timeupdate", onTime);
    };
  }, []);
  return (
    <div className="flex items-center gap-3 min-w-[180px]">
      <button
        onClick={toggle}
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90",
          mine ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary",
        )}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1">
        <div className={cn("h-1.5 rounded-full overflow-hidden", mine ? "bg-primary-foreground/25" : "bg-foreground/10")}>
          <div
            className={cn("h-full rounded-full transition-all", mine ? "bg-primary-foreground" : "bg-primary")}
            style={{ width: `${Math.max(4, progress * 100)}%` }}
          />
        </div>
        <span className={cn("text-[11px] mt-1 block", mine ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {formatDuration(durationMs)}
        </span>
      </div>
      <audio ref={audioRef} src={url} preload="metadata" />
    </div>
  );
}

interface Props {
  messages: Message[];
  viewer: "me" | "meiso";
  onSend: (text: string) => Promise<void>;
  onSendMedia: (params: {
    mediaType: "image" | "video" | "audio";
    file: Blob;
    contentType: string;
    durationMs?: number;
    caption?: string;
  }) => Promise<void>;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export function ChatView({ messages, viewer, onSend, onSendMedia }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordStartRef = useRef<number>(0);
  const recordTimerRef = useRef<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
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

  const handleFile = async (file: File, mediaType: "image" | "video") => {
    setMenuOpen(false);
    setSending(true);
    try {
      await onSendMedia({ mediaType, file, contentType: file.type || (mediaType === "image" ? "image/jpeg" : "video/mp4") });
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    setMenuOpen(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const ct = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: ct });
        const durationMs = Date.now() - recordStartRef.current;
        if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
        setRecording(false);
        setRecordMs(0);
        if (blob.size === 0) return;
        setSending(true);
        try {
          await onSendMedia({ mediaType: "audio", file: blob, contentType: ct, durationMs });
        } finally {
          setSending(false);
        }
      };
      recorderRef.current = mr;
      recordStartRef.current = Date.now();
      mr.start();
      setRecording(true);
      recordTimerRef.current = window.setInterval(() => {
        setRecordMs(Date.now() - recordStartRef.current);
      }, 200);
    } catch (err) {
      console.error("Mic permission denied", err);
      alert("Microphone permission is required to record voice notes.");
    }
  };

  const stopRecording = (cancel = false) => {
    const mr = recorderRef.current;
    if (!mr) return;
    if (cancel) {
      chunksRef.current = [];
    }
    if (mr.state !== "inactive") mr.stop();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 scroll-smooth">
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const grouped = prev && prev.sender === m.sender;
          const isMine = m.sender === viewer;
          const isMedia = !!m.media_url;
          const isImage = m.media_type === "image";
          const isVideo = m.media_type === "video";
          const isAudio = m.media_type === "audio";
          return (
            <div
              key={m.id}
              className={cn(
                "flex max-w-[80%] animate-fade-up",
                isMine ? "ms-auto justify-end" : "me-auto justify-start",
                grouped ? "mt-0.5" : "mt-2"
              )}
              style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
            >
              <div
                className={cn(
                  "relative text-[15px] leading-snug shadow-card max-w-full overflow-hidden",
                  isMine
                    ? "bg-gradient-primary text-primary-foreground rounded-2xl"
                    : "bg-card text-foreground rounded-2xl",
                  !grouped && isMine && "rounded-tr-md",
                  !grouped && !isMine && "rounded-tl-md",
                  isImage || isVideo ? "p-1.5" : "px-3 py-2",
                )}
              >
                {isImage && (
                  <img
                    src={m.media_url!}
                    alt={m.text ?? "Photo"}
                    loading="lazy"
                    className="rounded-xl max-h-72 w-auto object-cover"
                  />
                )}
                {isVideo && (
                  <video
                    src={m.media_url!}
                    controls
                    preload="metadata"
                    className="rounded-xl max-h-72 w-auto"
                  />
                )}
                {isAudio && (
                  <div className="px-2 py-1.5">
                    <VoiceBubble url={m.media_url!} durationMs={m.duration_ms} mine={isMine} />
                  </div>
                )}
                {m.text && (
                  <p
                    dir="auto"
                    className={cn(
                      "whitespace-pre-wrap break-words",
                      (isImage || isVideo) && "px-2 pt-1.5",
                    )}
                  >
                    {m.text}
                  </p>
                )}
                <div
                  dir="ltr"
                  className={cn(
                    "flex items-center justify-end gap-1 text-[10px] font-medium pt-1.5",
                    isMine ? "text-primary-foreground/80" : "text-muted-foreground",
                    isImage || isVideo ? "px-2 pb-1" : "",
                  )}
                >
                  <span>{formatTime(m.created_at)}</span>
                  {isMine && <Ticks status={m.status} mine={isMine} />}
                </div>
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
        {recording ? (
          <div className="flex items-center gap-3 bg-card rounded-full px-4 py-2 shadow-card">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-medium text-foreground tabular-nums">
              Recording… {formatDuration(recordMs)}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => stopRecording(true)}
              aria-label="Cancel recording"
              className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center active:scale-90"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => stopRecording(false)}
              aria-label="Send voice note"
              className="w-10 h-10 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center active:scale-90 hover:shadow-glow"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            {menuOpen && (
              <div className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-2xl shadow-soft p-2 flex flex-col gap-1 z-10 min-w-[180px]">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm hover:bg-muted text-foreground text-left"
                >
                  <ImageIcon className="w-4 h-4 text-coral" /> Photo
                </button>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm hover:bg-muted text-foreground text-left"
                >
                  <Video className="w-4 h-4 text-coral" /> Video
                </button>
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm hover:bg-muted text-foreground text-left"
                >
                  <Mic className="w-4 h-4 text-coral" /> Voice note
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 bg-card rounded-full ps-1.5 pe-1.5 py-1.5 shadow-card">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Attach"
                className="w-10 h-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center transition-all active:scale-90 hover:text-foreground shrink-0"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write something sweet…"
                dir="auto"
                className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground py-2 min-w-0"
              />
              {text.trim() ? (
                <button
                  type="submit"
                  aria-label="Send"
                  disabled={sending}
                  className="w-10 h-10 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 hover:shadow-glow shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  aria-label="Record voice note"
                  className="w-10 h-10 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center transition-all active:scale-90 hover:shadow-glow shrink-0"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f, "image");
            e.target.value = "";
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f, "video");
            e.target.value = "";
          }}
        />
      </form>
    </div>
  );
}
