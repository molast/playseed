import { assets, questionBank } from "./data";
import { issueSpeechToken, type SpeechTokenEnv } from "../speech/token";
import { issueIflytekUrl, type IflytekSpeechEnv } from "../speech/iflytek";

interface Env extends SpeechTokenEnv, IflytekSpeechEnv {
  APP_NAME: string;
}

interface LearningRecordInput {
  id?: string;
  userId?: string;
  questionId?: string;
  answer?: string;
  correct?: boolean;
  duration?: number;
  retryCount?: number;
  timestamp?: string;
}

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { ...corsHeaders, "cache-control": "no-store" },
  });
}

function validRecord(record: LearningRecordInput): boolean {
  return Boolean(
    record.userId &&
      record.questionId &&
      typeof record.answer === "string" &&
      typeof record.correct === "boolean" &&
      typeof record.duration === "number" &&
      typeof record.retryCount === "number",
  );
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: env.APP_NAME, version: "feature-01" });
    }

    if (request.method === "GET" && url.pathname === "/api/questions") {
      const subject = url.searchParams.get("subject");
      const template = url.searchParams.get("template");
      const questions = questionBank.filter(
        (question) =>
          (!subject || question.subject === subject) &&
          (!template || question.type === template),
      );
      return json({ data: questions, total: questions.length });
    }

    if (request.method === "GET" && url.pathname === "/api/assets") {
      return json({ data: assets, total: assets.length });
    }

    if (request.method === "POST" && url.pathname === "/api/records") {
      let record: LearningRecordInput;
      try {
        record = await request.json<LearningRecordInput>();
      } catch {
        return json({ error: "Request body must be valid JSON." }, 400);
      }

      if (!validRecord(record)) {
        return json({ error: "Learning record is missing required fields." }, 422);
      }

      return json(
        {
          data: {
            ...record,
            id: record.id ?? crypto.randomUUID(),
            timestamp: record.timestamp ?? new Date().toISOString(),
          },
          persisted: false,
        },
        202,
      );
    }

    if (request.method === "GET" && url.pathname === "/api/progress") {
      return json({
        data: {
          total: 0,
          correct: 0,
          accuracy: 0,
          activeDays: 0,
          currentStreak: 0,
        },
        source: "client-local",
      });
    }

    if (request.method === "GET" && url.pathname === "/api/speech/token") {
      return issueSpeechToken(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/speech/iflytek-url") {
      return issueIflytekUrl(request, env);
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        name: env.APP_NAME,
        endpoints: [
          "GET /health",
          "GET /api/questions",
          "GET /api/assets",
          "POST /api/records",
          "GET /api/progress",
          "GET /api/speech/token",
          "GET /api/speech/iflytek-url",
        ],
      });
    }

    return json({ error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
