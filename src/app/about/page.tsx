import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AboutPage() {
  const t = await getTranslations("about");

  const features = [
    {
      icon: <SearchIcon />,
      title: t("features.textQuery.title"),
      description: t("features.textQuery.description"),
      color: "bg-blue-50 text-blue-600 border-blue-100",
    },
    {
      icon: <TrendingIcon />,
      title: t("features.costVariance.title"),
      description: t("features.costVariance.description"),
      color: "bg-purple-50 text-purple-600 border-purple-100",
    },
    {
      icon: <CompareIcon />,
      title: t("features.multiMine.title"),
      description: t("features.multiMine.description"),
      color: "bg-emerald-50 text-emerald-600 border-emerald-100",
    },
  ];

  const questions: { cat: string; items: string[] }[] = [
    {
      cat: t("questions.cat1"),
      items: [t("questions.q1"), t("questions.q2"), t("questions.q3")],
    },
    {
      cat: t("questions.cat2"),
      items: [t("questions.q4"), t("questions.q5"), t("questions.q6")],
    },
    {
      cat: t("questions.cat3"),
      items: [t("questions.q7"), t("questions.q8"), t("questions.q9")],
    },
    {
      cat: t("questions.cat4"),
      items: [t("questions.q10"), t("questions.q11"), t("questions.q12")],
    },
    {
      cat: t("questions.cat5"),
      items: [t("questions.q13"), t("questions.q14"), t("questions.q15")],
    },
  ];

  const screenshots = [
    {
      src: "/screenshots/final-state-all-panels.png",
      alt: t("screenshots.img1Alt"),
      caption: t("screenshots.img1Caption"),
      wide: true,
    },
    {
      src: "/screenshots/text-query-working.png",
      alt: t("screenshots.img2Alt"),
      caption: t("screenshots.img2Caption"),
      wide: false,
    },
    {
      src: "/screenshots/text-query-spanish-insight.png",
      alt: t("screenshots.img3Alt"),
      caption: t("screenshots.img3Caption"),
      wide: false,
    },
    {
      src: "/screenshots/cost-variance-working.png",
      alt: t("screenshots.img4Alt"),
      caption: t("screenshots.img4Caption"),
      wide: false,
    },
    {
      src: "/screenshots/text-query-formatted.png",
      alt: t("screenshots.img5Alt"),
      caption: t("screenshots.img5Caption"),
      wide: false,
    },
  ];

  const pipelineSteps = [
    { label: t("pipeline.step1"), desc: t("pipeline.step1Desc") },
    { label: t("pipeline.step2"), desc: t("pipeline.step2Desc") },
    { label: t("pipeline.step3"), desc: t("pipeline.step3Desc") },
    { label: t("pipeline.step4"), desc: t("pipeline.step4Desc") },
  ];

  const techStack = [
    "Next.js 15",
    "TypeScript",
    "Supabase",
    "OpenAI / Anthropic",
    "Recharts",
    "next-intl",
    "Tailwind CSS",
  ];

  return (
    <main className="flex flex-col gap-14 pb-16 bg-bg min-h-full">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-white to-purple-50 border-b border-border px-6 py-16">
        <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-primary/10 text-primary border-primary/20 tracking-wide uppercase">
            <SparkleIcon />
            {t("hero.badge")}
          </span>
          <h1 className="text-5xl font-bold text-text leading-tight">
            {t("hero.title")}
          </h1>
          <p className="text-xl text-primary font-medium">{t("hero.subtitle")}</p>
          <p className="text-text-muted text-base leading-relaxed max-w-2xl">
            {t("hero.description")}
          </p>
          <div className="flex gap-3 mt-2 flex-wrap justify-center">
            <Link href="/">
              <Button variant="primary" size="md">
                {t("hero.ctaDashboard")}
              </Button>
            </Link>
          </div>
        </div>
        {/* Decorative blobs */}
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-blue-100/40 blur-3xl pointer-events-none" />
      </section>

      <div className="px-6 flex flex-col gap-14 max-w-5xl mx-auto w-full">
        {/* Features */}
        <section className="flex flex-col gap-6">
          <SectionHeader title={t("features.title")} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((f) => (
              <Card key={f.title} className="p-5 flex flex-col gap-3">
                <div
                  className={`w-10 h-10 rounded-lg border flex items-center justify-center ${f.color}`}
                >
                  {f.icon}
                </div>
                <h3 className="font-semibold text-text text-sm">{f.title}</h3>
                <p className="text-text-muted text-sm leading-relaxed">
                  {f.description}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* Why AI */}
        <section className="flex flex-col gap-4">
          <SectionHeader title={t("importance.title")} />
          <Card className="p-6">
            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <BrainIcon />
              </div>
              <p className="text-text-muted text-sm leading-relaxed">
                {t("importance.body")}
              </p>
            </div>
          </Card>
        </section>

        {/* Pipeline */}
        <section className="flex flex-col gap-6">
          <SectionHeader
            title={t("pipeline.title")}
            subtitle={t("pipeline.subtitle")}
          />
          <Card className="p-6">
            <div className="flex items-start">
              {pipelineSteps.map((step, i) => (
                <div key={step.label} className="flex items-start flex-1">
                  <div className="flex flex-col items-center text-center flex-1 gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text">{step.label}</p>
                      <p className="text-xs text-text-muted mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                  {i < pipelineSteps.length - 1 && (
                    <div className="flex items-center pt-3 flex-shrink-0 text-text-muted px-1">
                      <ArrowRightIcon />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Screenshots */}
        <section className="flex flex-col gap-6">
          <SectionHeader
            title={t("screenshots.title")}
            subtitle={t("screenshots.subtitle")}
          />
          {/* Wide hero screenshot */}
          <div className="flex flex-col gap-2">
            <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-border shadow-md">
              <Image
                src={screenshots[0].src}
                alt={screenshots[0].alt}
                fill
                className="object-cover object-top"
                sizes="(max-width: 1024px) 100vw, 896px"
              />
            </div>
            <p className="text-center text-xs text-text-muted font-medium">
              {screenshots[0].caption}
            </p>
          </div>
          {/* 2x2 grid for the rest */}
          <div className="grid grid-cols-2 gap-4">
            {screenshots.slice(1).map((s) => (
              <div key={s.src} className="flex flex-col gap-2">
                <div className="relative aspect-video rounded-lg overflow-hidden border border-border shadow-sm">
                  <Image
                    src={s.src}
                    alt={s.alt}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 1024px) 50vw, 448px"
                  />
                </div>
                <p className="text-center text-xs text-text-muted font-medium">
                  {s.caption}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 15 Example Questions */}
        <section className="flex flex-col gap-6">
          <SectionHeader
            title={t("questions.title")}
            subtitle={t("questions.subtitle")}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {questions.map((group) => (
              <Card key={group.cat} className="p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary">
                    {group.cat}
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {group.items.map((q) => (
                    <li key={q} className="flex items-start gap-2 text-sm text-text-muted">
                      <span className="flex-shrink-0 mt-0.5 text-primary/60">
                        <ChatIcon />
                      </span>
                      <span className="leading-snug">{q}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>

        {/* Tech Stack */}
        <section className="flex flex-col gap-4">
          <SectionHeader title={t("stack.title")} />
          <div className="flex flex-wrap gap-2">
            {techStack.map((tech) => (
              <span
                key={tech}
                className="px-3 py-1.5 rounded-md border border-border bg-surface text-text-muted text-sm font-medium"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-bold text-text">{title}</h2>
      {subtitle && (
        <p className="text-sm text-text-muted">{subtitle}</p>
      )}
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function TrendingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 6l-9.5 9.5-5-5L1 18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 6h6v6" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="3" y="3" width="7" height="18" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="14" y="3" width="7" height="18" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 2a2.5 2.5 0 0 1 5 0v1a7 7 0 0 1 4.95 4.95A5.5 5.5 0 1 1 9.5 3.17V2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v10M9 10h6M9 14h6" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
