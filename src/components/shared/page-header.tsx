import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title:        string
  description?: string
  children?:    React.ReactNode   // right-side actions
  className?:   string
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div>
        <h2 className="text-xl font-bold text-white leading-tight">{title}</h2>
        {description && (
          <p className="text-sm text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 shrink-0">{children}</div>
      )}
    </div>
  )
}
