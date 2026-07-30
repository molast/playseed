mod engine;
mod game;
mod learning;
mod math;

pub use game::is_correct;
pub use learning::calculate_accuracy;
pub use math::{MathQuestion, generate_math_question, math_question_count};
