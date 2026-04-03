export function ShieldIcon({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
      <path d="M32 4L8 16v16c0 14.4 10.24 27.84 24 32 13.76-4.16 24-17.6 24-32V16L32 4z" fill="#0F6E56" />
      <path d="M29 36l-7-7-3 3L29 42l14-14-3-3-11 11z" fill="white" />
    </svg>
  );
}

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const d = { sm: 28, md: 40, lg: 56 }[size];
  const text = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' }[size];
  return (
    <div className="flex items-center gap-2">
      <ShieldIcon size={d} />
      <span className={`${text} tracking-tight`}>
        <span className="font-bold text-[#0F6E56]">NearMiss</span>
        <span className="font-bold text-[#1A1A1A]"> Pro</span>
      </span>
    </div>
  );
}
