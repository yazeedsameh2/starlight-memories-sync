// Edge function: space-api
// Handles passcode auth + memories + messages for "Our Space".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- crypto helpers (Web Crypto, Deno) ----------

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
function b64urlEncode(bytes: Uint8Array | string): string {
  const b = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let bin = "";
  for (const v of b) bin += String.fromCharCode(v);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2Hash(passcode: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passcode),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(saltHex),
      iterations: 100_000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

async function hashPasscode(passcode: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = bytesToHex(salt);
  const hash = await pbkdf2Hash(passcode, saltHex);
  return `pbkdf2$${saltHex}$${hash}`;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function verifyHashed(passcode: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !salt || !hash) return false;
  const candidate = await pbkdf2Hash(passcode, salt);
  return timingSafeEqualStr(candidate, hash);
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return new Uint8Array(sig);
}

async function signToken(payload: Record<string, unknown>): Promise<string> {
  const data = b64urlEncode(
    JSON.stringify({ ...payload, exp: Date.now() + TOKEN_TTL_MS }),
  );
  const sig = b64urlEncode(await hmacSha256(SERVICE_ROLE, data));
  return `${data}.${sig}`;
}

async function verifyToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [data, sig] = token.split(".");
  if (!data || !sig) return false;
  const expected = b64urlEncode(await hmacSha256(SERVICE_ROLE, data));
  if (!timingSafeEqualStr(sig, expected)) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(data)));
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

async function requireToken(token: string | undefined | null) {
  if (!(await verifyToken(token))) throw new Error("Unauthorized");
}

// ---------- handlers ----------

type Body = { action: string; data?: any };

