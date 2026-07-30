use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn calculate_accuracy(correct: u32, total: u32) -> u32 {
    if total == 0 {
        return 0;
    }

    ((correct as f64 / total as f64) * 100.0).round() as u32
}

#[cfg(test)]
mod tests {
    #[test]
    fn calculates_rounded_accuracy() {
        assert_eq!(super::calculate_accuracy(2, 3), 67);
        assert_eq!(super::calculate_accuracy(0, 0), 0);
    }
}
