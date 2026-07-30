/* tslint:disable */
/* eslint-disable */

export class MathQuestion {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly a: number;
    readonly answer: number;
    readonly b: number;
    readonly key: string;
    readonly operation: string;
    readonly options_csv: string;
    readonly stage: string;
    readonly step_one: string;
    readonly step_three: string;
    readonly step_two: string;
    readonly strategy: string;
}

export function calculate_accuracy(correct: number, total: number): number;

export function generate_math_question(stage: string, question_index: number, session_seed: number): MathQuestion;

export function is_correct(given: string, expected: string): boolean;

export function math_question_count(stage: string): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_mathquestion_free: (a: number, b: number) => void;
    readonly generate_math_question: (a: number, b: number, c: number, d: number) => number;
    readonly math_question_count: (a: number, b: number) => number;
    readonly mathquestion_a: (a: number) => number;
    readonly mathquestion_answer: (a: number) => number;
    readonly mathquestion_b: (a: number) => number;
    readonly mathquestion_key: (a: number) => [number, number];
    readonly mathquestion_operation: (a: number) => [number, number];
    readonly mathquestion_options_csv: (a: number) => [number, number];
    readonly mathquestion_stage: (a: number) => [number, number];
    readonly mathquestion_step_one: (a: number) => [number, number];
    readonly mathquestion_step_three: (a: number) => [number, number];
    readonly mathquestion_step_two: (a: number) => [number, number];
    readonly mathquestion_strategy: (a: number) => [number, number];
    readonly calculate_accuracy: (a: number, b: number) => number;
    readonly is_correct: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
