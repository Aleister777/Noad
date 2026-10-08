import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const FILE = join(process.cwd(), "canvas-state.json");

export async function GET() {
  if (!existsSync(FILE)) return NextResponse.json(null);
  try {
    return NextResponse.json(JSON.parse(readFileSync(FILE, "utf-8")));
  } catch {
    return NextResponse.json(null);
  }
}

export async function POST(req: Request) {
  try {
    writeFileSync(FILE, JSON.stringify(await req.json(), null, 2));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
