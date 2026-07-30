use wasm_bindgen::prelude::*;

use crate::engine::normalize_answer;

#[wasm_bindgen]
pub fn is_correct(given: &str, expected: &str) -> bool {
    normalize_answer(given) == normalize_answer(expected)
}

#[cfg(test)]
mod tests {
    #[test]
    fn compares_normalized_answers() {
        assert!(super::is_correct(" A p p l e ", "apple"));
        assert!(!super::is_correct("apple", "banana"));
    }
}
