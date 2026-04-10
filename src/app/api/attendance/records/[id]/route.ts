import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission, json } from "@/lib/with-permission";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AttendanceStatus, LeaveType } from "@prisma/client";

// HH:MM or HH:MM:SS validation
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

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
  // Manual time overrides
  inTime: z.string().regex(timeRegex, "Must be HH:MM").nullable().optional(),
  outTime: z.string().regex(timeRegex, "Must be HH:MM").nullable().optional(),
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

  const { overriddenStatus, leaveType, note, inTime, outTime } = parsed.data;

  const existing = await prisma.attendanceRecord.findUnique({
    where: { id: params.id },
  });
  if (!existing) {
    return json({ error: "Record not found" }, 404);
  }

  // Recompute worked minutes if times are being updated
  const resolvedIn  = inTime  !== undefined ? inTime  : existing.inTime;
  const resolvedOut = outTime !== undefined ? outTime : existing.outTime;
  let workedMinutes: number | null = existing.workedMinutes;

  if (resolvedIn && resolvedOut) {
    const [inH, inM]   = resolvedIn.split(":").map(Number);
    const [outH, outM] = resolvedOut.split(":").map(Number);
    const diff = (outH * 60 + outM) - (inH * 60 + inM);
    workedMinutes = diff > 0 ? diff : null;
  } else if (inTime !== undefined || outTime !== undefined) {
    workedMinutes = null;
  }

  let updateData: Record<string, unknown>;

  if (overriddenStatus === null) {
    updateData = {
      overriddenStatus: null,
      leaveType: null,
      overriddenById: null,
      overriddenAt: null,
      note: note !== undefined ? note : existing.note,
      inTime: inTime !== undefined ? inTime : existing.inTime,
      outTime: outTime !== undefined ? outTime : existing.outTime,
      workedMinutes,
    };
  } else if (overriddenStatus !== undefined) {
    updateData = {
      overriddenStatus: overriddenStatus as AttendanceStatus,
      leaveType:
        overriddenStatus === "LEAVE"
          ? ((leaveType ?? null) as LeaveType | null)
          : null,
      overriddenById: session?.user?.id ?? null,
      overriddenAt: new Date(),
      note: note !== undefined ? note : existing.note,
      inTime: inTime !== undefined ? inTime : existing.inTime,
      outTime: outTime !== undefined ? outTime : existing.outTime,
      workedMinutes,
    };
  } else {
    updateData = {
      overriddenStatus: existing.overriddenStatus,
      leaveType: existing.leaveType,
      overriddenById: existing.overriddenById,
      overriddenAt: existing.overriddenAt,
      note: note !== undefined ? note : existing.note,
      inTime: inTime !== undefined ? inTime : existing.inTime,
      outTime: outTime !== undefined ? outTime : existing.outTime,
      workedMinutes,
    };
  }

  const updatedRecord = await prisma.attendanceRecord.update({
    where: { id: params.id },
    data: updateData as Parameters<typeof prisma.attendanceRecord.update>[0]["data"],
  });

  await prisma.auditLog.create({
    data: {
      userId: session?.user?.id ?? "",
      action: "ATTENDANCE_OVERRIDE",
      entityType: "AttendanceRecord",
      entityId: params.id,
      before: {
        overriddenStatus: existing.overriddenStatus,
        inTime: existing.inTime,
        outTime: existing.outTime,
      },
      after: {
        overriddenStatus: updatedRecord.overriddenStatus,
        inTime: updatedRecord.inTime,
        outTime: updatedRecord.outTime,
      },
    },
  });

  const effectiveStatus: AttendanceStatus =
    updatedRecord.overriddenStatus ?? updatedRecord.calculatedStatus;
  const isOverridden =
    !!updatedRecord.overriddenStatus ||
    updatedRecord.inTime !== existing.inTime ||
    updatedRecord.outTime !== existing.outTime;

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
