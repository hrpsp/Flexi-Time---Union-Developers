"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, Clock4, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { loginSchema, type LoginInput } from "@/lib/validations/auth"

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginInput) => {
    const result = await signIn("credentials", {
      email:    data.email,
      password: data.password,
      redirect: false,
    })

    if (!result || result.error) {
      toast.error("Invalid email or password. Please try again.")
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">

        {/* ── Logo ───────────────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-purple mb-4 shadow-lg shadow-[#322E53]/30">
            <Clock4 className="w-8 h-8 text-brand-peach" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-brand-purple">
            Flexi Time
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            Flexi IT Services · HR Attendance System
          </p>
        </div>

        {/* ── Card ───────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-xl shadow-[#322E53]/10 border border-border p-8">
          <h2 className="text-lg font-bold text-brand-purple mb-6">
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-[#49426E] mb-1.5"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@flexiit.com"
                {...register("email")}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-brand-bg
                           text-sm font-medium text-brand-purple placeholder-slate-400
                           focus:outline-none focus:ring-2 focus:ring-brand-purple/25 focus:border-brand-purple
                           transition-colors"
              />
              {errors.email && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-[#49426E] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register("password")}
                  className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-border bg-brand-bg
                             text-sm font-medium text-brand-purple placeholder-slate-400
                             focus:outline-none focus:ring-2 focus:ring-brand-purple/25 focus:border-brand-purple
                             transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-purple transition-colors"
                >
                  {showPassword
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye    className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 mt-2
                         rounded-lg font-bold text-sm tracking-wide
                         bg-brand-purple text-white
                         hover:bg-brand-mid-purple
                         active:scale-[0.98]
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all shadow-md shadow-brand-purple/25"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              Trouble signing in?{" "}
              <span className="font-semibold text-brand-purple cursor-pointer hover:underline">
                Contact IT Support
              </span>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 font-medium">
          © {new Date().getFullYear()} Flexi IT Services. All rights reserved.
        </p>
      </div>
    </div>
  )
}
