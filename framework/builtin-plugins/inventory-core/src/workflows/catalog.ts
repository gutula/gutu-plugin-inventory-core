import { defineWorkflow } from "@platform/jobs";

export const workflowDefinitionKeys = ["inventory-movement-lifecycle"] as const;

export const workflowDefinitions = {
  "inventory-movement-lifecycle": defineWorkflow({
    id: "inventory-movement-lifecycle",
    description: "Request, approve, execute, reconcile, and close stock movement state.",
    businessPurpose: "Keep physical movement, reservation, and reconciliation logic explicit through partial and discrepancy-heavy flows.",
    actors: ["warehouse","approver","controller"],
    invariants: [
      "Multi-axis business states must stay explicit on every record.",
      "Cross-plugin work must be requested through traceable downstream actions instead of hidden direct writes."
    ],
    mandatorySteps: [
      "Draft records must be submitted before approval or downstream action occurs.",
      "Corrections must happen through explicit follow-up or reconciliation activity rather than destructive mutation."
    ],
    stateDescriptions: {
      draft: { description: "The business record exists but is not yet active." },
      pending_approval: { description: "The record is waiting for approval or policy review." },
      active: { description: "The record is active and can drive downstream requests." },
      reconciled: { description: "Downstream effects have been reviewed and reconciled." },
      closed: { description: "The lifecycle is complete and the record is closed." },
      canceled: { description: "The lifecycle ended through cancellation or reversal." }
    },
    transitionDescriptions: {
      "draft.submit": "Submits the record for review or governance checks.",
      "pending_approval.approve": "Approves the record and makes it active.",
      "active.reconcile": "Moves the record into explicit reconciliation or downstream review.",
      "reconciled.close": "Closes the record once downstream work is complete.",
      "pending_approval.reject": "Rejects the record and closes the current cycle.",
      "active.cancel": "Cancels the active record with a controlled reason."
    },
    initialState: "draft",
    states: {
      draft: { on: { submit: "pending_approval" } },
      pending_approval: { on: { approve: "active", reject: "canceled" } },
      active: { on: { reconcile: "reconciled", cancel: "canceled" } },
      reconciled: { on: { close: "closed" } },
      closed: {},
      canceled: {}
    }
  })
} as const;
