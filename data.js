const seedContacts = [
  {
    id: "c1",
    name: "Dr. Priya Raman",
    email: "priya.raman@utexas.edu",
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
    email: "jordan.lee@google.com",
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
    email: "marisol.chen@mckinsey.com",
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
    email: "nikhil.desai@northstarlabs.com",
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
    email: "elena.voss@columbia.edu",
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
    email: "aisha.bello@stripe.com",
    role: "Senior Data Scientist",
    organization: "Stripe",
    bio: "Leads experimentation on fraud detection systems and mentors women in data.",
    relevance: "Shared interest in applied ML and payments domain experience from your project list.",
    category: "Networking",
    confidence: 83,
    tags: ["Data Science", "Fintech", "Networking"],
  },
];

const generatedProfiles = Array.from({ length: 54 }, (_, i) => {
  const index = i + 7;
  const domainCycle = [
    {
      role: "Research Scientist",
      category: "Research",
      tags: ["AI", "Research", "Publications"],
      org: "Stanford AI Lab",
      focus: "student-led LLM evaluation projects",
    },
    {
      role: "Software Engineer",
      category: "Internship",
      tags: ["Engineering", "Startups", "Backend"],
      org: "Atlas Compute",
      focus: "distributed systems internship pathways",
    },
    {
      role: "Product Manager",
      category: "Coffee Chat",
      tags: ["Product", "Mentorship", "Growth"],
      org: "Figma",
      focus: "early-career PM rotational programs",
    },
    {
      role: "Campus Recruiter",
      category: "Referral",
      tags: ["Recruiting", "Careers", "Outreach"],
      org: "Microsoft",
      focus: "new grad technical recruiting timelines",
    },
    {
      role: "Analytics Lead",
      category: "Mentorship",
      tags: ["Data", "Mentorship", "Experimentation"],
      org: "Airbnb",
      focus: "mentoring students on analytics portfolios",
    },
    {
      role: "Investment Analyst",
      category: "Networking",
      tags: ["Finance", "Networking", "Strategy"],
      org: "Goldman Sachs",
      focus: "networking opportunities for student analysts",
    },
  ][i % 6];

  const firstNames = [
    "Sam", "Riya", "Leo", "Mina", "Arjun", "Noah", "Sofia", "Ibrahim", "Claire", "Mateo", "Avery", "Dae",
  ];
  const lastNames = [
    "Patel", "Nguyen", "Carter", "Kim", "Torres", "Singh", "Hernandez", "Wright", "Olsen", "Ali", "Brown", "Park",
  ];

  const first = firstNames[i % firstNames.length];
  const last = lastNames[(i + 3) % lastNames.length];

  return {
    id: `c${index}`,
    name: `${first} ${last}`,
    email: `${first}.${last}${index}@${domainCycle.org.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
    role: domainCycle.role,
    organization: domainCycle.org,
    bio: `Supports students through ${domainCycle.focus} and actively replies to focused outreach.`,
    relevance: `Strong overlap with your profile goals around ${domainCycle.tags[0].toLowerCase()} and practical career exploration.`,
    category: domainCycle.category,
    confidence: 72 + (i % 24),
    tags: domainCycle.tags,
  };
});

export const mockContacts = [...seedContacts, ...generatedProfiles];

export const queryPresets = [
  "Professors in AI at UT Austin",
  "Alumni in consulting",
  "Software engineers at startups",
  "Recruiters at top tech companies",
  "Product mentors for PM internships",
  "Data science leaders in fintech",
  "Research labs open to undergraduate assistants",
];

export const toneOptions = [
  { value: "research", label: "Research inquiry" },
  { value: "coffee", label: "Coffee chat request" },
  { value: "referral", label: "Referral request" },
  { value: "network", label: "General networking" },
];

export const goalOptions = ["Research", "Coffee Chat", "Referral", "Mentorship", "Internship"];
