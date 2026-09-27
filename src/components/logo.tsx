import { cn } from "@/lib/utils";

export function Seal({
  size = 72,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/soe-seal.png"
      alt=""
      width={size}
      height={size}
      className={cn("rounded-full bg-black object-cover", className)}
    />
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Seal size={compact ? 32 : 40} className="shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-medium tracking-[0.22em] text-primary uppercase">
          SOE
        </p>
        <p className="truncate font-display text-base leading-tight text-foreground sm:text-lg">
          Chainvote
        </p>
      </div>
    </div>
  );
}
