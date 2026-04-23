import {
  advancePrimaryRecord,
  createPrimaryRecord,
  reconcilePrimaryRecord,
  type AdvancePrimaryRecordInput,
  type CreatePrimaryRecordInput,
  type ReconcilePrimaryRecordInput
} from "../services/main.service";

export const businessFlowDefinitions = [
  {
    "id": "inventory.receipts.record",
    "label": "Record Inventory Receipt",
    "phase": "create",
    "methodName": "recordInventoryReceipt"
  },
  {
    "id": "inventory.reservations.allocate",
    "label": "Allocate Reservation",
    "phase": "advance",
    "methodName": "allocateReservation"
  },
  {
    "id": "inventory.transfers.request",
    "label": "Request Stock Transfer",
    "phase": "reconcile",
    "methodName": "requestStockTransfer"
  }
] as const;

export async function recordInventoryReceipt(input: CreatePrimaryRecordInput) {
  return createPrimaryRecord(input);
}

export async function allocateReservation(input: AdvancePrimaryRecordInput) {
  return advancePrimaryRecord(input);
}

export async function requestStockTransfer(input: ReconcilePrimaryRecordInput) {
  return reconcilePrimaryRecord(input);
}
