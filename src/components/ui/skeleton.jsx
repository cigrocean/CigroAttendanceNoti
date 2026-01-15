import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    (<div
      className={cn("animate-pulse rounded-md bg-slate-200/50 dark:bg-slate-700/50", className)}
      {...props} />)
  );
}

export { Skeleton }
