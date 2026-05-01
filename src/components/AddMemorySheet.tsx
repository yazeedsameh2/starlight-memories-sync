import { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPost: (input: {
    imageBase64: string;
    contentType: string;
    caption: string;
  }) => Promise<void>;
}

export function AddMemorySheet({ open, onOpenChange, onPost }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string>("image/jpeg");
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setImageUrl(null);
    setCaption("");
    setPosting(false);
    setError(null);
  };

  const handleFile = (file: File) => {
    setContentType(file.type || "image/jpeg");
    const reader = new FileReader();
    reader.onload = (e) => setImageUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handlePost = async () => {
    if (!imageUrl || !caption.trim()) return;
    setPosting(true);
    setError(null);
    try {
      await onPost({
        imageBase64: imageUrl,
        contentType,
        caption: caption.trim(),
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post memory");
      setPosting(false);
    }
  };

  const canPost = !!imageUrl && caption.trim().length > 0 && !posting;

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DrawerContent className="max-w-[430px] mx-auto bg-card border-border">
        <DrawerHeader className="px-6 pt-2 pb-0">
          <DrawerTitle className="font-display text-2xl text-left">
            New memory <span className="text-[var(--coral)]">❤</span>
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-6 pb-8 pt-4 space-y-5">
          {/* Image picker */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />

          {imageUrl ? (
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted">
              <img src={imageUrl} alt="Selected memory" className="w-full h-full object-cover" />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => setImageUrl(null)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center active:scale-90 transition-transform"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full aspect-square rounded-2xl border-2 border-dashed border-border hover:border-[var(--coral)]/60 bg-muted/30 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-foreground transition-colors active:scale-[0.98]"
            >
              <div className="w-14 h-14 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-soft">
                <ImagePlus className="w-6 h-6" />
              </div>
              <span className="text-sm font-medium">Tap to choose a photo</span>
            </button>
          )}

          {/* Caption */}
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Caption
            </label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Say something soft..."
              rows={3}
              className="resize-none rounded-2xl bg-muted/40 border-border focus-visible:ring-[var(--coral)]/40 font-display text-base leading-relaxed"
              maxLength={240}
            />
            <div className="text-right text-[10px] text-muted-foreground">
              {caption.length}/240
            </div>
          </div>

          {/* Post */}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <button
            type="button"
            disabled={!canPost}
            onClick={handlePost}
            className={cn(
              "w-full h-14 rounded-full font-medium text-base transition-all active:scale-[0.98]",
              canPost
                ? "bg-gradient-primary text-primary-foreground shadow-soft hover:opacity-95"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {posting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Posting…
              </span>
            ) : (
              "Post memory"
            )}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
