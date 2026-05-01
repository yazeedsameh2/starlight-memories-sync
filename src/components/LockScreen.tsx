import { useState } from "react";
import { Heart, Loader2, Lock } from "lucide-react";
import { useSpace } from "./SpaceProvider";
import { cn } from "@/lib/utils";

export function LockScreen() {
  const { initialized, unlock, setup, loading, error, viewer, setViewer } = useSpace();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");

  if (initialized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isSetup = !initialized;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSetup) {
      if (pass.length < 4) return;
      if (pass !== confirm) return;
      await setup(pass).catch(() => {});
    } else {
      await unlock(pass).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen flex justify-center bg-background">
      <div className="w-full max-w-[430px] flex flex-col items-center justify-center px-8 py-12">
        <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow mb-6 animate-glow">
          <Heart className="w-9 h-9 text-primary-foreground" fill="currentColor" />
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Our Space</h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          {isSetup
            ? "Create a passcode you'll both share."
            : "Enter your shared passcode to unlock."}
        </p>

        <form onSubmit={submit} className="w-full mt-8 space-y-3">
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              type="password"
              inputMode="text"
              autoComplete="off"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={isSetup ? "Create passcode (min 4)" : "Passcode"}
              className="w-full h-14 pl-11 pr-4 rounded-2xl bg-card border border-border focus:outline-none focus:border-[var(--coral)]/60 transition-colors text-[15px]"
            />
          </div>
          {isSetup && (
            <input
              type="password"
              autoComplete="off"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm passcode"
              className="w-full h-14 px-4 rounded-2xl bg-card border border-border focus:outline-none focus:border-[var(--coral)]/60 transition-colors text-[15px]"
            />
          )}

          {/* Viewer toggle */}
          <div className="flex items-center gap-2 pt-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mr-2">
              I am
            </span>
            {(["me", "meiso"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setViewer(v)}
                className={cn(
                  "px-4 h-9 rounded-full text-sm font-medium transition-all active:scale-95 capitalize",
                  viewer === v
                    ? "bg-gradient-primary text-primary-foreground shadow-soft"
                    : "bg-card border border-border text-muted-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>

          {error && (
            <p className="text-sm text-destructive text-center pt-1">{error}</p>
          )}
          {isSetup && pass && confirm && pass !== confirm && (
            <p className="text-sm text-destructive text-center pt-1">
              Passcodes don't match
            </p>
          )}

          <button
            type="submit"
            disabled={loading || pass.length < 4 || (isSetup && pass !== confirm)}
            className="w-full h-14 mt-2 rounded-full bg-gradient-primary text-primary-foreground font-medium shadow-soft active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Please wait…
              </span>
            ) : isSetup ? (
              "Create our space"
            ) : (
              "Unlock"
            )}
          </button>
        </form>

        <p className="mt-8 text-[11px] text-muted-foreground text-center max-w-[280px]">
          The passcode is stored as a one-way hash. Share it only with each other.
        </p>
      </div>
    </div>
  );
}
