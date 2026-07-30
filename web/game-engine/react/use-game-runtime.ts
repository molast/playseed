"use client";

import { useEffect, useRef, useState } from "react";

import type { AudioAdapter } from "../systems/audio-system";
import type {
  GameSnapshot,
  PlayableGameDefinition,
  RuntimeMiniGame,
} from "../game-definition";
import { GameRuntime } from "../game-runtime";
import type { QuestionProvider } from "../question";
import type { GameResult } from "../session";

export function useGameRuntime<TSnapshot extends GameSnapshot, TGame extends RuntimeMiniGame>({
  definition,
  questions,
  audioAdapter,
  onResult,
}: {
  definition: PlayableGameDefinition<TSnapshot, TGame>;
  questions: QuestionProvider;
  audioAdapter: AudioAdapter;
  onResult: (result: GameResult) => void;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const runtimeRef = useRef<GameRuntime<TSnapshot, TGame> | null>(null);
  const onResultRef = useRef(onResult);
  const [snapshot, setSnapshot] = useState<TSnapshot>(() => definition.initialSnapshot());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (!host) return;
    let disposed = false;
    queueMicrotask(() => {
      if (disposed) return;
      setReady(false);
      setError("");
      setSnapshot(definition.initialSnapshot());
    });
    const runtime = new GameRuntime({
      definition,
      questions,
      audioAdapter,
      onStateChange: setSnapshot,
      onResult: (result) => onResultRef.current(result),
    });
    runtimeRef.current = runtime;
    void runtime.mount(host)
      .then(() => {
        if (!disposed) setReady(true);
      })
      .catch((reason) => {
        if (!disposed) setError(reason instanceof Error ? reason.message : "游戏引擎初始化失败");
      });

    return () => {
      disposed = true;
      runtimeRef.current = null;
      runtime.destroy();
    };
  }, [audioAdapter, definition, host, questions]);

  return {
    setHost,
    snapshot,
    ready,
    error,
    start: () => runtimeRef.current?.start(),
    pause: () => runtimeRef.current?.pause(),
    resume: () => runtimeRef.current?.resume(),
    withGame: (callback: (game: TGame) => void) => runtimeRef.current?.withGame(callback),
  };
}
