// Client-side wrappers around the `space-api` edge function.
// Mirrors the original TanStack server-function call signatures: `fn({ data })`.
import { supabase } from "@/integrations/supabase/client";

async function call<T>(action: string, data?: unknown): Promise<T> {
  const { data: result, error } = await supabase.functions.invoke("space-api", {
    body: { action, data },
  });
  if (error) {
    // Try to surface a useful message from the edge function body
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const payload = await ctx.json();
        if (payload?.error) throw new Error(payload.error);
      } catch (_) {
        /* ignore */
      }
    }
    throw new Error(error.message || "Request failed");
  }
  if (result && typeof result === "object" && "error" in result && result.error) {
    throw new Error(String(result.error));
  }
  return result as T;
}

// ----- Auth -----
export const getSpaceStatus = () =>
  call<{ initialized: boolean }>("getSpaceStatus");

export const setPasscode = ({ data }: { data: { passcode: string } }) =>
  call<{ token: string }>("setPasscode", data);

export const verifyPasscode = ({ data }: { data: { passcode: string } }) =>
  call<{ token: string }>("verifyPasscode", data);

// ----- Memories -----
export const listMemories = ({ data }: { data: { token: string } }) =>
  call<{ memories: any[] }>("listMemories", data);

export const createMemory = ({
  data,
}: {
  data: {
    token: string;
    imageBase64: string;
    contentType: string;
    caption: string;
  };
}) => call<{ memory: any }>("createMemory", data);

export const toggleMemoryLike = ({
  data,
}: {
  data: { token: string; id: string; liked: boolean };
}) => call<{ ok: true }>("toggleMemoryLike", data);

export const deleteMemory = ({
  data,
}: {
  data: { token: string; id: string };
}) => call<{ ok: true }>("deleteMemory", data);

export const listComments = ({
  data,
}: {
  data: { token: string; memoryId: string };
}) => call<{ comments: any[] }>("listComments", data);

export const addComment = ({
  data,
}: {
  data: { token: string; memoryId: string; sender: "me" | "meiso"; text: string };
}) => call<{ comment: any }>("addComment", data);

// ----- Messages -----
export const listMessages = ({ data }: { data: { token: string } }) =>
  call<{ messages: any[] }>("listMessages", data);

export const sendMessage = ({
  data,
}: {
  data: { token: string; sender: "me" | "meiso"; text: string };
}) => call<{ message: any }>("sendMessage", data);

export const sendMediaMessage = ({
  data,
}: {
  data: {
    token: string;
    sender: "me" | "meiso";
    mediaType: "image" | "video" | "audio";
    contentType: string;
    fileBase64: string;
    caption?: string;
    durationMs?: number;
  };
}) => call<{ message: any }>("sendMediaMessage", data);

export const listMedia = ({ data }: { data: { token: string } }) =>
  call<{ media: any[] }>("listMedia", data);

export const markMessagesRead = ({
  data,
}: {
  data: { token: string; viewer: "me" | "meiso" };
}) => call<{ ok: true }>("markMessagesRead", data);

// ----- Migration -----
export const migrateLocalData = ({
  data,
}: {
  data: {
    token: string;
    memories: Array<{
      image: string;
      caption: string;
      liked?: boolean;
      timestamp?: string;
    }>;
    messages: Array<{
      sender: "me" | "meiso";
      text: string;
      status?: "sent" | "delivered" | "read";
      time?: string;
    }>;
  };
}) =>
  call<{ memoriesMigrated: number; messagesMigrated: number }>(
    "migrateLocalData",
    data,
  );
