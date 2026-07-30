type PracticeFeedback = "correct" | "wrong";

let audioContext: AudioContext | null = null;

function contextForFeedback() {
  if (typeof window === "undefined") return null;
  audioContext ??= new AudioContext();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

function playTone(
  context: AudioContext,
  frequency: number,
  startsIn: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startsAt = context.currentTime + startsIn;
  const endsAt = startsAt + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startsAt);
  gain.gain.setValueAtTime(0.0001, startsAt);
  gain.gain.exponentialRampToValueAtTime(volume, startsAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startsAt);
  oscillator.stop(endsAt + 0.01);
}

export function playPracticeFeedback(feedback: PracticeFeedback) {
  const context = contextForFeedback();
  if (!context) return;

  if (feedback === "correct") {
    playTone(context, 784, 0, 0.12, 0.1);
    playTone(context, 1174, 0.1, 0.2, 0.08);
    return;
  }

  playTone(context, 220, 0, 0.14, 0.075, "triangle");
  playTone(context, 165, 0.11, 0.2, 0.065, "triangle");
}
