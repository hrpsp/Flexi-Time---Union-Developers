import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission, json } from "@/lib/with-permission";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AttendanceStatus, LeaveType } from "@prisma/client";

const bulkOverrideSchema = z.object({
  employeeIds: z.array(z.string()).min(1),
  status: z.enum([
    "PRESENT",
    "SHORT_TIME",
    "HALF_DAY",
    "ABSENT",
    "MISSING_IN",
    "MISSING_OUT",
    "LEAVE",
    "UNMARKED",
    "OFF",
  ] as const),
  leaveType: z
    .enum([
      "ANNUAL",
      "SICK",
      "CASUAL",
      "EMERGENCY",
      "UNPAID",
      "WORK_FROM_HOME",
    ] as const)
    .nullable()
    .optional(),
  note: z.string().max(500).nullable().optional(),
  scope: z.enum(["unmarked", "all"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { periodId: string } }
) {
  const guard = await withPermission("attendance:override");
  if (guard) return guard;

  const session = await auth();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = bulkOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Validation failed", issues: parsed.error.issues }, 400);
  }

  const { employeeIds, status, leaveType, note, scope } = parsed.data;

  const period = await prisma.attendancePeriod.findUnique({
    where: { id: params.periodId },
  });

  if (!period) {
    return json({ error: "Period not found" }, 404);
  }

  const where: {
    periodId: string;
    employeeId: { in: string[] };
    overriddenStatus?: null;
    calculatedStatus?: AttendanceStatus;
  } = {
    periodId: params.periodId,
    employeeId: { in: employeeIds },
  };

  if (scope === "unmarked") {
    where.overriddenStatus = null;
    where.calculatedStatus = "UNMARKED" as AttendanceStatus;
  }

  const result = await prisma.attendanceRecord.updateMany({
    where,
    data: {
      overriddenStatus: status as AttendanceStatus,
      leaveType:
        status === "LEAVE"
          ? ((leaveType ?? null) as LeaveType | null)
          : null,
      note: note ?? null,
      overriddenById: session?.user?.id ?? null,
      overriddenAt: new Date(),
    },
  });

  return json({ count: result.count });
}
