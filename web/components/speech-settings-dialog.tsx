"use client";

import { Check, LoaderCircle, Settings, Trash2, Volume2, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  azureStyles,
  azureVoices,
  iflytekVoices,
  speechManager,
  type SpeechSettings,
} from "@/speech";
import { practiceGoalOptions, type PracticeGoal } from "@/lib/practice-settings";

export function SpeechSettingsDialog({
  settings,
  practiceGoal,
  onChange,
  onPracticeGoalChange,
  onClose,
}: {
  settings: SpeechSettings;
  practiceGoal: PracticeGoal;
  onChange: (settings: SpeechSettings) => void;
  onPracticeGoalChange: (goal: PracticeGoal) => void;
  onClose: () => void;
}) {
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [testing, setTesting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function loadVoices() {
      setBrowserVoices(
        window.speechSynthesis
          .getVoices()
          .filter((voice) => voice.lang.toLowerCase().startsWith("zh")),
      );
    }

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function patch(next: Partial<SpeechSettings>) {
    onChange({ ...settings, ...next });
    setMessage("");
  }

  const selectedAzureVoice = azureVoices.find((voice) => voice.id === settings.azureVoice) ?? azureVoices[0];
  const availableAzureStyles = azureStyles.filter((style) =>
    (selectedAzureVoice.styles as readonly string[]).includes(style.id),
  );

  async function testVoice() {
    setTesting(true);
    setMessage("");
    try {
      await speechManager.play({
        text: "你好，小朋友。我们一起来学拼音。",
        category: "sentences",
        subject: "pinyin",
        settings,
      });
      setMessage("试听完成");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "语音播放失败。请检查配置。");
    } finally {
      setTesting(false);
    }
  }

  async function clearCache() {
    setClearing(true);
    setMessage("");
    try {
      await speechManager.clearCache();
      setMessage("本地语音缓存已清除");
    } catch {
      setMessage("无法清除本地语音缓存。");
    } finally {
      setClearing(false);
    }
  }

  const messageIsSuccess = message === "试听完成" || message === "本地语音缓存已清除";

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="speech-settings-title">
        <header>
          <div>
            <span className="dialog-icon"><Settings size={19} /></span>
            <div>
              <p>Preferences</p>
              <h2 id="speech-settings-title">学习设置</h2>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} title="关闭" aria-label="关闭设置">
            <X size={19} />
          </button>
        </header>

        <div className="settings-content">
          <div className="settings-field">
            <span className="settings-label">每次练习题数</span>
            <div className="segmented-control practice-goal-control" role="group" aria-label="每次练习题数">
              {practiceGoalOptions.map((goal) => (
                <button
                  className={practiceGoal === goal ? "active" : ""}
                  key={goal}
                  onClick={() => onPracticeGoalChange(goal)}
                >
                  {goal} 题
                </button>
              ))}
            </div>
          </div>

          <div className="settings-field">
            <span className="settings-label">语音来源</span>
            <div className="segmented-control speech-provider-control" role="group" aria-label="语音来源">
              <button
                className={settings.provider === "auto" ? "active" : ""}
                onClick={() => patch({ provider: "auto" })}
              >
                智能选择
              </button>
              <button
                className={settings.provider === "iflytek" ? "active" : ""}
                onClick={() => patch({ provider: "iflytek" })}
              >
                科大讯飞
              </button>
              <button
                className={settings.provider === "azure" ? "active" : ""}
                onClick={() => patch({ provider: "azure" })}
              >
                Azure Speech
              </button>
              <button
                className={settings.provider === "browser" ? "active" : ""}
                onClick={() => patch({ provider: "browser" })}
              >
                系统语音 · 免费
              </button>
            </div>
          </div>

          {settings.provider === "iflytek" || settings.provider === "auto" ? (
            <label className="settings-field">
              <span className="settings-label">科大讯飞音色</span>
              <select value={settings.iflytekVoice} onChange={(event) => patch({ iflytekVoice: event.target.value })}>
                {iflytekVoices.map((voice) => <option value={voice.id} key={voice.id}>{voice.label}</option>)}
              </select>
            </label>
          ) : settings.provider === "azure" ? (
            <>
              <label className="settings-field">
                <span className="settings-label">Azure 音色</span>
                <select
                  value={settings.azureVoice}
                  onChange={(event) => {
                    const voice = azureVoices.find((item) => item.id === event.target.value) ?? azureVoices[0];
                    const style = (voice.styles as readonly string[]).includes(settings.azureStyle)
                      ? settings.azureStyle
                      : "default";
                    patch({ azureVoice: voice.id, azureStyle: style });
                  }}
                >
                  {azureVoices.map((voice) => <option value={voice.id} key={voice.id}>{voice.label}</option>)}
                </select>
              </label>
              <label className="settings-field">
                <span className="settings-label">语音风格</span>
                <select
                  value={settings.azureStyle}
                  onChange={(event) => patch({ azureStyle: event.target.value as SpeechSettings["azureStyle"] })}
                >
                  {availableAzureStyles.map((style) => <option value={style.id} key={style.id}>{style.label}</option>)}
                </select>
              </label>
            </>
          ) : settings.provider === "browser" ? (
            <label className="settings-field">
              <span className="settings-label">系统中文音色</span>
              <select value={settings.browserVoice} onChange={(event) => patch({ browserVoice: event.target.value })}>
                <option value="">自动选择中文音色</option>
                {browserVoices.map((voice) => (
                  <option value={voice.voiceURI} key={voice.voiceURI}>{voice.name} · {voice.lang}</option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="settings-field">
            <span className="settings-label-row">
              <span className="settings-label">语速</span>
              <strong>{settings.rate.toFixed(2)}x</strong>
            </span>
            <input
              type="range"
              min="0.6"
              max="1.2"
              step="0.05"
              value={settings.rate}
              onChange={(event) => patch({ rate: Number(event.target.value) })}
            />
          </label>

          <div className="speech-test-row">
            <button className="secondary-button" onClick={() => void testVoice()} disabled={testing}>
              {testing ? <LoaderCircle className="spin" size={18} /> : <Volume2 size={18} />}
              试听
            </button>
            {message && <span className={messageIsSuccess ? "success" : "error"}>{messageIsSuccess && <Check size={15} />}{message}</span>}
          </div>
          <button className="cache-clear-button" onClick={() => void clearCache()} disabled={clearing}>
            {clearing ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}
            清除本地语音缓存
          </button>
        </div>
      </section>
    </div>
  );
}
