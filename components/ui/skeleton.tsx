import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-gradient-to-r from-white/5 via-white/[0.12] to-white/5 bg-[length:200%_100%] animate-shimmer",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
