package com.aistareco.aep.dto;

/** Platform operators may identify an uncertain submission using supplier evidence; never requests a new generation. */
public record MaterialVideoReconcileRequest(String externalTaskId,String evidence,Boolean confirmedNotAccepted) {
    public MaterialVideoReconcileRequest(String externalTaskId,String evidence){this(externalTaskId,evidence,null);}
}
