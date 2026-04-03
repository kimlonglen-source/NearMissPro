export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 32, md: 48, lg: 64 };
  const d = dims[size];

  return (
    <div className="flex items-center gap-2">
      <svg width={d} height={d} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M32 4L8 16v16c0 14.4 10.24 27.84 24 32 13.76-4.16 24-17.6 24-32V16L32 4z"
          fill="#0F6E56"
        />
        <path
          d="M26 34l-6-6-2.83 2.83L26 39.66l16-16L39.17 21 26 34z"
          fill="white"
        />
      </svg>
      <div>
        <span className="font-extrabold text-brand-teal">NearMiss</span>
        <span className="font-extrabold text-brand-dark"> Pro</span>
      </div>
    </div>
  );
}
