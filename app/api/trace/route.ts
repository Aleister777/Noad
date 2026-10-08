import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const runtime = "nodejs";

const MAX_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);
const ALLOWED_EXT = /\.(jpe?g|png)$/i;
// Color mode runs many sequential potrace passes (one per quantized color layer) on top of
// k-means clustering, so it needs more headroom than a single bw/gray trace.
const WORKER_TIMEOUT_MS = 45000;

interface TraceSettings {
  mode: "bw" | "gray" | "color";
  threshold?: number;
  steps?: number;
  fillStrategy?: string;
  colors?: number;
  turdSize?: number;
  alphaMax?: number;
  invert?: boolean;
  color?: string;
  background?: string;
}

// Runs the trace in a genuinely separate OS process, NOT worker_threads — Turbopack's dev/build
// runtime intercepts `new Worker(...)` and re-executes the target script through its own module
// system for HMR, which breaks potrace's internal Buffer checks. Plain `child_process.spawn` of
// the current Node binary (with an explicit IPC stdio channel, i.e. what `fork()` is sugar for)
// gets the same real-subprocess isolation without Turbopack's build-time file tracer choking on
// the dynamic path the way it does for `fork()`, which it treats as a module import to resolve.
// Path is built from `process.cwd()`, not `__dirname` — Turbopack virtualizes `__dirname` in
// server route code to a fake sentinel path, but `process.cwd()` is the real filesystem cwd
// (same pattern already used by app/api/canvas/route.ts for canvas-state.json).
function runWorker(buffer: Buffer, mode: string, options: Record<string, unknown>) {
  return new Promise<{ svg: string; naturalWidth: number; naturalHeight: number }>((resolve, reject) => {
    const workerPath = path.join(process.cwd(), "workers", "imageTraceWorker.js");
    const child = spawn(process.execPath, [workerPath], {
      stdio: ["ignore", "ignore", "pipe", "ipc"],
      serialization: "advanced",
    });
    let stderr = "";
    child.stderr?.on("data", chunk => { stderr += chunk.toString(); });
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new Error("Tracing timed out")));
    }, WORKER_TIMEOUT_MS);

    child.once("message", (msg: { ok: boolean; svg?: string; naturalWidth?: number; naturalHeight?: number; error?: string }) => {
      finish(() => {
        if (msg.ok) resolve({ svg: msg.svg!, naturalWidth: msg.naturalWidth!, naturalHeight: msg.naturalHeight! });
        else reject(new Error(msg.error || "Tracing failed"));
      });
    });
    child.once("error", err => {
      finish(() => reject(err));
    });
    child.once("exit", code => {
      finish(() => reject(new Error(`Worker stopped with exit code ${code}${stderr ? `: ${stderr.trim()}` : ""}`)));
    });

    child.send({ buffer, mode, options });
  });
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const settingsRaw = form.get("settings");
  const isFileLike = (v: unknown): v is File =>
    typeof v === "object" && v !== null &&
    typeof (v as File).arrayBuffer === "function" &&
    typeof (v as File).size === "number";
  if (!isFileLike(file) || typeof settingsRaw !== "string") {
    return NextResponse.json({ error: "Missing file or settings" }, { status: 400 });
  }

  const name = typeof file.name === "string" ? file.name : "";
  const typeOk = ALLOWED_TYPES.has(file.type) || ALLOWED_EXT.test(name);
  if (!typeOk) {
    return NextResponse.json({ error: "Only .jpg, .jpeg, and .png files are supported" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File is too large (max 15MB)" }, { status: 400 });
  }

  let settings: TraceSettings;
  try {
    settings = JSON.parse(settingsRaw);
  } catch {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }

  const mode = settings.mode === "gray" ? "gray" : settings.mode === "color" ? "color" : "bw";
  const options: Record<string, unknown> = {
    turdSize: settings.turdSize,
    alphaMax: settings.alphaMax,
    blackOnWhite: !settings.invert,
    background: settings.background || "transparent",
  };
  if (mode === "bw") {
    options.threshold = settings.threshold;
    options.color = settings.color || "#000000";
  } else if (mode === "gray") {
    options.steps = settings.steps;
    options.fillStrategy = settings.fillStrategy || "dominant";
  } else {
    options.colors = settings.colors ?? 6;
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await runWorker(buffer, mode, options);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Tracing failed" }, { status: 500 });
  }
}
