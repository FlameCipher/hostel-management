import type { StudentStatus } from "@/generated/prisma/enums";

export const studentStatusLabels: Record<StudentStatus, string> = {
  ACTIVE: "Active",
  CHECKED_OUT: "Checked out",
  SUSPENDED: "Suspended",
  ARCHIVED: "Archived",
};

export const studentStatusTone: Record<StudentStatus, string> = {
  ACTIVE: "status-full",
  CHECKED_OUT: "status-inactive",
  SUSPENDED: "status-maintenance",
  ARCHIVED: "status-inactive",
};
