import { isSpeechOriginAllowed, speechAllowOrigin } from "./origin";

export interface IflytekSpeechEnv {
  XFYUN_TTS_APP_ID?: string;
  XFYUN_TTS_API_KEY?: string;
  XFYUN_TTS_API_SECRET?: string;
  SPEECH_ALLOWED_ORIGIN?: string;
}

const host = "tts-api.xfyun.cn";
const path = "/v2/tts";

export async function issueIflytekUrl(request: Request, env: IflytekSpeechEnv): Promise<Response> {
  if (!env.XFYUN_TTS_APP_ID || !env.XFYUN_TTS_API_KEY || !env.XFYUN_TTS_API_SECRET) {
    return response({ error: "科大讯飞语音尚未配置。" }, 503, request, env);
  }

  if (!isSpeechOriginAllowed(request, env.SPEECH_ALLOWED_ORIGIN)) {
    return response({ error: "当前站点无权使用语音服务。" }, 403, request, env);
  }

  const date = new Date().toUTCString();
  const signatureSource = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.XFYUN_TTS_API_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = arrayBufferBase64(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signatureSource)),
  );
  const authorization = arrayBufferBase64(new TextEncoder().encode(
    `api_key="${env.XFYUN_TTS_API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`,
  ));
  const params = new URLSearchParams({ authorization, date, host });

  return response({
    url: `wss://${host}${path}?${params.toString()}`,
    appId: env.XFYUN_TTS_APP_ID,
    expiresIn: 300,
  }, 200, request, env);
}

function arrayBufferBase64(value: ArrayBufferLike | Uint8Array<ArrayBufferLike>): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function response(data: unknown, status: number, request: Request, env: IflytekSpeechEnv): Response {
  return Response.json(data, {
    status,
    headers: {
      "access-control-allow-origin": speechAllowOrigin(request, env.SPEECH_ALLOWED_ORIGIN),
      "cache-control": "no-store",
    },
  });
}
