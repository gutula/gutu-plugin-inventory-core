import React from "react";

import {
  getBusinessOverview,
  listExceptionRecords,
  listPendingDownstreamItems,
  listPrimaryRecords
} from "../../services/main.service";

export async function BusinessAdminPage() {
  const overview = await getBusinessOverview();
  const primaryRecords = (await listPrimaryRecords()).slice(0, 4);
  const exceptions = (await listExceptionRecords()).slice(0, 4);
  const pendingDownstream = (await listPendingDownstreamItems()).slice(0, 4);

  return React.createElement(
    "section",
    null,
    React.createElement("h1", null, "Inventory Control Room"),
    React.createElement("p", null, "Stock truth, reservation state, transfers, and reconciliation queues for physical inventory operations."),
    React.createElement(
      "p",
      null,
      `${overview.totals.primaryRecords} records, ${overview.totals.pendingApproval} pending approval, ${overview.orchestration.inbox.pending + overview.orchestration.inbox.retrying} pending downstream actions, and ${overview.totals.openExceptions} open exceptions.`
    ),
    React.createElement("h2", null, "Primary Records"),
    React.createElement(
      "ul",
      null,
      ...primaryRecords.map((entry) =>
        React.createElement(
          "li",
          { key: entry.id },
          `${entry.title} - ${entry.recordState} - ${entry.approvalState} - ${entry.fulfillmentState}`
        )
      )
    ),
    React.createElement("h2", null, "Open Exceptions"),
    React.createElement(
      "ul",
      null,
      ...exceptions.map((entry) =>
        React.createElement("li", { key: entry.id }, `${entry.reasonCode} - ${entry.severity} - ${entry.status}`)
      )
    ),
    React.createElement("h2", null, "Pending Downstream Actions"),
    React.createElement(
      "ul",
      null,
      ...pendingDownstream.map((entry) =>
        React.createElement("li", { key: entry.id }, `${entry.target} - ${entry.status} - attempts ${entry.attemptCount}`)
      )
    )
  );
}
