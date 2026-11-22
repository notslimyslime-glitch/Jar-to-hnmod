// Representative Rust emitted by the straight-line JVM integer translator.
pub fn java_example_MathMod_add_2(arg0: i32, arg1: i32) -> i32 {
    (arg0).wrapping_add(arg1)
}

pub fn java_example_MathMod_negate_1(arg0: i32) -> i32 {
    (arg0).wrapping_neg()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn addition_matches_java_i32_overflow() {
        assert_eq!(java_example_MathMod_add_2(i32::MAX, 1), i32::MIN);
    }

    #[test]
    fn negation_matches_java_i32_overflow() {
        assert_eq!(java_example_MathMod_negate_1(i32::MIN), i32::MIN);
    }
}
