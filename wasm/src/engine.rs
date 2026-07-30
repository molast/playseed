pub(crate) fn normalize_answer(value: &str) -> String {
    value.trim().to_lowercase().replace(char::is_whitespace, "")
}

#[cfg(test)]
mod tests {
    #[test]
    fn normalizes_case_and_spacing() {
        assert_eq!(super::normalize_answer(" A p p l e "), "apple");
    }
}