async function handle({ action, data }: Body) {
  switch (action) {
    case "getSpaceStatus": {
      const { data: row, error } = await supabaseAdmin
        .from("space_settings")
        .select("passcode_hash")
        .eq("id", 1)
        .single();
      if (error) throw new Error(error.message);
      return { initialized: !!row?.passcode_hash };
    }

    case "setPasscode": {
      const passcode = String(data?.passcode ?? "");
      if (passcode.length < 4 || passcode.length > 64) {
        throw new Error("Passcode must be 4-64 characters");
      }
      const { data: row, error } = await supabaseAdmin
        .from("space_settings")
        .select("passcode_hash")
        .eq("id", 1)
        .single();
      if (error) throw new Error(error.message);
      if (row?.passcode_hash) throw new Error("Passcode already set");
      const hash = await hashPasscode(passcode);
      const { error: upErr } = await supabaseAdmin
        .from("space_settings")
        .update({ passcode_hash: hash, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (upErr) throw new Error(upErr.message);
      return { token: await signToken({ ok: true }) };
    }

    case "verifyPasscode": {
      const passcode = String(data?.passcode ?? "");
      const { data: row, error } = await supabaseAdmin
        .from("space_settings")
        .select("passcode_hash")
        .eq("id", 1)
        .single();
      if (error) throw new Error(error.message);
      if (!row?.passcode_hash) throw new Error("Passcode not set");
      if (!(await verifyHashed(passcode, row.passcode_hash))) {
        throw new Error("Wrong passcode");
      }
      return { token: await signToken({ ok: true }) };
    }

    case "listMemories": {
      await requireToken(data?.token);
      const { data: rows, error } = await supabaseAdmin
        .from("memories")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return { memories: rows ?? [] };
    }

    case "createMemory": {
      await requireToken(data?.token);
      const imageBase64: string = data.imageBase64;
      const contentType: string = data.contentType || "image/jpeg";
      const caption: string = data.caption;
      if (!/^image\/(png|jpe?g|webp|gif|heic)$/i.test(contentType)) {
        throw new Error("Unsupported image type");
      }
      if (!caption || caption.length > 280) throw new Error("Bad caption");
      const b64 = imageBase64.includes(",")
        ? imageBase64.split(",")[1]
        : imageBase64;
      const bytes = b64urlDecodeRaw(b64);
      if (bytes.length > 8 * 1024 * 1024) throw new Error("Image too large");
      const ext = contentType.split("/")[1].replace("jpeg", "jpg");
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("memories")
        .upload(path, bytes, { contentType, upsert: false });
      if (upErr) throw new Error(upErr.message);
      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from("memories").getPublicUrl(path);
      const { data: row, error } = await supabaseAdmin
        .from("memories")
        .insert({ image_url: publicUrl, storage_path: path, caption })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { memory: row };
    }

    case "toggleMemoryLike": {
      await requireToken(data?.token);
      const { error } = await supabaseAdmin
        .from("memories")
        .update({ liked: !!data.liked })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case "listMessages": {
      await requireToken(data?.token);
      const { data: rows, error } = await supabaseAdmin
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw new Error(error.message);
      return { messages: rows ?? [] };
    }

    case "sendMessage": {
      await requireToken(data?.token);
      const sender = data.sender;
      const text = data.text ? String(data.text) : null;
      if (sender !== "me" && sender !== "meiso") throw new Error("Bad sender");
      if (!text || text.length === 0 || text.length > 2000) throw new Error("Bad text");
      const { data: row, error } = await supabaseAdmin
        .from("messages")
        .insert({ sender, text, status: "sent" })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { message: row };
    }

    case "sendMediaMessage": {
      await requireToken(data?.token);
      const sender = data.sender;
      const mediaType = data.mediaType as "image" | "video" | "audio";
      const contentType = String(data.contentType ?? "");
      const fileBase64 = String(data.fileBase64 ?? "");
      const caption = data.caption ? String(data.caption).slice(0, 280) : null;
      const durationMs = typeof data.durationMs === "number" ? data.durationMs : null;
      if (sender !== "me" && sender !== "meiso") throw new Error("Bad sender");
      if (!["image", "video", "audio"].includes(mediaType)) throw new Error("Bad mediaType");
      if (!contentType) throw new Error("Missing contentType");

      const b64 = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;
      const bytes = b64urlDecodeRaw(b64);
      const maxBytes = mediaType === "video" ? 50 * 1024 * 1024 : 15 * 1024 * 1024;
      if (bytes.length === 0) throw new Error("Empty file");
      if (bytes.length > maxBytes) throw new Error("File too large");

      const extGuess = contentType.split("/")[1]?.split(";")[0] || "bin";
      const ext = extGuess.replace("jpeg", "jpg").replace("quicktime", "mov");
      const path = `${mediaType}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("chat-media")
        .upload(path, bytes, { contentType, upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from("chat-media")
        .getPublicUrl(path);

      const { data: row, error } = await supabaseAdmin
        .from("messages")
        .insert({
          sender,
          text: caption,
          status: "sent",
          media_url: publicUrl,
          media_path: path,
          media_type: mediaType,
          duration_ms: durationMs,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { message: row };
    }

    case "listMedia": {
      await requireToken(data?.token);
      const { data: rows, error } = await supabaseAdmin
        .from("messages")
        .select("*")
        .not("media_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return { media: rows ?? [] };
    }

    case "markMessagesRead": {
      await requireToken(data?.token);
      const viewer = data.viewer;
      if (viewer !== "me" && viewer !== "meiso") throw new Error("Bad viewer");
      const otherSender = viewer === "me" ? "meiso" : "me";
      const { error } = await supabaseAdmin
        .from("messages")
        .update({ status: "read" })
        .eq("sender", otherSender)
        .neq("status", "read");
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case "migrateLocalData": {
      await requireToken(data?.token);
      let memoriesMigrated = 0;
      for (const m of data.memories ?? []) {
        if (typeof m?.image !== "string") continue;
        if (!m.image.startsWith("data:image/")) continue;
        const match = m.image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (!match) continue;
        const ct = match[1];
        const bytes = b64urlDecodeRaw(match[2]);
        if (bytes.length > 8 * 1024 * 1024) continue;
        const ext = ct.split("/")[1].replace("jpeg", "jpg");
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("memories")
          .upload(path, bytes, { contentType: ct, upsert: false });
        if (upErr) continue;
        const {
          data: { publicUrl },
        } = supabaseAdmin.storage.from("memories").getPublicUrl(path);
        await supabaseAdmin.from("memories").insert({
          image_url: publicUrl,
          storage_path: path,
          caption: m.caption,
          liked: !!m.liked,
        });
        memoriesMigrated++;
      }
      let messagesMigrated = 0;
      const messageRows = (data.messages ?? [])
        .filter(
          (m: any) =>
            (m.sender === "me" || m.sender === "meiso") &&
            typeof m.text === "string" &&
            m.text.length > 0,
        )
        .map((m: any) => ({
          sender: m.sender,
          text: m.text,
          status: m.status ?? "read",
        }));
      if (messageRows.length > 0) {
        const { error } = await supabaseAdmin.from("messages").insert(messageRows);
        if (!error) messagesMigrated = messageRows.length;
      }
      return { memoriesMigrated, messagesMigrated };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

function b64urlDecodeRaw(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = (await req.json()) as Body;
    const result = await handle(body);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = msg === "Unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
