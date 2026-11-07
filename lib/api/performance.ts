import { NextResponse } from "next/server";

export function withServerTiming(
  response: NextResponse,
  startedAt: number,
  phases: Record<string, number> = {}
): NextResponse {
  const phaseTimings = Object.entries(phases)
    .filter(([, duration]) => Number.isFinite(duration) && duration >= 0)
    .map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`);

  phaseTimings.push(`app;dur=${(performance.now() - startedAt).toFixed(1)}`);
  response.headers.set("Server-Timing", phaseTimings.join(", "));
  return response;
}
