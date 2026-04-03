import { ShieldIcon } from './Logo';

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#0F6E56] flex flex-col items-center justify-center z-[9999]">
      <ShieldIcon size={80} className="mb-6 [&_path:first-child]:fill-[#1D9E75] [&_path:last-child]:fill-white" />
      <div className="text-2xl text-white tracking-tight mb-6">
        <span className="font-bold">NearMiss</span>
        <span className="font-normal"> Pro</span>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}
