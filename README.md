<div align="center">

<img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white" />
<img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Prisma-5-2D3748?style=for-the-badge&logo=prisma&logoColor=white" />
<img src="https://img.shields.io/badge/PostgreSQL-NeonDB-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
<img src="https://img.shields.io/badge/Deployed-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" />

<br /><br />

# ⏱️ Flexi Time — Union Developers

### Enterprise Attendance Management System

**A full-stack HR platform built for Union Developers that automates attendance tracking,**  
**imports Crystal Report data, calculates shift compliance, and manages your entire workforce.**

<br />

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-flexi--time--union--developers.vercel.app-322E53?style=for-the-badge)](https://flexi-time-union-developers.vercel.app)

<br />

---

</div>
## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Data Model](#-data-model)
- [Attendance Logic](#-attendance-logic)
- [Crystal Report Import](#-crystal-report-import)
- [Role-Based Access](#-role-based-access)
- [API Reference](#-api-reference)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [Deployment](#-deployment)

---

## 🌟 Overview

Flexi Time is a production-grade HR attendance system built exclusively for **Union Developers**. It replaces manual spreadsheet workflows with an automated, role-aware platform that:

- Ingests the existing **Crystal Report Monthly IN-OUT Excel exports** directly — no reformatting needed
- Cross-references attendance punches with the employee database via **HCM ID**
- Calculates **shift compliance status** (Present / Short Time / Half Day / Absent / Missing In / Missing Out) automatically
- Displays a full **monthly attendance grid** with per-cell override capability
- Supports a complete **employee lifecycle** — onboarding, status changes, department management
- Provides **searchable reports** and audit trails for HR managers

---
## ✨ Features

### 🏢 Employee Management
- Full employee profiles — personal info, employment details, emergency contacts, CNIC validity
- Department & sub-department assignment with auto-creation on import
- Status lifecycle — Active → Inactive with effective-date history
- Bulk Excel import with preview, validation, and department auto-creation
- Advanced search with real-time filtering

### 📅 Attendance Tracking
- **Attendance Periods** — create and manage named reporting periods (e.g. "March 2026")
- **Monthly grid view** — colour-coded status cells across all employees for the full period
- **Per-cell override** — HR can manually override any calculated status with a reason note
- **Audit trail** — all overrides log who changed what and when

### 📤 Excel Import — 3 Formats Supported

| Format | Description |
|--------|-------------|
| **Crystal Report** *(auto-detected)* | Union Developers Monthly IN-OUT Report — reads HCM ID from first column, dates from "For Date:" header |
| **Row-per-punch** | One row per employee per day: `HcmId / Date / In Time / Out Time` |
| **Columnar** | One row per employee, date columns contain `HH:MM–HH:MM` pairs |

### 👥 User & Role Management
- 5-tier RBAC: `SUPER_ADMIN` → `ADMIN` → `HR_MANAGER` → `HR_EXECUTIVE` → `VIEWER`
- NextAuth v5 credential-based authentication with bcrypt password hashing
- Per-permission guards on every API route

### ⚙️ Settings
- **Shift Configuration** — configure grace minutes, present/short-time/half-day thresholds
- **Email Templates** — manage notification templates with variable substitution

### 📊 Reports
- Filterable attendance summaries by department, period, and status
- Export-ready data

---
## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router, Server Components) |
| **Language** | TypeScript 5.7 |
| **Styling** | Tailwind CSS 3 + shadcn/ui primitives (Radix UI) |
| **Database** | PostgreSQL via **NeonDB** (serverless) |
| **ORM** | Prisma 5 |
| **Auth** | NextAuth v5 (credentials provider + bcryptjs) |
| **Forms** | React Hook Form + Zod validation |
| **Charts** | Recharts |
| **Excel Parsing** | SheetJS (xlsx) — dynamically imported, client-side only |
| **Notifications** | Sonner toast |
| **Icons** | Lucide React |
| **Deployment** | Vercel (auto-deploy from `main`) |

---

## 📁 Project Structure

```
flexi-time/
├── prisma/
│   ├── schema.prisma          # Full data model
│   └── seed.ts                # Database seeder
│
└── src/
    ├── app/
    │   ├── (auth)/login/      # Login page
    │   ├── (dashboard)/       # Protected dashboard routes
    │   │   ├── dashboard/     # Overview & stats cards
    │   │   ├── attendance/    # Period list + monthly grid
    │   │   ├── employees/     # Employee list, detail, import
    │   │   ├── departments/   # Department management
    │   │   ├── reports/       # Attendance reports
    │   │   ├── settings/      # Shift config, email templates
    │   │   └── users/         # User management
    │   └── api/
    │       ├── attendance/
    │       │   ├── [periodId]/        # GET period attendance grid
    │       │   ├── match-employees/   # POST map HCM codes to IDs
    │       │   ├── periods/           # CRUD attendance periods
    │       │   ├── records/[id]/      # PATCH override a record
    │       │   └── sync/              # POST bulk upsert records
    │       ├── employees/             # CRUD employees + bulk import
    │       ├── departments/           # CRUD departments
    │       ├── reports/               # Attendance summaries
    │       ├── search/                # Full-text search
    │       ├── settings/              # Shift config + email templates
    │       └── users/                 # User management
    │
    ├── components/
    │   ├── attendance/
    │   │   ├── upload-dialog.tsx    # 4-step import wizard
    │   │   ├── grid-shell.tsx       # Monthly attendance grid
    │   │   ├── override-modal.tsx   # Manual status override
    │   │   └── period-section.tsx   # Period selector
    │   ├── employees/           # Table, form, import sheet
    │   ├── dashboard/           # Stats cards, charts
    │   ├── layout/              # Sidebar, topbar
    │   ├── reports/             # Report filters & tables
    │   └── settings/            # Settings panels
    │
    └── lib/
        ├── attendance-calc.ts   # Shift logic (shared client + server)
        ├── prisma.ts            # Prisma singleton
        ├── utils.ts             # cn() + helpers
        └── with-permission.ts   # RBAC guard middleware
```

---
## 🗄 Data Model

```
User ──────────────────────── (id, email, passwordHash, name, role, isActive)
  └── overrides → AttendanceRecord

Department ────────────────── (id, code★, name, isActive)
  └── employees → Employee

Employee ──────────────────── (id, hcmId★, cnic, name, designation, doj, status...)
  ├── statusHistory → EmployeeStatusHistory
  └── attendance → AttendanceRecord

AttendancePeriod ──────────── (id, label, startDate, endDate, isActive)
  └── records → AttendanceRecord

AttendanceRecord ──────────── (employeeId + date★ unique)
  ├── inTime, outTime       — raw punch strings "HH:MM"
  ├── workedMinutes         — computed on sync
  ├── calculatedStatus      — auto-derived by sync API
  └── overriddenStatus      — manual HR override

ShiftConfig ───────────────── (name, isDefault★, presentMinutes, shortTimeMin, halfDayMin)
```

> ★ Unique constraint / primary lookup key

---

## ⚡ Attendance Logic

All status calculations live in `src/lib/attendance-calc.ts` and run identically on **client** (import preview) and **server** (sync API).

### Default Shift Thresholds *(configurable in Settings → Shift Config)*

| Status | Condition | Badge |
|--------|-----------|-------|
| `PRESENT` | worked ≥ 465 min *(7h 45m)* | 🟢 Green |
| `SHORT_TIME` | worked ≥ 391 min *(6h 31m)* | 🔵 Blue |
| `HALF_DAY` | worked ≥ 240 min *(4h 00m)* | 🟡 Amber |
| `ABSENT` | worked < 240 min or no punches | 🔴 Red |
| `MISSING_IN` | only outTime recorded | 🟠 Orange |
| `MISSING_OUT` | only inTime recorded | 🟠 Orange |
| `LEAVE` | manual override only | 🟣 Purple |
| `OFF` | manual override only | ⚪ Grey |

> Overnight shifts (e.g. 23:00 → 07:00) are handled by adding 1440 minutes when `outTime < inTime`.

---
## 🗂 Crystal Report Import

Union Developers uses **SAP Crystal Reports** to export a Monthly IN-OUT Report. The system **auto-detects** this format and parses it without any pre-processing or reformatting.

### Report Layout (Excel export)

```
Row 0 │ "Union Developers"
Row 1 │ "Monthly IN-OUT Report"
Row 2 │ "For Date: 2026/03/21 to 2026/04/08"   ← date range parsed here
Row 3 │ "Division:"
Row 4 │ "Department: 10    Accounts & Finance"
Row 5 │  21  │ 22  │ 23  │ 24  │ ... │ 08   ← day numbers
Row 6 │ Sat │ Sun │ Mon │ Tue │ ... │ Wed  ← day-of-week (skipped)
Row 7 │ "200201 / Hamza Khan"  │ 10:10 │ 10:05 │ ...  ← inTime row
Row 8 │ "Asst. Manager Finance"│       │       │ ...  ← outTime row
Row 9 │ "200202 / Summer Zahid" │ 10:03 │  9:27 │ ...  ← next employee...
```

### Parsing Rules

1. **Format detection** — first 10 rows contain `"in-out"` + `"for date"` ⇒ Crystal Report
2. **HCM ID extraction** — regex `/^(\d{4,10})/` on first column; name & designation are **ignored entirely**
3. **Date mapping** — day ≥ start day → same month; day < start day → next month (handles month-boundary reports)
4. **Row pairing** — Row A (starts with HCM ID) = inTime row; Row B = outTime row
5. **Matching** — extracted HCM IDs are cross-referenced against `Employee.hcmId` in the database

### Import Wizard (4 Steps)

```
Step 1: Upload   →  Select attendance period + drop .xlsx file
Step 2: Match    →  System maps every HCM code → Employee record (shows matched/unmatched)
Step 3: Preview  →  See first 20 records with auto-computed statuses
Step 4: Sync     →  Bulk upsert to AttendanceRecord table (create + update counts returned)
```

Unmatched HCM IDs are listed in Step 2 but are **silently skipped** during sync — they do not cause errors.

---
## 🔐 Role-Based Access

| Permission | SUPER_ADMIN | ADMIN | HR_MANAGER | HR_EXECUTIVE | VIEWER |
|------------|:-----------:|:-----:|:----------:|:------------:|:------:|
| View attendance grid | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload attendance | ✅ | ✅ | ✅ | ✅ | ❌ |
| Override status | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage employees | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage departments | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage users | ✅ | ✅ | ❌ | ❌ | ❌ |
| System settings | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 🔌 API Reference

All routes require a valid session. Permission failures return `401` or `403`.

### Attendance

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/attendance/periods` | List all periods |
| `POST` | `/api/attendance/periods` | Create a new period |
| `GET` | `/api/attendance/[periodId]` | Fetch full grid for a period |
| `POST` | `/api/attendance/match-employees` | Map HCM codes → employee IDs |
| `POST` | `/api/attendance/sync` | Bulk upsert attendance records |
| `PATCH` | `/api/attendance/records/[id]` | Override a single record status |

### Employees

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/employees` | Paginated list with search & filters |
| `POST` | `/api/employees` | Create a single employee |
| `POST` | `/api/employees/import` | Bulk import employees from Excel |
| `GET` | `/api/employees/[id]` | Get employee detail |
| `PATCH` | `/api/employees/[id]` | Update employee |
| `DELETE` | `/api/employees/[id]` | Deactivate employee |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/departments` | List departments |
| `GET` | `/api/search?q=` | Global search |
| `GET/POST/PATCH` | `/api/settings/shift` | Shift config CRUD |
| `GET` | `/api/reports` | Attendance summary report |
| `GET/POST/PATCH` | `/api/users` | User management |

---
## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- A [NeonDB](https://neon.tech) PostgreSQL database (free tier works)
- npm or pnpm

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/hrpsp/Flexi-Time---Union-Developers.git
cd Flexi-Time---Union-Developers

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your database URLs and AUTH_SECRET

# 4. Generate Prisma client & push schema
npm run db:generate
npm run db:push

# 5. Seed the database (creates admin user + base departments)
npm run db:seed

# 6. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the seeded admin credentials.

---

## 🔑 Environment Variables

Create `.env.local` based on `.env.example`:

```env
# ── Database (NeonDB serverless PostgreSQL) ──────────────────────────────────
# Pooled — used by Prisma at runtime
POSTGRES_PRISMA_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require&pgbouncer=true"

# Non-pooled — required for Prisma Migrate
POSTGRES_URL_NON_POOLING="postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require"

# ── NextAuth v5 ──────────────────────────────────────────────────────────────
# Generate: openssl rand -base64 32
AUTH_SECRET="your-super-secret-minimum-32-char-string"
NEXTAUTH_URL="http://localhost:3000"

# ── Email / SMTP (optional) ──────────────────────────────────────────────────
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="noreply@example.com"
SMTP_PASS="your-app-password"
SMTP_FROM="Flexi Time <noreply@example.com>"
```

> **Tip:** The Vercel + NeonDB integration auto-populates both `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING` when you link your project in the Vercel dashboard.

---

## 🖼 Database Setup

```bash
npm run db:generate   # Generate Prisma client
npm run db:push       # Apply schema to database (dev/staging)
npm run db:migrate    # Run migrations (production)
npm run db:seed       # Seed admin user + base departments
npm run db:studio     # Open Prisma Studio visual browser
```

---

## ☁️ Deployment

The project is connected to **Vercel** and automatically deploys on every push to `main`.

### Required Vercel Environment Variables

| Variable | How to get it |
|----------|--------------|
| `POSTGRES_PRISMA_URL` | NeonDB integration or Neon Console |
| `POSTGRES_URL_NON_POOLING` | NeonDB integration or Neon Console |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your Vercel production URL |

### Manual Deploy

```bash
npm i -g vercel
vercel --prod
```

---

<div align="center">

<br />

**Built with ❤️ for Union Developers**

<br />

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)](https://prisma.io)
[![NeonDB](https://img.shields.io/badge/Database-NeonDB-00E699?logo=postgresql&logoColor=white)](https://neon.tech)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000?logo=vercel&logoColor=white)](https://vercel.com)
[![License](https://img.shields.io/badge/License-Private-322E53)](https://github.com/hrpsp/Flexi-Time---Union-Developers)

<br />

</div>
