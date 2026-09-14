import { BatchStudentPropertyForm } from "@/components/batch-student-property-form";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function NewStudentPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{
    occupancyId?: string;
  }>;
}) {
  const session = await requireSession();
  const query = await searchParams;

  const occupancies = await db.occupancy.findMany({
    where: {
      organizationId: session.organizationId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      student: {
        select: {
          fullName: true,
          phone: true,
          admissionNumber: true,
        },
      },
      room: {
        select: {
          number: true,
          floor: true,
        },
      },
    },
    orderBy: {
      student: {
        fullName: "asc",
      },
    },
  });

  const occupancyOptions = occupancies.map((occupancy) => {
    const floor = occupancy.room.floor
      ? ` · ${occupancy.room.floor}`
      : "";

    const admission = occupancy.student.admissionNumber
      ? ` · ${occupancy.student.admissionNumber}`
      : "";

    return {
      id: occupancy.id,
      label:
        `${occupancy.student.fullName} · Room ${occupancy.room.number}` +
        `${floor}${admission} · ${occupancy.student.phone}`,
    };
  });

  return (
    <div className="form-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Student property</p>
          <h1>Register student property</h1>
          <p>
            Record all property belonging to a student in one intake.
          </p>
        </div>
      </div>

      <BatchStudentPropertyForm
        defaultOccupancyId={query.occupancyId ?? ""}
        occupancies={occupancyOptions}
      />
    </div>
  );
}