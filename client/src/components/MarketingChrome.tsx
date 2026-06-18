import { Link } from 'react-router-dom';
import { ShieldIcon } from './Logo';

// Shared chrome for every public marketing page (Landing, Terms,
// Privacy, About, Contact). Lives in its own file so a single edit
// updates every footer link and header brand mark in lockstep.

export function MarketingHeader() {
  return (
    <header className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <ShieldIcon size={28} />
          <span className="font-bold text-lg">
            <span className="text-[#0F6E56]">NearMiss</span>
            <span className="text-gray-900"> Pro</span>
          </span>
        </Link>
        <div className="flex items-center gap-5">
          <Link to="/#pricing" className="hidden sm:inline text-sm font-medium text-gray-600 hover:text-[#0F6E56]">Pricing</Link>
          <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-[#0F6E56]">Log in</Link>
          <Link to="/#trial" className="bg-[#0F6E56] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#0B5A46] transition-colors">
            Start free trial
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-6xl mx-auto px-5 py-10 grid md:grid-cols-3 gap-6 text-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldIcon size={22} />
            <span className="font-semibold text-white">NearMiss <span className="text-[#1D9E75]">Pro</span></span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed max-w-xs">Near-miss reporting and CQI for NZ community pharmacy.</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">Product</p>
          <ul className="space-y-1.5">
            <li><Link to="/#pricing" className="hover:text-white">Pricing</Link></li>
            <li><Link to="/#trial" className="hover:text-white">Free trial</Link></li>
            <li><Link to="/login" className="hover:text-white">Log in</Link></li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">Company</p>
          <ul className="space-y-1.5">
            <li><Link to="/about" className="hover:text-white">About</Link></li>
            <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
            <li><Link to="/terms" className="hover:text-white">Terms</Link></li>
            <li><Link to="/privacy" className="hover:text-white">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-5 py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <span>© {new Date().getFullYear()} NearMissPro</span>
          <a href="mailto:hello@nearmisspro.co.nz" className="hover:text-white">hello@nearmisspro.co.nz</a>
        </div>
      </div>
    </footer>
  );
}

// Wrapper for the simple content pages (Terms, Privacy, About,
// Contact). Header + main content + Footer. Content is wrapped in a
// max-width article container with prose-friendly spacing.
export function MarketingLayout({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <MarketingHeader />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-5 py-12 md:py-16">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{title}</h1>
          {subtitle && <p className="text-gray-600 mb-8">{subtitle}</p>}
          {/* prose-like styling without the @tailwindcss/typography
              plugin. Children should use plain <h2>, <p>, <ul>, etc.
              The styles below cascade via direct child selectors. */}
          <div className="marketing-prose">
            {children}
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
