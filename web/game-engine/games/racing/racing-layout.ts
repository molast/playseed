export interface RacingChallengeLayout {
  energyPositions: Array<{ xRatio: number; yOffset: number }>;
  obstaclePositions: Array<{ xRatio: number; yOffset: number }>;
  hazardPositions: Array<{ type: "spikes" | "pothole"; xRatio: number; yOffset: number }>;
  minimumEnergyRatio: number;
  safeRatio: number;
}

function shuffle<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function createRacingChallengeLayout(
  optionCount: number,
  correctIndex: number,
  roadWidth: number,
  round: number,
  random: () => number = Math.random,
): RacingChallengeLayout {
  const offsets = shuffle(
    Array.from({ length: optionCount }, (_, index) => (index - (optionCount - 1) / 2) * 64),
    random,
  );
  const minimumEnergyRatio = Math.min(0.28, 90 / Math.max(1, roadWidth));
  let energyRatios: number[] = [];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidates = Array.from({ length: optionCount }, () => 0.12 + random() * 0.76)
      .sort((left, right) => left - right);
    if (candidates.every((value, index) => index === 0 || value - candidates[index - 1] >= minimumEnergyRatio)) {
      energyRatios = shuffle(candidates, random);
      break;
    }
  }
  if (energyRatios.length === 0) {
    energyRatios = shuffle(
      Array.from({ length: optionCount }, (_, index) => 0.14 + (index / Math.max(1, optionCount - 1)) * 0.72),
      random,
    );
  }
  const correctRatio = energyRatios[correctIndex] ?? energyRatios[0];
  const energyPositions = offsets.map((yOffset, index) => ({
    xRatio: energyRatios[index],
    yOffset,
  }));
  const obstacleCount = 1 + Number(round > 1 && random() < 0.45);
  const safeRatio = Math.min(0.3, 86 / Math.max(1, roadWidth));
  const obstaclePositions = Array.from({ length: obstacleCount }, (_, index) => {
    const yOffset = (index === 0 ? 174 : -174) + (random() - 0.5) * 24;
    let xRatio = 0.12 + random() * 0.76;
    for (let attempt = 0; attempt < 12 && Math.abs(xRatio - correctRatio) < safeRatio; attempt += 1) {
      xRatio = 0.12 + random() * 0.76;
    }
    if (Math.abs(xRatio - correctRatio) < safeRatio) xRatio = correctRatio < 0.5 ? 0.84 : 0.16;
    return { xRatio, yOffset };
  });

  const hazardPositions = round > 0 && random() < 0.58
    ? [{
        type: random() < 0.5 ? "spikes" as const : "pothole" as const,
        xRatio: 0,
        yOffset: 350 + (random() - 0.5) * 24,
      }]
    : [];
  for (const hazard of hazardPositions) {
    let xRatio = 0.12 + random() * 0.76;
    const overlapsRoute = (value: number) => Math.abs(value - correctRatio) < safeRatio
      || obstaclePositions.some((obstacle) => Math.abs(value - obstacle.xRatio) < 0.14);
    for (let attempt = 0; attempt < 20 && overlapsRoute(xRatio); attempt += 1) {
      xRatio = 0.12 + random() * 0.76;
    }
    if (overlapsRoute(xRatio)) {
      hazardPositions.length = 0;
      break;
    }
    hazard.xRatio = xRatio;
  }

  return { energyPositions, obstaclePositions, hazardPositions, minimumEnergyRatio, safeRatio };
}
