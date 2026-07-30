import { TokenProvider } from "./TokenProvider";
import type { SpeechRequest } from "./types";

export class AzureSpeech {
  constructor(private readonly tokens: TokenProvider) {}

  async synthesize(request: SpeechRequest): Promise<ArrayBuffer> {
    const { token, region } = await this.tokens.getToken();
    const speechSdk = await import("microsoft-cognitiveservices-speech-sdk");
    const speechConfig = speechSdk.SpeechConfig.fromAuthorizationToken(token, region);
    speechConfig.speechSynthesisVoiceName = request.settings.azureVoice;
    speechConfig.speechSynthesisOutputFormat =
      speechSdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
    const synthesizer = new speechSdk.SpeechSynthesizer(speechConfig);

    return new Promise<ArrayBuffer>((resolve, reject) => {
      synthesizer.speakSsmlAsync(
        createSsml(request),
        (result) => {
          synthesizer.close();
          if (result.reason === speechSdk.ResultReason.SynthesizingAudioCompleted) {
            resolve(result.audioData);
          } else {
            reject(new Error(result.errorDetails || "Azure Speech 合成失败。"));
          }
        },
        (error) => {
          synthesizer.close();
          reject(new Error(String(error)));
        },
      );
    });
  }
}

function createSsml({ text, settings }: SpeechRequest): string {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
  const rate = `${Math.round((settings.rate - 1) * 100)}%`;
  const content = `<prosody rate="${rate}">${escaped}</prosody>`;
  const styled =
    settings.azureStyle === "default"
      ? content
      : `<mstts:express-as style="${settings.azureStyle}">${content}</mstts:express-as>`;

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN"><voice name="${settings.azureVoice}">${styled}</voice></speak>`;
}
