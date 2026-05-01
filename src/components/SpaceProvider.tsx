import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSpaceStatus, setPasscode, verifyPasscode } from "@/server/space.functions";

interface SpaceCtx {
  token: string | null;
  initialized: boolean | null;
  loading: boolean;
  error: string | null;
  unlock: (passcode: string) => Promise<void>;
  setup: (passcode: string) => Promise<void>;
  lock: () => void;
  viewer: "me" | "meiso";
  setViewer: (v: "me" | "meiso") => void;
}

const Ctx = createContext<SpaceCtx | null>(null);

const TOKEN_KEY = "ourspace.token";
const VIEWER_KEY = "ourspace.viewer";

export function SpaceProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null
  );
  const [viewer, setViewerState] = useState<"me" | "meiso">(() => {
    if (typeof window === "undefined") return "me";
    return (localStorage.getItem(VIEWER_KEY) as "me" | "meiso") || "me";
  });
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSpaceStatus()
      .then((r) => setInitialized(r.initialized))
      .catch(() => setInitialized(false));
  }, []);

  const persistToken = (t: string | null) => {
    setToken(t);
    if (typeof window !== "undefined") {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    }
  };

  const unlock = async (passcode: string) => {
    setLoading(true);
    setError(null);
    try {
      const { token } = await verifyPasscode({ data: { passcode } });
      persistToken(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wrong passcode");
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const setup = async (passcode: string) => {
    setLoading(true);
    setError(null);
    try {
      const { token } = await setPasscode({ data: { passcode } });
      persistToken(token);
      setInitialized(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set passcode");
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const lock = () => persistToken(null);

  const setViewer = (v: "me" | "meiso") => {
    setViewerState(v);
    if (typeof window !== "undefined") localStorage.setItem(VIEWER_KEY, v);
  };

  return (
    <Ctx.Provider
      value={{ token, initialized, loading, error, unlock, setup, lock, viewer, setViewer }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSpace() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSpace must be used inside SpaceProvider");
  return c;
}
