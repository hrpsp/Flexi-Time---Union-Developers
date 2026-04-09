import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission, json } from "@/lib/with-permission";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AttendanceStatus, LeaveType } from "@prisma/client";

const patchSchema = z.object({
  overriddenStatus: z
    .enum([
      "PRESENT",
      "SHORT_TIME",
      "HALF_DAY",
      "ABSENT",
      "MISSING_IN",
      "MISSING_OUT",
      "LEAVE",
      "UNMARKED",
      "OFF",
    ] as const)
    .nullable()
    .optional(),
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
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Validation failed", issues: parsed.error.issues }, 400);
  }

  const { overriddenStatus, leaveType, note } = parsed.data;

  const existing = await prisma.attendanceRecord.findUnique({
    where: { id: params.id },
  });

  if (!existing) {
    return json({ error: "Record not found" }, 404);
  }

  let updateData: {
    overriddenStatus: AttendanceStatus | null;
    leaveType: LeaveType | null;
    overriddenById: string | null;
    overriddenAt: Date | null;
    note?: string | null;
  };

  if (overriddenStatus === null) {
    // Explicitly clearing the override
    updateData = {
      overriddenStatus: null,
      leaveType: null,
      overriddenById: null,
      overriddenAt: null,
      note: note !== undefined ? note : existing.note,
    };
  } else if (overriddenStatus !== undefined) {
    // Setting a new override
    updateData = {
      overriddenStatus: overriddenStatus as AttendanceStatus,
      leaveType:
        overriddenStatus === "LEAVE"
          ? ((leaveType ?? null) as LeaveType | null)
          : null,
      overriddenById: session?.user?.id ?? null,
      overriddenAt: new Date(),
      note: note !== undefined ? note : existing.note,
    };
  } else {
    // overriddenStatus not provided — only note can be updated
    updateData = {
      overriddenStatus: existing.overriddenStatus,
      leaveType: existing.leaveType,
      overriddenById: existing.overriddenById,
      overriddenAt: existing.overriddenAt,
      note: note !== undefined ? note : existing.note,
    };
  }

  const updatedRecord = await prisma.attendanceRecord.update({
    where: { id: params.id },
    data: updateData,
  });

  await prisma.auditLog.create({
    data: {
      userId: session?.user?.id ?? "",
      action: "ATTENDANCE_OVERRIDE",
      entityType: "AttendanceRecord",
      entityId: params.id,
      before: { overriddenStatus: existing.overriddenStatus },
      after: { overriddenStatus: updatedRecord.overriddenStatus },
    },
  });

  const effectiveStatus: AttendanceStatus =
    updatedRecord.overriddenStatus ?? updatedRecord.calculatedStatus;
  const isOverridden = !!updatedRecord.overriddenStatus;

  const date =
    updatedRecord.date instanceof Date
      ? updatedRecord.date.toISOString().slice(0, 10)
      : String(updatedRecord.date).slice(0, 10);

  return json({
    record: {
      ...updatedRecord,
      date,
      effectiveStatus,
      isOverridden,
    },
  });
}
