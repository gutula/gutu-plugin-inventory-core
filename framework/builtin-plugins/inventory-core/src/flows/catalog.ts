import {
  advancePrimaryRecord,
  amendPrimaryRecord,
  createPrimaryRecord,
  placePrimaryRecordOnHold,
  reconcilePrimaryRecord,
  releasePrimaryRecordHold,
  reversePrimaryRecord,
  type AdvancePrimaryRecordInput,
  type AmendPrimaryRecordInput,
  type CreatePrimaryRecordInput,
  type PlacePrimaryRecordOnHoldInput,
  type ReconcilePrimaryRecordInput,
  type ReleasePrimaryRecordHoldInput,
  type ReversePrimaryRecordInput
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
  },
  {
    "id": "inventory.receipts.hold",
    "label": "Place Record On Hold",
    "phase": "hold",
    "methodName": "placeRecordOnHold"
  },
  {
    "id": "inventory.receipts.release",
    "label": "Release Record Hold",
    "phase": "release",
    "methodName": "releaseRecordHold"
  },
  {
    "id": "inventory.receipts.amend",
    "label": "Amend Record",
    "phase": "amend",
    "methodName": "amendRecord"
  },
  {
    "id": "inventory.receipts.reverse",
    "label": "Reverse Record",
    "phase": "reverse",
    "methodName": "reverseRecord"
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

export async function placeRecordOnHold(input: PlacePrimaryRecordOnHoldInput) {
  return placePrimaryRecordOnHold(input);
}

export async function releaseRecordHold(input: ReleasePrimaryRecordHoldInput) {
  return releasePrimaryRecordHold(input);
}

export async function amendRecord(input: AmendPrimaryRecordInput) {
  return amendPrimaryRecord(input);
}

export async function reverseRecord(input: ReversePrimaryRecordInput) {
  return reversePrimaryRecord(input);
}
