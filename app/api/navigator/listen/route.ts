// Speech-to-text for Navigator: the other half of the voice loop.
//
// Takes a short recording from the push-to-talk button and returns the
// transcript only. It never sends the text on to chat itself — the transcript
// goes back to the client first so a mis-heard sentence can be edited instead
// of being acted on, which matters when the tools write to real data.
import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// A push-to-talk thought, not a meeting recording. ~25MB is the API ceiling
// anyway; this stops a stuck recorder from uploading the whole session.
const MAX_BYTES = 20 * 1024 * 1024;

// iOS Safari records audio/mp4, Chrome and Android record audio/webm. Both
// have to work or voice input silently fails on one of his devices.
const EXT_BY_TYPE: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/mpga": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/flac": "flac",
};

export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Voice input is not configured on the server." }, { status: 503 });
  }

  let audio: File | null = null;
  try {
    const form = await req.formData();
    const raw = form.get("audio");
    if (raw instanceof File) audio = raw;
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  if (!audio) return NextResponse.json({ error: "No audio received." }, { status: 400 });
  if (audio.size === 0) return NextResponse.json({ error: "The recording was empty." }, { status: 400 });
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: "That recording is too long." }, { status: 413 });
  }

  // The browser's MIME string can carry codec params ("audio/webm;codecs=opus")
  // and the API rejects an unknown extension, so normalise before naming it.
  const baseType = (audio.type || "").split(";")[0].trim().toLowerCase();
  const ext = EXT_BY_TYPE[baseType] ?? "webm";

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const file = await toFile(Buffer.from(await audio.arrayBuffer()), `speech.${ext}`, {
      type: baseType || "audio/webm",
    });

    const out = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
      // Locking the language stops a half-second of noise being "transcribed"
      // as confident nonsense in another language.
      language: "en",
      // Proper nouns the model would otherwise mangle into something unusable.
      prompt: "Rotahr, Navigator, HACCP, rota, Dublin, Gabor.",
    });

    const text = (out.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "Didn't catch anything — try again." }, { status: 422 });

    return NextResponse.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Transcription failed";
    console.error("[navigator/listen]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
