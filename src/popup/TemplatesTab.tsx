import { useMemo, useState } from "react";
import { Search, Megaphone, Briefcase, GraduationCap, Code2, PenTool, Palette, Users, Mail, Heart, LayoutGrid, ArrowRight, LucideIcon } from "lucide-react";
import { CATEGORY_LABELS, PromptTemplate, TemplateCategory, searchTemplates } from "@/data/templates";

const CATEGORY_ICONS: Record<TemplateCategory, LucideIcon> = {
  content: Megaphone, business: Briefcase, research: GraduationCap, coding: Code2,
  writing: PenTool, design: Palette, hr: Users, sales: Mail, personal: Heart,
};

const CATEGORIES: (TemplateCategory | "all")[] = ["all", "content", "business", "research", "coding", "writing", "design", "hr", "sales", "personal"];

interface TemplatesTabProps {
  onUse: (template: PromptTemplate) => void;
}

export function TemplatesTab({ onUse }: TemplatesTabProps) {
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchTemplates(query, category), [query, category]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-3 pb-2 space-y-2.5 shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-colors"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-4 px-4 scrollbar-none">
          {CATEGORIES.map((c) => {
            const Icon = c === "all" ? LayoutGrid : CATEGORY_ICONS[c];
            const active = category === c;
            return (
              <button key={c} onClick={() => setCategory(c)}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                  active
                    ? "bg-brand-600 border-brand-600 text-white"
                    : "bg-white dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                }`}>
                <Icon size={12} />
                {c === "all" ? "All" : CATEGORY_LABELS[c]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2">
        {results.length === 0 ? (
          <div className="py-10 text-center text-xs text-zinc-400">No templates match “{query}”.</div>
        ) : (
          results.map((t) => {
            const Icon = CATEGORY_ICONS[t.category];
            return (
              <button
                key={t.id}
                onClick={() => onUse(t)}
                className="w-full text-left p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 w-7 h-7 shrink-0 rounded-lg bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate">{t.title}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug line-clamp-2">{t.description}</p>
                  </div>
                  <ArrowRight size={13} className="mt-1 shrink-0 text-zinc-300 dark:text-zinc-600 group-hover:text-brand-500 transition-colors" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
