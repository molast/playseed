const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isSpeechOriginAllowed(request: Request, configuredOrigins?: string): boolean {
  const origin = request.headers.get("origin");
  if (!configuredOrigins) return true;
  if (!origin) return false;

  const allowed = configuredOrigins
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (allowed.includes(origin.replace(/\/$/, ""))) return true;

  try {
    const workerHost = new URL(request.url).hostname;
    const originUrl = new URL(origin);
    return localHosts.has(workerHost)
      && localHosts.has(originUrl.hostname)
      && (originUrl.protocol === "http:" || originUrl.protocol === "https:");
  } catch {
    return false;
  }
}

export function speechAllowOrigin(request: Request, configuredOrigins?: string): string {
  const origin = request.headers.get("origin");
  return origin && isSpeechOriginAllowed(request, configuredOrigins) ? origin : "*";
}
