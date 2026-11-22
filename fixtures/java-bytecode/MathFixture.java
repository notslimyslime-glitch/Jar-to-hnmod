package fixture;

public final class MathFixture {
    private MathFixture() {}

    public static int add(int left, int right) {
        return left + right;
    }

    public static int subtractTwelve(int value) {
        return value - 12;
    }
}
