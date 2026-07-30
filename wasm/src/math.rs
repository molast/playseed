use wasm_bindgen::prelude::*;

#[derive(Clone)]
struct Candidate {
    operation: &'static str,
    strategy: &'static str,
    a: u8,
    b: u8,
    answer: u8,
}

#[wasm_bindgen]
pub struct MathQuestion {
    key: String,
    stage: String,
    operation: String,
    strategy: String,
    a: u8,
    b: u8,
    answer: u8,
    options_csv: String,
    step_one: String,
    step_two: String,
    step_three: String,
}

#[wasm_bindgen]
impl MathQuestion {
    #[wasm_bindgen(getter)]
    pub fn key(&self) -> String {
        self.key.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn stage(&self) -> String {
        self.stage.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn operation(&self) -> String {
        self.operation.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn strategy(&self) -> String {
        self.strategy.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn a(&self) -> u8 {
        self.a
    }

    #[wasm_bindgen(getter)]
    pub fn b(&self) -> u8 {
        self.b
    }

    #[wasm_bindgen(getter)]
    pub fn answer(&self) -> u8 {
        self.answer
    }

    #[wasm_bindgen(getter)]
    pub fn options_csv(&self) -> String {
        self.options_csv.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn step_one(&self) -> String {
        self.step_one.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn step_two(&self) -> String {
        self.step_two.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn step_three(&self) -> String {
        self.step_three.clone()
    }
}

#[wasm_bindgen]
pub fn math_question_count(stage: &str) -> u32 {
    candidates_for(stage).len() as u32
}

#[wasm_bindgen]
pub fn generate_math_question(stage: &str, question_index: u32, session_seed: u32) -> MathQuestion {
    let candidates = candidates_for(stage);
    assert!(!candidates.is_empty(), "unsupported math stage");
    let count = candidates.len() as u32;
    let offset = mix(session_seed ^ 0x9e37_79b9) % count;
    let step = coprime_step(count, mix(session_seed ^ 0x85eb_ca6b));
    let candidate_index = (offset + (question_index % count) * step) % count;
    let candidate = &candidates[candidate_index as usize];
    build_question(
        stage,
        candidate,
        mix(session_seed ^ question_index ^ 0xc2b2_ae35),
    )
}

fn candidates_for(stage: &str) -> Vec<Candidate> {
    match stage {
        "number_recognition" => number_candidates(),
        "within_10_addition" => addition_candidates(10, false, false),
        "within_10_subtraction" => subtraction_candidates(10, false),
        "within_20_no_carry" => addition_candidates(20, false, true),
        "within_20_carry" => addition_candidates(20, true, false),
        "within_20_addition" => all_addition_candidates(20),
        "within_20_subtraction" => all_subtraction_candidates(20),
        "make_ten" => addition_candidates(20, true, false)
            .into_iter()
            .map(|mut item| {
                item.strategy = "make_ten";
                item
            })
            .collect(),
        "within_20_borrowing" => subtraction_candidates(20, true),
        "break_ten" => subtraction_candidates(20, true)
            .into_iter()
            .map(|mut item| {
                item.strategy = "break_ten";
                item
            })
            .collect(),
        "level_ten" => subtraction_candidates(20, true)
            .into_iter()
            .map(|mut item| {
                item.strategy = "level_ten";
                item
            })
            .collect(),
        "mixed" => mixed_candidates(),
        _ => Vec::new(),
    }
}

fn number_candidates() -> Vec<Candidate> {
    let mut result = Vec::new();
    for value in 0..=20 {
        result.push(Candidate {
            operation: "recognition",
            strategy: "quantity",
            a: value,
            b: 0,
            answer: value,
        });
    }
    for a in 0..=20 {
        for b in 0..=20 {
            if a == b {
                continue;
            }
            result.push(Candidate {
                operation: "compare",
                strategy: "compare",
                a,
                b,
                answer: a.max(b),
            });
        }
    }
    for value in 0..20 {
        result.push(Candidate {
            operation: "next",
            strategy: "sequence",
            a: value,
            b: 0,
            answer: value + 1,
        });
    }
    result
}

fn addition_candidates(limit: u8, carry_only: bool, require_teen_operand: bool) -> Vec<Candidate> {
    let mut result = Vec::new();
    for a in 0..=limit {
        for b in 0..=limit {
            let sum = a + b;
            if sum > limit {
                continue;
            }
            let carry = a % 10 + b % 10 >= 10;
            if carry_only && !carry {
                continue;
            }
            if carry_only && (a > 9 || b > 9) {
                continue;
            }
            if !carry_only && carry {
                continue;
            }
            if require_teen_operand && a < 10 && b < 10 {
                continue;
            }
            result.push(Candidate {
                operation: "addition",
                strategy: if carry { "carry" } else { "direct" },
                a,
                b,
                answer: sum,
            });
        }
    }
    result
}

fn subtraction_candidates(limit: u8, borrowing_only: bool) -> Vec<Candidate> {
    let mut result = Vec::new();
    for a in 0..=limit {
        for b in 0..=a {
            let borrowing = (11..=19).contains(&a) && b <= 9 && b > a % 10;
            if borrowing_only && !borrowing {
                continue;
            }
            if !borrowing_only && borrowing {
                continue;
            }
            result.push(Candidate {
                operation: "subtraction",
                strategy: if borrowing { "borrowing" } else { "direct" },
                a,
                b,
                answer: a - b,
            });
        }
    }
    result
}

fn mixed_candidates() -> Vec<Candidate> {
    let mut result = all_addition_candidates(20);
    result.extend(all_subtraction_candidates(20));
    result
}

fn all_addition_candidates(limit: u8) -> Vec<Candidate> {
    let mut result = Vec::new();
    for a in 0..=limit {
        for b in 0..=limit - a {
            result.push(Candidate {
                operation: "addition",
                strategy: if a % 10 + b % 10 >= 10 {
                    "carry"
                } else {
                    "direct"
                },
                a,
                b,
                answer: a + b,
            });
        }
    }
    result
}

fn all_subtraction_candidates(limit: u8) -> Vec<Candidate> {
    let mut result = Vec::new();
    for a in 0..=limit {
        for b in 0..=a {
            result.push(Candidate {
                operation: "subtraction",
                strategy: if b % 10 > a % 10 {
                    "borrowing"
                } else {
                    "direct"
                },
                a,
                b,
                answer: a - b,
            });
        }
    }
    result
}

fn build_question(stage: &str, candidate: &Candidate, seed: u32) -> MathQuestion {
    let (step_one, step_two, step_three) = strategy_steps(candidate);
    let options = answer_options(candidate, seed);
    MathQuestion {
        key: format!("{}:{}:{}", candidate.operation, candidate.a, candidate.b),
        stage: stage.to_string(),
        operation: candidate.operation.to_string(),
        strategy: candidate.strategy.to_string(),
        a: candidate.a,
        b: candidate.b,
        answer: candidate.answer,
        options_csv: options
            .iter()
            .map(u8::to_string)
            .collect::<Vec<_>>()
            .join(","),
        step_one,
        step_two,
        step_three,
    }
}

fn strategy_steps(candidate: &Candidate) -> (String, String, String) {
    match candidate.strategy {
        "make_ten" => {
            let base = candidate.a.max(candidate.b);
            let other = candidate.a.min(candidate.b);
            let needed = 10 - base;
            let remainder = other - needed;
            (
                format!("{} = {} + {}", other, needed, remainder),
                format!("{} + {} = 10", base, needed),
                format!("10 + {} = {}", remainder, candidate.answer),
            )
        }
        "break_ten" => {
            let ones = candidate.a - 10;
            let first = 10 - candidate.b;
            (
                format!("{} = 10 + {}", candidate.a, ones),
                format!("10 - {} = {}", candidate.b, first),
                format!("{} + {} = {}", first, ones, candidate.answer),
            )
        }
        "level_ten" => {
            let to_ten = candidate.a - 10;
            let remainder = candidate.b - to_ten;
            (
                format!("{} = {} + {}", candidate.b, to_ten, remainder),
                format!("{} - {} = 10", candidate.a, to_ten),
                format!("10 - {} = {}", remainder, candidate.answer),
            )
        }
        _ => {
            let symbol = if candidate.operation == "addition" {
                "+"
            } else if candidate.operation == "subtraction" {
                "-"
            } else {
                "→"
            };
            (
                format!(
                    "{} {} {} = {}",
                    candidate.a, symbol, candidate.b, candidate.answer
                ),
                String::new(),
                String::new(),
            )
        }
    }
}

fn answer_options(candidate: &Candidate, seed: u32) -> Vec<u8> {
    let mut values = vec![candidate.answer];
    if candidate.operation == "compare" {
        for value in [candidate.a, candidate.b] {
            if !values.contains(&value) {
                values.push(value);
            }
        }
    }
    let offsets = [-2_i16, -1, 1, 2, -3, 3, -4, 4];
    let start = (mix(seed) as usize) % offsets.len();
    for index in 0..offsets.len() {
        let value = candidate.answer as i16 + offsets[(start + index) % offsets.len()];
        let option_limit = candidate.a.max(candidate.b).max(candidate.answer).max(20) as i16;
        if (0..=option_limit).contains(&value) && !values.contains(&(value as u8)) {
            values.push(value as u8);
        }
        if values.len() == 4 {
            break;
        }
    }
    let mut state = seed;
    for index in (1..values.len()).rev() {
        state = mix(state ^ index as u32);
        values.swap(index, state as usize % (index + 1));
    }
    values
}

fn mix(mut value: u32) -> u32 {
    value ^= value >> 16;
    value = value.wrapping_mul(0x7feb_352d);
    value ^= value >> 15;
    value = value.wrapping_mul(0x846c_a68b);
    value ^ (value >> 16)
}

fn coprime_step(count: u32, seed: u32) -> u32 {
    if count <= 1 {
        return 1;
    }
    let mut step = seed % count;
    if step == 0 {
        step = 1;
    }
    while gcd(step, count) != 1 {
        step = (step + 1) % count;
        if step == 0 {
            step = 1;
        }
    }
    step
}

fn gcd(mut left: u32, mut right: u32) -> u32 {
    while right != 0 {
        let remainder = left % right;
        left = right;
        right = remainder;
    }
    left
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;

    #[test]
    fn every_stage_produces_unique_cycle() {
        let stages = [
            "number_recognition",
            "within_10_addition",
            "within_10_subtraction",
            "within_20_no_carry",
            "within_20_carry",
            "within_20_addition",
            "within_20_subtraction",
            "make_ten",
            "within_20_borrowing",
            "break_ten",
            "level_ten",
            "mixed",
        ];
        for stage in stages {
            let count = math_question_count(stage);
            assert!(count > 0, "{stage}");
            let keys = (0..count)
                .map(|index| generate_math_question(stage, index, 12345).key)
                .collect::<HashSet<_>>();
            assert_eq!(keys.len(), count as usize, "{stage}");
        }
    }

    #[test]
    fn generated_options_are_unique_and_contain_answer() {
        for stage in [
            "number_recognition",
            "within_20_addition",
            "within_20_subtraction",
            "mixed",
        ] {
            for index in 0..math_question_count(stage) {
                let question = generate_math_question(stage, index, 7);
                let options = question.options_csv.split(',').collect::<HashSet<_>>();
                assert_eq!(options.len(), 4, "{}", question.key);
                assert!(options.contains(question.answer.to_string().as_str()));
            }
        }
    }

    #[test]
    fn strategy_steps_match_examples() {
        let make_ten = build_question(
            "make_ten",
            &Candidate {
                operation: "addition",
                strategy: "make_ten",
                a: 8,
                b: 5,
                answer: 13,
            },
            1,
        );
        assert_eq!(make_ten.step_one, "5 = 2 + 3");
        assert_eq!(make_ten.step_three, "10 + 3 = 13");
        let break_ten = build_question(
            "break_ten",
            &Candidate {
                operation: "subtraction",
                strategy: "break_ten",
                a: 13,
                b: 5,
                answer: 8,
            },
            1,
        );
        assert_eq!(break_ten.step_two, "10 - 5 = 5");
        let level_ten = build_question(
            "level_ten",
            &Candidate {
                operation: "subtraction",
                strategy: "level_ten",
                a: 15,
                b: 8,
                answer: 7,
            },
            1,
        );
        assert_eq!(level_ten.step_one, "8 = 5 + 3");
    }
}
