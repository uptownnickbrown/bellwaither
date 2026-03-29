import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

export async function POST(req: NextRequest, { params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
  const body = await req.text();
  const res = await fetch(`${backendUrl}/api/onboarding/${schoolId}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
