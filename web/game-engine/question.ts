export interface GameQuestionOption {
  id: string;
  label: string;
}

export interface GameQuestion {
  id: string;
  prompt: string;
  answerId: string;
  speechText: string;
  audioUrl?: string;
  options: GameQuestionOption[];
}

export interface QuestionProvider {
  next(round: number): GameQuestion;
  reset?(): void;
}
