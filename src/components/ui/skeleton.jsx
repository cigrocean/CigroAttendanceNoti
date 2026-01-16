import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-md bg-slate-200/50 dark:bg-slate-700/50", className)}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-[skeleton-shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10" />
    </div>
  );
}

export { Skeleton }
