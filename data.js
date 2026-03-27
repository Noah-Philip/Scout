export const mockContacts = [
  {
    id: "c1",
    name: "Dr. Priya Raman",
    role: "Assistant Professor, Machine Learning",
    organization: "UT Austin",
    bio: "Leads a lab focused on multimodal learning for healthcare applications.",
    relevance: "Your NLP + healthcare interest aligns with her current undergraduate RA openings.",
    category: "Research",
    confidence: 94,
    tags: ["AI", "Healthcare", "Research"],
  },
  {
    id: "c2",
    name: "Jordan Lee",
    role: "Product Manager",
    organization: "Google",
    bio: "UT Austin alum helping early-career students break into product roles.",
    relevance: "Shared alma mater and interest in consumer product internships.",
    category: "Coffee Chat",
    confidence: 89,
    tags: ["Alumni", "PM", "Mentorship"],
  },
  {
    id: "c3",
    name: "Marisol Chen",
    role: "Campus Recruiter",
    organization: "McKinsey & Company",
    bio: "Runs recruiting outreach for Southwest universities.",
    relevance: "You listed consulting referrals as a top goal this semester.",
    category: "Referral",
    confidence: 82,
    tags: ["Consulting", "Recruiting"],
  },
  {
    id: "c4",
    name: "Nikhil Desai",
    role: "Software Engineer",
    organization: "Northstar Labs",
    bio: "Early engineer at a growth-stage startup building developer tooling.",
    relevance: "Your startup interest + TypeScript experience are a strong overlap.",
    category: "Internship",
    confidence: 86,
    tags: ["Startups", "Engineering", "Internships"],
  },
  {
    id: "c5",
    name: "Prof. Elena Voss",
    role: "Associate Professor, Economics",
    organization: "Columbia University",
    bio: "Publishes on labor markets and causal inference; mentors undergraduate thesis students.",
    relevance: "You mentioned econometrics and graduate research preparation in your goals.",
    category: "Mentorship",
    confidence: 78,
    tags: ["Economics", "Mentorship", "Research"],
  },
  {
    id: "c6",
    name: "Aisha Bello",
    role: "Senior Data Scientist",
    organization: "Stripe",
    bio: "Leads experimentation on fraud detection systems and mentors women in data.",
    relevance: "Shared interest in applied ML and payments domain experience from your project list.",
    category: "Networking",
    confidence: 83,
    tags: ["Data Science", "Fintech", "Networking"],
  },
];

export const queryPresets = [
  "Professors in AI at UT Austin",
  "Alumni in consulting",
  "Software engineers at startups",
  "Recruiters at top tech companies",
];

export const toneOptions = [
  { value: "research", label: "Research inquiry" },
  { value: "coffee", label: "Coffee chat request" },
  { value: "referral", label: "Referral request" },
  { value: "network", label: "General networking" },
];

export const goalOptions = ["Research", "Coffee Chat", "Referral", "Mentorship", "Internship"];
