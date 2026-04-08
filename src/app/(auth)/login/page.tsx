"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Building2, Lock, Mail, AlertCircle, Loader2 } from "lucide-react"
import { loginSchema, type LoginInput } from "@/lib/validations/auth"

export default function LoginPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginInput) => {
    setServerError(null)

    const result = await signIn("credentials", {
      email:    data.email,
      password: data.password,
      redirect: false,
    })

    if (result?.error) {
      setServerError("Invalid email or password.")
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">

        {/* ── Logo ──────────────────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-900/40">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Union Developers</h1>
          <p className="text-slate-400 text-sm mt-1">Attendance Management System</p>
        </div>

        {/* ── Card ──────────────────────────────────────────────────────────── */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-8 shadow-2xl">
          <h2 className="text-base font-semibold text-white mb-6">Sign in to continue</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

            {/* Email */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  {...register("email")}
                  type="email"
                  autoComplete="email"
                  placeholder="admin@uniondev.com"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg
                             text-sm text-white placeholder-slate-600
                             focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                             transition-colors"
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  {...register("password")}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg
                             text-sm text-white placeholder-slate-600
                             focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                             transition-colors"
                />
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="flex items-center gap-2 p-3 bg-red-950/60 border border-red-800/60 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{serverError}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 mt-2
                         bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700
                         disabled:opacity-50 disabled:cursor-not-allowed
                         text-white text-sm font-semibold rounded-lg
                         transition-colors shadow-lg shadow-indigo-900/30"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-700 mt-6">
          Union Developers · HRPSP / Flexi IT Services
        </p>
      </div>
    </div>
  )
}
