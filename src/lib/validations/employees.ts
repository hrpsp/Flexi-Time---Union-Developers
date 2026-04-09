import { z } from "zod"

// ── CNIC: 5-7-1 pattern with dashes ─────────────────────────────────────────
const cnicRegex = /^\d{5}-\d{7}-\d{1}$/
const cnicSchema = z
  .string()
  .regex(cnicRegex, "CNIC must be in format XXXXX-XXXXXXX-X")
  .optional()
  .or(z.literal("").transform(() => undefined))

const dateString = z
  .string()
  .optional()
  .or(z.literal("").transform(() => undefined))

const optStr = (max = 100) =>
  z.string().max(max).optional().or(z.literal("").transform(() => undefined))

// ── Create ───────────────────────────────────────────────────────────────────
export const createEmployeeSchema = z.object({
  // Identification
  hcmId:        z.string().min(1, "HCM ID is required").max(30),
  cnic:         cnicSchema,

  // Personal
  name:         z.string().min(2, "Name must be at least 2 characters").max(100),
  fatherName:   optStr(100),
  gender:       z.enum(["MALE", "FEMALE"]).optional(),
  dateOfBirth:  dateString,
  maritalStatus: z.enum(["MARRIED", "UN_MARRIED"]).optional(),
  bloodGroup:   z.enum(["A_POS","A_NEG","B_POS","B_NEG","O_POS","O_NEG","AB_POS","AB_NEG"]).optional(),
  religion:     z.enum(["ISLAM","CHRISTIAN","OTHER"]).optional(),
  education:    optStr(150),
  contactNumber: optStr(20),
  email:        z.string().email("Enter a valid email").optional().or(z.literal("").transform(() => undefined)),
  address:      optStr(300),

  // Emergency / NOK
  nokName:      optStr(100),
  nokRelation:  optStr(100),
  emergencyContact: optStr(20),

  // Employment
  designation:      optStr(100),
  grade:            optStr(50),
  pgcGrade:         optStr(50),
  departmentId:     z.string().min(1, "Department is required"),
  subDepartment:    optStr(100),
  division:         z.enum(["SUPPORT_SERVICES","INFRASTRUCTURE","CONSTRUCTION","COMMERCIAL"]).optional(),
  project:          optStr(100),
  doj:              dateString,
  confirmationDate: dateString,

  // CNIC validity
  cnicIssueDate:  dateString,
  cnicExpiryDate: dateString,
})

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>

export const editEmployeeSchema = createEmployeeSchema
export type EditEmployeeInput = CreateEmployeeInput

// ── Query params ─────────────────────────────────────────────────────────────
export const employeeQuerySchema = z.object({
  search:       z.string().optional(),
  departmentId: z.string().optional(),
  division:     z.string().optional(),
  grade:        z.string().optional(),
  project:      z.string().optional(),
  gender:       z.string().optional(),
  status:       z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional().default("ACTIVE"),
  page:         z.coerce.number().min(1).optional().default(1),
  limit:        z.coerce.number().min(1).max(200).optional().default(25),
})
export type EmployeeQuery = z.infer<typeof employeeQuerySchema>
