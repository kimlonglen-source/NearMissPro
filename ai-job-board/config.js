/**
 * AI Job Board - Master Configuration
 * ====================================
 * Edit this file to customize your job board.
 * All settings are centralized here for easy management.
 *
 * CommonJS module - used by both API serverless functions
 * and loaded in the browser via script tag.
 */

const CONFIG = {
  /* ───────────────────────────────
   *  Site Identity
   * ─────────────────────────────── */
  siteName: "AI Job Board",
  siteTagline: "AI-Powered Job Matching Platform",
  siteDescription: "Upload your CV and let AI find the perfect job matches for you. Smart job matching powered by artificial intelligence.",
  siteUrl: "https://your-domain.com",
  supportEmail: "support@your-domain.com",
  logoText: "AI Job Board",

  /* ───────────────────────────────
   *  Theme / Colors
   * ─────────────────────────────── */
  colors: {
    primary: "#6366f1",
    primaryLight: "#818cf8",
    primaryDark: "#4f46e5",
    secondary: "#06b6d4",
    secondaryLight: "#22d3ee",
    accent: "#f59e0b",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    bgDark: "#0f172a",
    bgCard: "#1e293b",
    bgCardHover: "#334155",
    textPrimary: "#f1f5f9",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    border: "#334155",
  },

  /* ───────────────────────────────
   *  Localization
   * ─────────────────────────────── */
  defaultCountry: "US",
  currency: "USD",
  currencySymbol: "$",
  dateFormat: "MM/DD/YYYY",
  supportedCountries: [
    { code: "US", name: "United States", flag: "us" },
    { code: "GB", name: "United Kingdom", flag: "gb" },
    { code: "CA", name: "Canada", flag: "ca" },
    { code: "AU", name: "Australia", flag: "au" },
    { code: "DE", name: "Germany", flag: "de" },
    { code: "FR", name: "France", flag: "fr" },
    { code: "NL", name: "Netherlands", flag: "nl" },
    { code: "NZ", name: "New Zealand", flag: "nz" },
    { code: "SG", name: "Singapore", flag: "sg" },
    { code: "IN", name: "India", flag: "in" },
    { code: "AE", name: "United Arab Emirates", flag: "ae" },
    { code: "IE", name: "Ireland", flag: "ie" },
  ],

  /* ───────────────────────────────
   *  Job Aggregator API
   * ─────────────────────────────── */
  jobAggregator: {
    provider: "adzuna",
    apiKey: "",
    apiId: "",
    resultsPerPage: 20,
    defaultRadius: 30,
  },

  /* ───────────────────────────────
   *  AI Configuration
   * ─────────────────────────────── */
  ai: {
    provider: "anthropic",
    apiKey: "",
    model: "claude-sonnet-4-6",
    maxTokens: 2048,
  },

  /* ───────────────────────────────
   *  Subscription Plans
   * ─────────────────────────────── */
  plans: {
    free: {
      name: "Starter",
      price: 0,
      period: "forever",
      jobPosts: 1,
      featuredDays: 0,
      resumeAccess: false,
      analyticsAccess: false,
      features: [
        "1 active job post",
        "Basic applicant tracking",
        "Email notifications",
        "30-day listing duration",
      ],
    },
    basic: {
      name: "Professional",
      price: 49,
      period: "month",
      jobPosts: 5,
      featuredDays: 7,
      resumeAccess: true,
      analyticsAccess: false,
      features: [
        "5 active job posts",
        "Featured listing (7 days)",
        "Resume database access",
        "Priority support",
        "Company profile page",
      ],
    },
    premium: {
      name: "Business",
      price: 149,
      period: "month",
      jobPosts: 25,
      featuredDays: 14,
      resumeAccess: true,
      analyticsAccess: true,
      features: [
        "25 active job posts",
        "Featured listing (14 days)",
        "Resume database access",
        "Advanced analytics",
        "API access",
        "Dedicated account manager",
      ],
      popular: true,
    },
    enterprise: {
      name: "Enterprise",
      price: 399,
      period: "month",
      jobPosts: -1,
      featuredDays: 30,
      resumeAccess: true,
      analyticsAccess: true,
      features: [
        "Unlimited job posts",
        "Featured listing (30 days)",
        "Resume database access",
        "Advanced analytics + API",
        "Custom branding",
        "Dedicated account manager",
        "Bulk posting tools",
      ],
    },
  },

  /* ───────────────────────────────
   *  Job Categories
   * ─────────────────────────────── */
  categories: [
    "Technology",
    "Healthcare",
    "Finance",
    "Marketing",
    "Sales",
    "Engineering",
    "Design",
    "Education",
    "Legal",
    "Human Resources",
    "Customer Service",
    "Operations",
    "Data Science",
    "Product Management",
    "Other",
  ],

  /* ───────────────────────────────
   *  Job Types
   * ─────────────────────────────── */
  jobTypes: [
    "Full-time",
    "Part-time",
    "Contract",
    "Freelance",
    "Internship",
    "Remote",
  ],

  /* ───────────────────────────────
   *  Experience Levels
   * ─────────────────────────────── */
  experienceLevels: [
    "Entry Level",
    "Mid Level",
    "Senior Level",
    "Lead",
    "Executive",
  ],

  /* ───────────────────────────────
   *  Salary Ranges (display only)
   * ─────────────────────────────── */
  salaryRanges: [
    "Under $30,000",
    "$30,000 - $50,000",
    "$50,000 - $75,000",
    "$75,000 - $100,000",
    "$100,000 - $150,000",
    "$150,000+",
  ],

  /* ───────────────────────────────
   *  Social Media Links
   * ─────────────────────────────── */
  social: {
    twitter: "",
    linkedin: "",
    facebook: "",
    instagram: "",
  },

  /* ───────────────────────────────
   *  Admin Credentials (change these!)
   * ─────────────────────────────── */
  admin: {
    defaultEmail: "admin@your-domain.com",
    defaultPassword: "change-this-password",
  },

  /* ───────────────────────────────
   *  Stripe / Payment
   * ─────────────────────────────── */
  stripe: {
    publishableKey: "",
    secretKey: "",
    webhookSecret: "",
  },

  /* ───────────────────────────────
   *  Storage
   * ─────────────────────────────── */
  storage: {
    provider: "vercel-blob",
    maxFileSizeMB: 10,
    allowedFileTypes: [".pdf", ".doc", ".docx"],
  },

  /* ───────────────────────────────
   *  Blog Settings
   * ─────────────────────────────── */
  blog: {
    postsPerPage: 10,
    enableComments: false,
    aiTones: ["professional", "casual", "technical", "inspirational"],
    defaultWordCount: 800,
  },

  /* ───────────────────────────────
   *  Social Media Generator
   * ─────────────────────────────── */
  socialGenerator: {
    platforms: ["Twitter/X", "LinkedIn", "Facebook", "Instagram"],
    maxHashtags: 10,
  },
};

/* ─── Export for Node.js (CommonJS) and Browser ─── */
if (typeof module !== "undefined" && module.exports) {
  module.exports = CONFIG;
}
