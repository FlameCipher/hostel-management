import { roundCurrency } from "./currency";

export type FinancialAuditFinding = {
  code: string;
  severity: "critical" | "review" | "information";
  title: string;
  detail: string;
};

export type FinancialAuditPayment = {
  amount: number;
  currency: string;
  studentId: string;
  organizationId: string;
};

export type FinancialAuditCharge = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  roomTypeId: string | null;
  payments: FinancialAuditPayment[];
  adjustments: { reason: string; calculationMethod: string }[];
};

export type FinancialAuditStay = {
  roomId: string;
  roomNumber: string;
  startDate: Date;
  endDate: Date | null;
  monthlyRate: number;
  semesterRate: number;
};

export type FinancialAuditOccupancy = {
  id: string;
  organizationId: string;
  studentId: string;
  studentName: string;
  roomId: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  monthlyRate: number;
  semesterRate: number;
  stays: FinancialAuditStay[];
  charges: FinancialAuditCharge[];
};

/** Strictly read-only triage. A different current tariff is not a proven
 * overcharge: owner-negotiated agreements can override the price list.
 * Never use these findings to mutate a ledger automatically.
 */
export function auditActiveOccupancy(row: FinancialAuditOccupancy): FinancialAuditFinding[] {
  const findings: FinancialAuditFinding[] = [];
  const flag = (code: string, severity: FinancialAuditFinding["severity"], title: string, detail: string) => {
    findings.push({code, severity, title, detail});
  };
  if (row.charges.length === 0) {
    flag("RENT_CHARGE_MISSING", "critical", "Missing semester rent", "No semester-rent charge is linked to this active occupancy.");
  } else if (row.charges.length > 1) {
    flag("RENT_CHARGE_DUPLICATE", "critical", "Multiple semester rent charges", "More than one semester-rent charge is linked to this active occupancy.");
  }

  const stays = [...row.stays].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  if (!stays.length) {
    flag("ROOM_HISTORY_MISSING", "review", "Missing room history", "A room-stay rate snapshot is needed before transfer billing can be reviewed.");
  } else {
    const active = stays.filter((stay) => stay.endDate === null);
    if (active.length !== 1 || active[0]?.roomId !== row.roomId) {
      flag("ROOM_HISTORY_ACTIVE_MISMATCH", "review", "Room stay and allocation differ", "The open room-stay record does not match the current room.");
    }
    if (stays.some((stay) => !Number.isFinite(stay.startDate.getTime()) ||
      (stay.endDate !== null && (Number.isNaN(stay.endDate.getTime()) || stay.endDate <= stay.startDate)))) {
      flag("ROOM_HISTORY_INVALID", "review", "Invalid stay dates", "A room-stay date range is incomplete or invalid.");
    }
    if (stays.some((stay, index) => index > 0 &&
      stays[index - 1].endDate?.getTime() !== stay.startDate.getTime())) {
      flag("ROOM_HISTORY_GAP", "review", "Room history gap or overlap", "Adjacent room stays do not meet at the same recorded transfer instant.");
    }
  }

  for (const charge of row.charges) {
    const paid = roundCurrency(charge.payments.reduce((sum, p) => sum + p.amount, 0), charge.currency);
    if (!Number.isFinite(charge.amount) || charge.amount <= 0) {
      flag("INVALID_RENT_AMOUNT", "critical", "Invalid semester rent amount", "The linked charge does not have a positive valid amount.");
    } else if (paid > charge.amount) {
      flag("RENT_OVERPAID", "critical", "Payments exceed rent charge", "Recorded active payments exceed the rent charge; investigate the credit or agreement.");
    }
    if (charge.status === "FULLY_PAID" && paid < charge.amount) {
      flag("RENT_STATUS_INCONSISTENT", "review", "Incorrect paid status", "The charge is marked fully paid despite a calculated outstanding balance.");
    } else if (charge.status === "PARTIALLY_PAID" && (paid <= 0 || paid >= charge.amount)) {
      flag("RENT_STATUS_INCONSISTENT", "review", "Incorrect partial-payment status", "The charge's payment status and live payment sum do not agree.");
    }

    if (charge.roomTypeId !== row.roomTypeId) {
      flag("RENT_ROOM_TYPE_MISMATCH", "review", "Rent charge has a different room type",
        "Current room: " + row.roomNumber + " (" + row.roomTypeName + "); its charge still points to another accommodation type.");
    }

    const descriptionRoom = charge.description.match(/\bRoom\s+([A-Za-z0-9-]+)/i)?.[1];
    if (descriptionRoom && descriptionRoom.toLocaleLowerCase() !== row.roomNumber.toLocaleLowerCase()) {
      flag("RENT_OLD_ROOM_LABEL", "information", "Charge description still names an old room",
        "The current room is " + row.roomNumber + ", but the charge description begins with Room " + descriptionRoom + ".");
    }

    if (charge.payments.some((p) =>
      p.studentId !== row.studentId || p.organizationId !== row.organizationId || p.currency !== charge.currency || p.amount <= 0)) {
      flag("RENT_PAYMENT_LINKAGE", "critical", "Payment or currency link needs review", "One or more active payments do not match the correct student, hostel, currency or positive amount.");
    }

    const priorRates = new Set(stays.map((stay) => stay.semesterRate));
    const rateChanged = stays.length > 1 && priorRates.size > 1;
    if (rateChanged && charge.adjustments.length === 0) {
      flag("TRANSFER_RATE_UNREVIEWED", "review", "Transferred to a different price without an adjustment",
        "Room rates changed during the semester but no audited rent adjustment is recorded. Confirm the applicable agreement before calculating any difference.");
    }
  }

  return findings;
}

export function financialAuditSummary(
  rows: readonly {findings: FinancialAuditFinding[]}[],
) {
  return {
    occupancies: rows.length,
    needingReview: rows.filter((row) => row.findings.some((f) => f.severity !== "information")).length,
    critical: rows.reduce((sum, row) => sum + row.findings.filter((f) => f.severity === "critical").length, 0),
    review: rows.reduce((sum, row) => sum + row.findings.filter((f) => f.severity === "review").length, 0),
    informational: rows.reduce((sum, row) => sum + row.findings.filter((f) => f.severity === "information").length, 0),
  };
}
