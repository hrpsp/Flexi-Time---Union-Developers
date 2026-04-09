import { PrismaClient, Role } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────────────────
// DEPARTMENTS  (28 departments — codes match the original attendance tool)
// ─────────────────────────────────────────────────────────────────────────────
const DEPARTMENTS = [
  { code: 10, name: "Accounts & Finance" },
  { code: 11, name: "Administration" },
  { code: 12, name: "Architecture" },
  { code: 13, name: "Call Center" },
  { code: 14, name: "Customer Facilitation" },
  { code: 15, name: "Execution" },
  { code: 16, name: "Horticulture" },
  { code: 17, name: "Human Resource" },
  { code: 18, name: "Information Technology" },
  { code: 19, name: "Internal Audit" },
  { code: 20, name: "Land Revenue" },
  { code: 21, name: "Legal Affairs" },
  { code: 22, name: "Management" },
  { code: 23, name: "Marketing" },
  { code: 24, name: "MEP" },
  { code: 25, name: "Operations" },
  { code: 26, name: "Procurement" },
  { code: 27, name: "Project Management" },
  { code: 28, name: "QHSE" },
  { code: 29, name: "QRF & Vigilance" },
  { code: 30, name: "QS & Billing" },
  { code: 31, name: "REC Network" },
  { code: 33, name: "Sales" },
  { code: 34, name: "Security" },
  { code: 35, name: "Store" },
  { code: 36, name: "Surveillance" },
  { code: 37, name: "Survey" },
  { code: 38, name: "Town Planning" },
]

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🌱  Starting seed…\n")

  // ── 1. Super Admin ─────────────────────────────────────────────────────────
  const adminEmail = "admin@flexitime.com"
  const existing   = await prisma.user.findUnique({ where: { email: adminEmail } })

  if (existing) {
    console.log(`  ⏭  Super Admin already exists — skipping (${adminEmail})`)
  } else {
    const hash = await bcrypt.hash("Admin@123", 12)
    await prisma.user.create({
      data: {
        email:        adminEmail,
        passwordHash: hash,
        name:         "System Admin",
        role:         Role.SUPER_ADMIN,
        isActive:     true,
      },
    })
    console.log(`  ✔  Super Admin created`)
    console.log(`     Email:    ${adminEmail}`)
    console.log(`     Password: Admin@123`)
  }

  // ── 2. Departments ─────────────────────────────────────────────────────────
  console.log("\n  Upserting departments…")
  let deptCreated = 0
  let deptUpdated = 0

  for (const dept of DEPARTMENTS) {
    const result = await prisma.department.upsert({
      where:  { code: dept.code },
      update: { name: dept.name, isActive: true },
      create: { code: dept.code, name: dept.name, isActive: true },
    })
    // Prisma upsert always returns the record; we track by checking if createdAt ≈ updatedAt
    const isNew = Math.abs(result.createdAt.getTime() - Date.now()) < 3000
    if (isNew) deptCreated++; else deptUpdated++

    console.log(`     [${String(dept.code).padStart(2, " ")}]  ${dept.name}`)
  }

  // ── 3. Default Shift Config ────────────────────────────────────────────────
  console.log("\n  Upserting default shift config…")
  const shift = await prisma.shiftConfig.findFirst({ where: { isDefault: true } })

  if (shift) {
    console.log("  ⏭  Default shift already exists — skipping")
  } else {
    await prisma.shiftConfig.create({
      data: {
        name:           "Standard Shift",
        startTime:      "10:00",
        endTime:        "18:00",
        graceMinutes:   15,
        presentMinutes: 465,   // 7h 45m
        shortTimeMin:   391,   // 6h 31m
        halfDayMin:     240,   // 4h 00m
        isDefault:      true,
      },
    })
    console.log("  ✔  Default shift: 10:00–18:00, 15 min grace")
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const [userCount, deptCount, shiftCount] = await Promise.all([
    prisma.user.count(),
    prisma.department.count(),
    prisma.shiftConfig.count(),
  ])

  console.log("\n  ─────────────────────────────────────")
  console.log("  📊  Database totals after seed:")
  console.log(`      Users:       ${userCount}`)
  console.log(`      Departments: ${deptCount}`)
  console.log(`      Shifts:      ${shiftCount}`)
  console.log("  ─────────────────────────────────────")
  console.log("\n✅  Seed complete!\n")
  console.log("  ⚠  Change the admin password after first login.\n")
}

main()
  .catch((e) => {
    console.error("\n❌  Seed failed:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
