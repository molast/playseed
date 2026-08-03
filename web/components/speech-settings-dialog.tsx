"use client";

import { Check, LoaderCircle, Settings, Volume2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { speechManager, type SpeechSettings } from "@/speech";
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

  const messageIsSuccess = message === "试听完成";

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
                本地录音优先
              </button>
              <button
                className={settings.provider === "browser" ? "active" : ""}
                onClick={() => patch({ provider: "browser" })}
              >
                系统语音 · 免费
              </button>
            </div>
          </div>

          {settings.provider === "browser" ? (
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
        </div>
      </section>
    </div>
  );
}
