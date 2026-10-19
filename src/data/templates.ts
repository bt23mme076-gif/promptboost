// ─── Prompt Template Library ───────────────────────────────────────────────────
// Static, curated starting points shown in the popup's Templates tab. Each
// template's `prompt` is a ready-to-edit rewrite request — bracketed
// placeholders like [TOPIC] are left for the user to fill in before boosting.

export type TemplateCategory =
  | "content" | "business" | "research" | "coding"
  | "writing" | "design" | "hr" | "sales" | "personal";

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  content: "Content Creation",
  business: "Business & Marketing",
  research: "Study & Research",
  coding: "Coding & Tech",
  writing: "Writing & Copywriting",
  design: "Design & Creative",
  hr: "HR & Recruitment",
  sales: "Sales & Email",
  personal: "Personal Life",
};

export interface PromptTemplate {
  id: string;
  category: TemplateCategory;
  title: string;
  description: string;
  prompt: string;
}

export const TEMPLATES: PromptTemplate[] = [
  // ── Content Creation ──────────────────────────────────────────────────────
  {
    id: "youtube-hook-master",
    category: "content",
    title: "YouTube Hook Master",
    description: "10+ years of viral hook writing, condensed into a 60-second opener.",
    prompt: "You are an expert YouTube scriptwriter with 10+ years creating viral content. Write a 60-second hook for a YouTube video about [TOPIC]. The hook should stop the scroll in the first 3 seconds, promise a clear payoff, and set up why the viewer should keep watching. Target audience: [AUDIENCE].",
  },
  {
    id: "tiktok-viral-hook",
    category: "content",
    title: "TikTok Viral Hook",
    description: "5 scroll-stopping opening lines built from studied viral trends.",
    prompt: "You are a TikTok growth expert who has studied every viral trend. Write 5 TikTok opening hooks (first 3 seconds) for a video about [TOPIC]. Each hook should stop the scroll immediately, create curiosity or controversy, and feel authentic. Target: [AUDIENCE]. Length per hook: max 15 words. Label them Hook 1–5.",
  },
  {
    id: "newsletter-subject-lines",
    category: "content",
    title: "Newsletter Subject Lines",
    description: "10 high-open-rate subject lines from an email marketing specialist.",
    prompt: "You are an email marketing expert with a 40%+ open rate track record. Write 10 email subject lines for a newsletter about [TOPIC]. Mix curiosity, urgency, and clarity. Keep each under 60 characters. Audience: [AUDIENCE].",
  },

  // ── Business & Marketing ──────────────────────────────────────────────────
  {
    id: "product-launch-email",
    category: "business",
    title: "Product Launch Email",
    description: "A conversion copywriter's take on announcing a new product.",
    prompt: "You are a conversion copywriter who has launched products generating $1M+ in revenue. Write a product launch email for [PRODUCT NAME], a [PRODUCT DESCRIPTION]. Include a compelling subject line, a hook, 3 key benefits, social proof placeholder, and a clear call to action. Audience: [AUDIENCE].",
  },
  {
    id: "investor-pitch-narrative",
    category: "business",
    title: "Investor Pitch Narrative",
    description: "The narrative arc used by advisors who've helped 50+ raises.",
    prompt: "You are a startup advisor who has helped 50+ companies raise venture capital. Help me craft the narrative arc for an investor pitch for [COMPANY NAME], which does [ONE-LINE DESCRIPTION]. Cover: the problem, why now, the solution, traction so far, market size, and the ask. Keep it story-driven, not just bullet points.",
  },
  {
    id: "brand-voice-guide",
    category: "business",
    title: "Brand Voice Guide",
    description: "A senior brand strategist defines tone, vocabulary, and do/don'ts.",
    prompt: "You are a senior brand strategist. Create a brand voice guide for [COMPANY NAME], a [TYPE] that sells [PRODUCT/SERVICE]. Define: personality traits (3-5 adjectives), tone by context (marketing vs support vs social), vocabulary to use and avoid, and 3 example sentences in-voice.",
  },

  // ── Study & Research ──────────────────────────────────────────────────────
  {
    id: "essay-structure-builder",
    category: "research",
    title: "Essay Structure Builder",
    description: "An academic writing tutor plans your essay before you draft it.",
    prompt: "You are an academic writing tutor. Help me structure an essay on: [TOPIC]. Requirements: [WORD COUNT], [CITATION STYLE], [ACADEMIC LEVEL]. Provide a thesis statement, section-by-section outline with the argument each section should make, and suggested transitions between sections.",
  },
  {
    id: "concept-explainer",
    category: "research",
    title: "Concept Explainer",
    description: "A master teacher breaks a hard idea down to your exact level.",
    prompt: "You are a master teacher. Explain [COMPLEX TOPIC] to me as if I am [BACKGROUND/LEVEL]. Use: a plain-language analogy, a step-by-step breakdown of the core mechanism, one worked example, and a summary of the most common misconception about it.",
  },

  // ── Coding & Tech ──────────────────────────────────────────────────────────
  {
    id: "code-review-prompt",
    category: "coding",
    title: "Code Review Prompt",
    description: "A senior engineer reviews for correctness, security, and style.",
    prompt: "You are a senior software engineer specializing in [LANGUAGE/FRAMEWORK]. Review the following code for: correctness/bugs, security vulnerabilities, performance issues, and adherence to best practices. For each issue, explain the risk and suggest a concrete fix.\n\n[PASTE CODE]",
  },
  {
    id: "architecture-advisor",
    category: "coding",
    title: "Architecture Advisor",
    description: "15 years of system design experience, applied to your project.",
    prompt: "You are a principal software architect with 15 years of experience. I am building [APP DESCRIPTION], expected to handle [SCALE/USERS]. Recommend an architecture covering: system components, data storage choices, scaling strategy, and key tradeoffs I should be aware of. Constraints: [TEAM SIZE / BUDGET / TIMELINE].",
  },
  {
    id: "bug-debugger",
    category: "coding",
    title: "Bug Debugger",
    description: "A world-class debugger walks the root cause down to a fix.",
    prompt: "You are a world-class debugger. I have a bug in my [LANGUAGE] code. Expected behavior: [WHAT SHOULD HAPPEN]. Actual behavior: [WHAT HAPPENS INSTEAD]. Relevant code and error message below. Walk through likely root causes in order of probability, then give the fix for the most likely one.\n\n[PASTE CODE / ERROR]",
  },

  // ── Writing & Copywriting ──────────────────────────────────────────────────
  {
    id: "landing-page-hero",
    category: "writing",
    title: "Landing Page Hero",
    description: "A CRO specialist writes hero copy that converts at 8%+.",
    prompt: "You are a CRO specialist who writes landing pages that convert at 8%+. Write the hero section for [PRODUCT], which helps [TARGET CUSTOMER] achieve [OUTCOME]. Include: headline (under 10 words), subheadline, primary CTA button text, and one supporting trust line.",
  },
  {
    id: "press-release",
    category: "writing",
    title: "Press Release",
    description: "PR-professional structure and tone, aimed at real coverage.",
    prompt: "You are a PR professional who gets coverage in Forbes and TechCrunch. Write a press release for [ANNOUNCEMENT]. Company: [COMPANY NAME]. Include: a headline that would earn a click, a strong opening paragraph with the who/what/why-now, 2-3 supporting paragraphs with a quote placeholder, and boilerplate.",
  },

  // ── Design & Creative ────────────────────────────────────────────────────
  {
    id: "midjourney-scene",
    category: "design",
    title: "Midjourney Scene",
    description: "An AI art director builds a detailed, render-ready prompt.",
    prompt: "You are a professional AI art director. Write a detailed Midjourney prompt for [SCENE]. Include: subject description, environment/setting, lighting, camera angle and lens, color palette, art style/reference artists, and mood. Format as a single comma-separated prompt line plus suggested aspect ratio.",
  },

  // ── HR & Recruitment ─────────────────────────────────────────────────────
  {
    id: "job-description",
    category: "hr",
    title: "Job Description",
    description: "A talent acquisition specialist writes a role that attracts talent.",
    prompt: "You are a talent acquisition specialist. Write a compelling job description for [JOB TITLE] at [COMPANY]. This role: [ROLE SUMMARY]. Include: an engaging intro, key responsibilities, must-have and nice-to-have qualifications, and what makes this role/company worth joining.",
  },
  {
    id: "performance-review",
    category: "hr",
    title: "Performance Review",
    description: "An HR business partner drafts a fair, specific review.",
    prompt: "You are an HR business partner. Help me write a performance review for [EMPLOYEE/ROLE] covering [PERIOD]. Key context: [ACHIEVEMENTS AND AREAS TO IMPROVE]. Structure it as: summary, strengths with specific examples, growth areas with specific examples, and goals for next period. Keep the tone constructive and specific, not generic.",
  },

  // ── Sales & Email ─────────────────────────────────────────────────────────
  {
    id: "cold-email-replies",
    category: "sales",
    title: "Cold Email That Gets Replies",
    description: "A B2B sales expert's cold email framework, tuned for reply rate.",
    prompt: "You are a B2B sales expert with a 35% reply rate on cold emails. Write a cold email to [ROLE] at [COMPANY TYPE]. What we offer: [PRODUCT/SERVICE]. Keep it under 120 words, lead with a specific, relevant insight (not a generic opener), one clear value proposition, and a low-friction call to action.",
  },
  {
    id: "objection-handler",
    category: "sales",
    title: "Objection Handler",
    description: "A top 1% consultant preps responses to the objections you'll hear.",
    prompt: "You are a top 1% sales consultant. Create an objection handling guide for selling [PRODUCT] at [PRICE] to [BUYER TYPE]. Cover the 5 most common objections (price, timing, authority, need, trust) with a short reframe and a follow-up question for each.",
  },

  // ── Personal Life ─────────────────────────────────────────────────────────
  {
    id: "difficult-conversation-script",
    category: "personal",
    title: "Difficult Conversation Script",
    description: "A communication coach helps you say the hard thing well.",
    prompt: "You are a communication coach. Help me prepare for a conversation with [PERSON/RELATIONSHIP] about [TOPIC]. I want to say: [WHAT YOU WANT TO EXPRESS]. Give me: an opening line that isn't accusatory, 2-3 key points to make, how to respond if they get defensive, and a way to close the conversation constructively.",
  },
  {
    id: "cover-letter",
    category: "personal",
    title: "Cover Letter",
    description: "A career coach writes a letter that connects your story to the role.",
    prompt: "You are a career coach. Write a compelling cover letter for [NAME] applying to [JOB TITLE] at [COMPANY]. Relevant background: [YOUR EXPERIENCE/SKILLS]. Why this role: [MOTIVATION]. Keep it to 3 short paragraphs: a hook connecting to the company, evidence you can do the job, and a confident close.",
  },
];

export function searchTemplates(query: string, category: TemplateCategory | "all"): PromptTemplate[] {
  const q = query.trim().toLowerCase();
  return TEMPLATES.filter((t) => {
    if (category !== "all" && t.category !== category) return false;
    if (!q) return true;
    return t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  });
}
