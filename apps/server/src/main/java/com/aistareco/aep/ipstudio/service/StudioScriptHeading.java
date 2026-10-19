package com.aistareco.aep.ipstudio.service;

import org.commonmark.node.AbstractVisitor;
import org.commonmark.node.Code;
import org.commonmark.node.CustomNode;
import org.commonmark.node.Node;
import org.commonmark.node.Text;
import org.commonmark.parser.Parser;
import org.commonmark.parser.delimiter.DelimiterProcessor;
import org.commonmark.parser.delimiter.DelimiterRun;

/** Visible text for the editor's inline heading marks, including escaped literal punctuation. */
final class StudioScriptHeading {
    private StudioScriptHeading() {}
    private static final Parser PARSER = Parser.builder()
            .customDelimiterProcessor(new TransparentMark('+'))
            .customDelimiterProcessor(new TransparentMark('~')).build();

    static String text(String markdown) {
        var text = new StringBuilder();
        PARSER.parse(markdown).accept(new AbstractVisitor() {
            @Override public void visit(Text node) { text.append(node.getLiteral()); }
            @Override public void visit(Code node) { text.append(node.getLiteral()); }
        });
        return text.toString().strip();
    }

    /** Tiptap persists underline as ++ and strikethrough as ~~; both are transparent to identity. */
    private static final class TransparentMark implements DelimiterProcessor {
        private final char delimiter;
        private TransparentMark(char delimiter) { this.delimiter = delimiter; }
        @Override public char getOpeningCharacter() { return delimiter; }
        @Override public char getClosingCharacter() { return delimiter; }
        @Override public int getMinLength() { return 2; }
        @Override public int process(DelimiterRun opening, DelimiterRun closing) {
            if (opening.length() != 2 || closing.length() != 2) return 0;
            var wrapper = new CustomNode() {};
            Node cursor = opening.getOpener().getNext();
            while (cursor != closing.getCloser()) {
                Node next = cursor.getNext();
                wrapper.appendChild(cursor);
                cursor = next;
            }
            opening.getOpener().insertAfter(wrapper);
            return 2;
        }
    }
}
