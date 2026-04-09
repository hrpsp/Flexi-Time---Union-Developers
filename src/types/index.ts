/**
 * Shared TypeScript types — synced with prisma/schema.prisma enums.
 */

export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "HR_MANAGER"
  | "HR_EXECUTIVE"
  | "VIEWER"

export type AttendanceStatus =
  | "PRESENT"
  | "SHORT_TIME"
  | "HALF_DAY"
  | "ABSENT"
  | "LEAVE"
  | "MISSING_IN"
  | "MISSING_OUT"
  | "UNMARKED"
  | "OFF"

export type LeaveType =
  | "ANNUAL"
  | "SICK"
  | "CASUAL"
  | "EMERGENCY"
  | "UNPAID"
  | "WORK_FROM_HOME"

export type EmployeeStatus = "ACTIVE" | "INACTIVE"

export type Gender        = "MALE" | "FEMALE"
export type MaritalStatus = "MARRIED" | "UN_MARRIED"
export type BloodGroup    = "A_POS" | "A_NEG" | "B_POS" | "B_NEG" | "O_POS" | "O_NEG" | "AB_POS" | "AB_NEG"
export type Religion      = "ISLAM" | "CHRISTIAN" | "OTHER"
export type Division      = "SUPPORT_SERVICES" | "INFRASTRUCTURE" | "CONSTRUCTION" | "COMMERCIAL"

export interface SessionUser {
  id:    string
  name:  string
  email: string
  role:  Role
}

export interface Department {
  id:       string
  code:     number
  name:     string
  isActive: boolean
}

export interface Employee {
  id:              string
  hcmId:           string
  cnic?:           string | null
  name:            string
  fatherName?:     string | null
  designation?:    string | null
  grade?:          string | null
  pgcGrade?:       string | null
  division?:       Division | null
  project?:        string | null
  status:          EmployeeStatus
  department:      Department
}

export interface AttendanceRecord {
  id:               string
  date:             string
  inTime?:          string | null
  outTime?:         string | null
  workedMinutes?:   number | null
  calculatedStatus: AttendanceStatus
  overriddenStatus?: AttendanceStatus | null
  leaveType?:       LeaveType | null
  note?:            string | null
  employee:         Pick<Employee, "id" | "name" | "hcmId">
}

export type StatusSummary = Record<AttendanceStatus, number>
