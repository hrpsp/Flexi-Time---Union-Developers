import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title:        string
  description?: string
  children?:    React.ReactNode   // action buttons on the right
  className?:   string
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div>
        <h2 className="text-xl font-extrabold text-[#322E53] leading-tight tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5 font-medium">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 shrink-0">{children}</div>
      )}
    </div>
  )
}
