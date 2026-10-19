package com.aistareco.aep.ipstudio.skill;

import java.util.Map;

/**
 * Integer arithmetic for skill limit expressions such as {@code "maxSegments * 3 + 4"}.
 *
 * <p>Deliberately tiny: integers, named numeric limits, {@code + - * /} and parentheses. No functions, no other
 * identifiers, no floating point. Anything else is a malformed skill header and rejects the whole file.
 */
final class StudioSkillExpression {
    private final String text;
    private final Map<String, Integer> variables;
    private int pos;

    private StudioSkillExpression(String text, Map<String, Integer> variables) { this.text = text; this.variables = variables; }

    static int evaluate(String text, Map<String, Integer> variables) {
        if (text == null || text.isBlank() || text.length() > 120) throw new IllegalArgumentException("empty expression");
        var parser = new StudioSkillExpression(text, variables);
        long value = parser.sum();
        parser.skipSpaces();
        if (parser.pos != text.length()) throw new IllegalArgumentException("unexpected '" + text.charAt(parser.pos) + "'");
        if (value < Integer.MIN_VALUE || value > Integer.MAX_VALUE) throw new IllegalArgumentException("out of range");
        return (int) value;
    }

    private long sum() {
        long value = product();
        while (true) {
            skipSpaces();
            if (peek('+')) { pos++; value = Math.addExact(value, product()); }
            else if (peek('-')) { pos++; value = Math.subtractExact(value, product()); }
            else return value;
        }
    }

    private long product() {
        long value = factor();
        while (true) {
            skipSpaces();
            if (peek('*')) { pos++; value = Math.multiplyExact(value, factor()); }
            else if (peek('/')) {
                pos++;
                long divisor = factor();
                if (divisor == 0) throw new IllegalArgumentException("division by zero");
                value = Math.floorDiv(value, divisor);
            } else return value;
        }
    }

    private long factor() {
        skipSpaces();
        if (pos >= text.length()) throw new IllegalArgumentException("unexpected end");
        char c = text.charAt(pos);
        if (c == '(') {
            pos++;
            long value = sum();
            skipSpaces();
            if (!peek(')')) throw new IllegalArgumentException("missing ')'");
            pos++;
            return value;
        }
        if (c == '-') { pos++; return Math.negateExact(factor()); }
        if (Character.isDigit(c)) {
            int start = pos;
            while (pos < text.length() && Character.isDigit(text.charAt(pos))) pos++;
            if (pos - start > 6) throw new IllegalArgumentException("number too long");
            return Long.parseLong(text.substring(start, pos));
        }
        if (Character.isLetter(c)) {
            int start = pos;
            while (pos < text.length() && Character.isLetterOrDigit(text.charAt(pos))) pos++;
            String name = text.substring(start, pos);
            Integer value = variables.get(name);
            if (value == null) throw new IllegalArgumentException("unknown limit '" + name + "'");
            return value;
        }
        throw new IllegalArgumentException("unexpected '" + c + "'");
    }

    private boolean peek(char c) { return pos < text.length() && text.charAt(pos) == c; }
    private void skipSpaces() { while (pos < text.length() && Character.isWhitespace(text.charAt(pos))) pos++; }
}
