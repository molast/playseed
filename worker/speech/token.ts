import { isSpeechOriginAllowed, speechAllowOrigin } from "./origin";

export interface SpeechTokenEnv {
  AZURE_SPEECH_KEY?: string;
  AZURE_SPEECH_REGION?: string;
  SPEECH_ALLOWED_ORIGIN?: string;
}

export async function issueSpeechToken(request: Request, env: SpeechTokenEnv): Promise<Response> {
  if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) {
    return response({ error: "Azure Speech 尚未配置。" }, 503, request, env);
  }

  if (!isSpeechOriginAllowed(request, env.SPEECH_ALLOWED_ORIGIN)) {
    return response({ error: "当前站点无权使用语音服务。" }, 403, request, env);
  }

  const tokenResponse = await fetch(
    `https://${env.AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
    {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY },
    },
  );
  if (!tokenResponse.ok) {
    return response({ error: "Azure Speech Token 获取失败。" }, 502, request, env);
  }

  return response({
    token: await tokenResponse.text(),
    region: env.AZURE_SPEECH_REGION,
    expiresIn: 540,
  }, 200, request, env);
}

function response(data: unknown, status: number, request: Request, env: SpeechTokenEnv): Response {
  return Response.json(data, {
    status,
    headers: {
      "access-control-allow-origin": speechAllowOrigin(request, env.SPEECH_ALLOWED_ORIGIN),
      "cache-control": "no-store",
    },
  });
}
