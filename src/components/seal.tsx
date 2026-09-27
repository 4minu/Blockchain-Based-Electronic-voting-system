export function Seal({ size = 72 }: { size?: number }) {
  return (
    <img
      src="/soe-seal.png"
      alt="Department of Software Engineering seal"
      width={size}
      height={size}
      className="rounded-full border border-border bg-card object-cover"
    />
  );
}
