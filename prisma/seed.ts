import { PrismaClient, Role } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

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

async function main() {
  console.log("🌱 Seeding database…")

  // ── 1. Admin user ─────────────────────────────────────────────────────────
  const adminEmail = "admin@uniondev.com"
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } })

  if (!existing) {
    const hash = await bcrypt.hash("Admin@1234", 12)
    await prisma.user.create({
      data: {
        email:        adminEmail,
        passwordHash: hash,
        name:         "System Admin",
        role:         Role.ADMIN,
      },
    })
    console.log(`  ✔ Admin user created: ${adminEmail} / Admin@1234`)
  } else {
    console.log(`  – Admin user already exists (${adminEmail}), skipping.`)
  }

  // ── 2. Departments ────────────────────────────────────────────────────────
  let created = 0
  let skipped = 0

  for (const dept of DEPARTMENTS) {
    const result = await prisma.department.upsert({
      where:  { code: dept.code },
      update: { name: dept.name },
      create: { code: dept.code, name: dept.name },
    })
    result ? created++ : skipped++
  }
  console.log(`  ✔ Departments upserted: ${DEPARTMENTS.length}`)

  // ── 3. Active attendance period ───────────────────────────────────────────
  const period = await prisma.attendancePeriod.upsert({
    where: {
      // Use label as the unique selector for upsert (no @unique on label in schema,
      // so we use findFirst + create pattern instead)
      id: "seed-period-mar-apr-2026",
    },
    update: {},
    create: {
      id:        "seed-period-mar-apr-2026",
      label:     "Mar 21 – Apr 08, 2026",
      startDate: new Date("2026-03-21"),
      endDate:   new Date("2026-04-08"),
      isActive:  true,
    },
  })
  console.log(`  ✔ Attendance period: "${period.label}" (active)`)

  console.log("\n✅ Seed complete.")
  console.log("   Login: admin@uniondev.com  /  Admin@1234")
  console.log("   Change this password immediately after first login!\n")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
