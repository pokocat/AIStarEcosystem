package com.aistareco.aep.ipstudio.dialogue.tools;

/** Live updates of one running tool card. Every update is persisted on the message before it is broadcast. */
public interface ToolHandle {
    String toolCallId();
    /** Real stage or verified observation only; never invented percentages. */
    void progress(String text);
    /** Bind the native child run this tool created. */
    void childRun(String runId);
}
