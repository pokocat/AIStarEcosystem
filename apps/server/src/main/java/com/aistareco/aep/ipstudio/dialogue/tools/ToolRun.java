package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.dialogue.DialogueLoop;
import java.util.List;

/**
 * Result of one tool run.
 *
 * @param status        done | failed | running (running: a native child continues in the background)
 * @param summary       user-facing card summary
 * @param forModel      JSON text fed back to the model (safe: no keys or signed URLs)
 * @param creditsActual real settled credits of the child run; null while settling or when not applicable
 * @param settling      true while the cost is not settled yet (e.g. counted in this turn's own billing)
 * @param end           set when the turn must stop after this tool (waiting_user / handed_off / completed)
 */
public record ToolRun(String status, String summary, String forModel, List<String> nodeIds, List<String> storageKeys,
                      String childRunId, Long creditsActual, boolean settling, String errorCode, String errorMessage,
                      DialogueLoop.Reason end) {
    public static ToolRun done(String summary, String forModel) { return new ToolRun("done", summary, forModel, List.of(), List.of(), null, 0L, false, null, null, null); }
    public static ToolRun failed(String code, String message, String forModel) { return new ToolRun("failed", message, forModel, List.of(), List.of(), null, 0L, false, code, message, null); }
    public ToolRun withEnd(DialogueLoop.Reason reason) { return new ToolRun(status, summary, forModel, nodeIds, storageKeys, childRunId, creditsActual, settling, errorCode, errorMessage, reason); }
    public ToolRun withNodes(List<String> ids) { return new ToolRun(status, summary, forModel, ids, storageKeys, childRunId, creditsActual, settling, errorCode, errorMessage, end); }
    public ToolRun settlingInTurn() { return new ToolRun(status, summary, forModel, nodeIds, storageKeys, childRunId, null, true, errorCode, errorMessage, end); }
}
