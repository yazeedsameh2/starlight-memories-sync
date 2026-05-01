import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play } from "lucide-react";
import { listMedia } from "@/server/space.functions";

export interface MediaItem {
  id: string;
  media_url: string;
  media_type: "image" | "video" | "audio";
  duration_ms?: number | null;
  created_at: string;
  text?: string | null;
  sender: "me" | "meiso";
}

function formatDuration(ms?: number | null) {
  if (!ms || ms <= 0) return "0:00";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function SharedMediaSheet({
  open,
  onOpenChange,
  token,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listMedia({ data: { token } })
      .then((r) => setItems(r.media as MediaItem[]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, token]);

  const photos = items.filter((i) => i.media_type === "image");
  const videos = items.filter((i) => i.media_type === "video");
  const audio = items.filter((i) => i.media_type === "audio");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle className="font-display text-2xl text-left">Shared Media</SheetTitle>
        </SheetHeader>
        <Tabs defaultValue="photos" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 grid grid-cols-3 bg-muted">
            <TabsTrigger value="photos">Photos ({photos.length})</TabsTrigger>
            <TabsTrigger value="videos">Videos ({videos.length})</TabsTrigger>
            <TabsTrigger value="voice">Voice ({audio.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="photos" className="flex-1 overflow-y-auto px-4 pb-6 pt-3 mt-0">
            {loading ? (
              <Empty label="Loading…" />
            ) : photos.length === 0 ? (
              <Empty label="No photos shared yet" />
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map((p) => (
                  <a
                    key={p.id}
                    href={p.media_url}
                    target="_blank"
                    rel="noreferrer"
                    className="aspect-square rounded-lg overflow-hidden bg-muted block"
                  >
                    <img src={p.media_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="videos" className="flex-1 overflow-y-auto px-4 pb-6 pt-3 mt-0">
            {loading ? (
              <Empty label="Loading…" />
            ) : videos.length === 0 ? (
              <Empty label="No videos shared yet" />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {videos.map((v) => (
                  <div key={v.id} className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                    <video src={v.media_url} className="w-full h-full object-cover" preload="metadata" />
                    <a
                      href={v.media_url}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors"
                    >
                      <span className="w-10 h-10 rounded-full bg-background/90 flex items-center justify-center">
                        <Play className="w-4 h-4 text-foreground ml-0.5" />
                      </span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="voice" className="flex-1 overflow-y-auto px-6 pb-6 pt-3 mt-0">
            {loading ? (
              <Empty label="Loading…" />
            ) : audio.length === 0 ? (
              <Empty label="No voice notes shared yet" />
            ) : (
              <ul className="space-y-2">
                {audio.map((a) => (
                  <li key={a.id} className="bg-card border border-border rounded-2xl p-3 shadow-card">
                    <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                      <span>{a.sender === "me" ? "Yazeed" : "Meiso"}</span>
                      <span>
                        {new Date(a.created_at).toLocaleDateString()} · {formatDuration(a.duration_ms)}
                      </span>
                    </div>
                    <audio src={a.media_url} controls className="w-full" preload="metadata" />
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-center text-sm text-muted-foreground italic mt-12">{label}</p>;
}
