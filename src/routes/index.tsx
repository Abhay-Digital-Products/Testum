import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Countdown } from "@/components/countdown";
import { AuthDialog } from "@/components/auth-dialog";
import { SUPPORT } from "@/lib/support";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight, ShieldCheck, Monitor, BarChart3, CloudUpload, LineChart, FileText,
  BookOpen, Layers, Trophy, Check, CheckCircle2, Star, Zap, CalendarCheck, RefreshCw,
  FileQuestion, Sparkles, MessageCircle, Send, Mail, Menu, LayoutDashboard,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Testum - India's Most Affordable NEET CBT Test Series" },
      { name: "description", content: "Chapter-wise, part-syllabus and full-syllabus NEET CBT tests with real exam interface, AI analysis and PDF reports. Plans from ₹99, combo ₹149." },
      { property: "og:title", content: "Testum  -  NEET CBT Test Series 2027" },
      { property: "og:description", content: "Real CBT experience, AI performance analysis and detailed solutions. Plans from ₹99, combo pack ₹149." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const navLinks = [
  { href: "#free-tests", label: "Free Tests" },
  { href: "#pricing", label: "Plans & Pricing" },
  { href: "#features", label: "Features" },
  { href: "#results", label: "How It Works" },
  { href: "#faq", label: "FAQ" },
  { href: "#support", label: "Contact" },
];

const strip = [
  { Icon: FileText, v: "15,000+", l: "Tests Attempted" },
  { Icon: FileQuestion, v: "5,000+", l: "Quality Questions" },
  { Icon: BookOpen, v: "200+", l: "Chapters Covered" },
  { Icon: Zap, v: "98%", l: "Platform Uptime" },
];

const trustRow = ["CBT Experience", "Detailed Solutions", "Performance Analytics", "Secure & Reliable"];

const difference = [
  { Icon: Monitor, t: "Real CBT experience", d: "Practice in a real CBT environment with subject tabs, timer, review and exam-style flow." },
  { Icon: BarChart3, t: "Actionable test analysis", d: "Understand subject-wise and chapter-wise performance and focus on weak areas." },
  { Icon: CloudUpload, t: "Never lose an attempt", d: "Your answers, remaining time and current question are saved. Resume safely after a refresh." },
  { Icon: LineChart, t: "Full progress tracking", d: "Track your scores, accuracy and progress throughout your NEET 2027 preparation year." },
  { Icon: FileText, t: "PDF reports & solutions", d: "Download detailed performance reports with every question, your answer and the solution." },
];

const plans = [
  {
    t: "Chapter Wise", d: "Tests as per single chapters", price: 99, Icon: BookOpen,
    tone: "text-emerald-600 bg-emerald-50",
    points: ["Tests for all 79 NCERT chapters", "Topic-wise & subject-wise tests", "Regular chapter practice", "Detailed solutions", "Performance analysis"],
  },
  {
    t: "Part Syllabus", d: "Tests as per planned syllabus", price: 99, Icon: Layers,
    tone: "text-primary bg-primary/10",
    points: ["Tests based on planned syllabus", "Class 11 & 12 checkpoints", "Regular part-syllabus tests", "Detailed solutions", "Performance analysis"],
  },
  {
    t: "Full Syllabus", d: "Complete NEET-pattern mock tests", price: 99, Icon: Trophy,
    tone: "text-violet-600 bg-violet-50",
    points: ["Full-length NEET pattern tests", "Physics, Chemistry & Biology", "180 Q · 180 min simulation", "Detailed solutions", "CBT + PDF mode"],
  },
];

const trustBadges = [
  { Icon: ShieldCheck, t: "Secure Payments", d: "100% safe & trusted" },
  { Icon: Zap, t: "Instant Access", d: "Access tests immediately" },
  { Icon: CalendarCheck, t: "Valid till NEET 2027", d: "Study at your own pace" },
  { Icon: RefreshCw, t: "Refund Policy", d: "Please read the terms" },
];

const resultPoints = [
  "Correct, incorrect and unattempted split",
  "Time spent per subject and question",
  "Strong and weak chapter identification",
  "Performance tracking across your prep year",
];

const reportBars = [
  { s: "Physics", v: 152, m: 180 },
  { s: "Chemistry", v: 158, m: 180 },
  { s: "Botany", v: 171, m: 180 },
  { s: "Zoology", v: 161, m: 180 },
];

const faqs = [
  { q: "Is Testum only for NEET 2027 aspirants?", a: "The platform is built for NEET aspirants of any batch  -  Class 11, Class 12 and droppers. The default planner targets NEET 2027." },
  { q: "What does the ₹149 combo include?", a: "Chapter-wise, part-syllabus and full-syllabus test series  -  every test on the platform  -  in a single one-time payment." },
  { q: "Are the tests available in CBT mode?", a: "Yes. Every test runs in an NTA-style CBT player with a question palette, timer, mark-for-review and subject switching." },
  { q: "How long is my purchase valid?", a: "Your access stays active for the duration shown on the plan at the time of purchase  -  designed to cover your full preparation year." },
  { q: "Can I see my performance after the test?", a: "Instantly. You get score, accuracy, subject and chapter breakdown, AI weak-topic analysis and a downloadable PDF with every question and solution." },
  { q: "Do you provide refunds?", a: "Plans unlock instantly, so purchases are non-refundable. Failed or duplicate payments are always resolved  -  see our Refund Policy." },
];

function Home() {
  const [user, setUser] = useState<any>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [freeTests, setFreeTests] = useState<any[]>([]);

  const [activePlans, setActivePlans] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data }: any) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});

    const { data: sub } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setUser(session?.user ?? null);
    });

    // Fetch live plans from database
    supabase
      .from("plans")
      .select("*")
      .order("sort_order")
      .then(({ data }: any) => {
        if (data && data.length > 0) {
          setActivePlans(data);
        }
      })
      .catch(() => {});

    supabase
      .from("tests")
      .select("id, title, duration_minutes, total_questions, marks_correct, is_free, test_series(kind, title, plan_code)")
      .order("created_at", { ascending: false })
      .then(({ data }: any) => {
        const freeOnly = (data ?? []).filter((t: any) => t.is_free || !t.test_series?.plan_code || t.test_series?.plan_code === "free");
        setFreeTests(freeOnly);
      })
      .catch(() => {});

    return () => {
      if (sub?.subscription?.unsubscribe) {
        sub.subscription.unsubscribe();
      }
    };
  }, []);

  // Compute live prices dynamically from Supabase plans
  const planPriceMap = (code: string, fallback: number) => {
    const p = activePlans.find((x: any) => x.code === code);
    return p ? Number(p.price_inr) : fallback;
  };
  const isPlanActive = (code: string) => {
    const p = activePlans.find((x: any) => x.code === code);
    return p ? p.is_active : true;
  };
  const comboPrice = planPriceMap("combo", 149);
  const comboActive = isPlanActive("combo");

  return (
    <div className="min-h-screen bg-white text-[#0F172A] scroll-smooth">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-7 lg:flex">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-slate-600 transition hover:text-primary">{l.label}</a>
            ))}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            {user ? (
              <Button asChild size="sm" className="rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                <Link to="/app"><LayoutDashboard className="mr-1.5 h-4 w-4" /> Go to Dashboard</Link>
              </Button>
            ) : (
              <>
                <AuthDialog defaultTab="signin" trigger={<Button variant="outline" size="sm" className="rounded-lg border-slate-200 text-sm font-medium">Log in</Button>} />
                <AuthDialog defaultTab="signup" trigger={<Button size="sm" className="rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">Sign up</Button>} />
              </>
            )}
          </div>

          {/* Mobile Menu Drawer */}
          <div className="flex items-center gap-2 lg:hidden">
            {user && (
              <Button asChild size="sm" className="rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                <Link to="/app">Dashboard</Link>
              </Button>
            )}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-lg text-slate-700 hover:bg-slate-100">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-6">
                <SheetHeader className="text-left border-b border-slate-100 pb-4">
                  <SheetTitle><Logo /></SheetTitle>
                </SheetHeader>
                <div className="mt-6 flex flex-col gap-4">
                  {navLinks.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={() => setMobileOpen(false)}
                      className="text-base font-medium text-slate-700 transition hover:text-primary"
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
                <div className="mt-8 border-t border-slate-100 pt-6 flex flex-col gap-3">
                  {user ? (
                    <Button asChild size="lg" className="w-full rounded-xl bg-primary font-semibold text-primary-foreground">
                      <Link to="/app" onClick={() => setMobileOpen(false)}><LayoutDashboard className="mr-2 h-4 w-4" /> Go to Dashboard</Link>
                    </Button>
                  ) : (
                    <>
                      <AuthDialog defaultTab="signin" trigger={<Button variant="outline" size="lg" className="w-full rounded-xl border-slate-200 font-semibold" onClick={() => setMobileOpen(false)}>Log in</Button>} />
                      <AuthDialog defaultTab="signup" trigger={<Button size="lg" className="w-full rounded-xl bg-primary font-semibold text-primary-foreground" onClick={() => setMobileOpen(false)}>Sign up</Button>} />
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-14 pt-10 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:pb-20 lg:pt-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Built exclusively for NEET aspirants
            </span>
            <h1 className="mt-5 font-display text-[34px] font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
              India's most affordable<br />
              <span className="text-primary">NEET CBT</span> Test Series.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-600">
              Full-syllabus, part-syllabus, chapter-wise and daily practice  -  built to help you improve your score
              and secure your MBBS seat.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {user ? (
                <Button asChild size="lg" className="h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-elegant hover:bg-primary/90">
                  <Link to="/app">Go to Dashboard <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                </Button>
              ) : (
                <AuthDialog defaultTab="signup" trigger={
                  <Button size="lg" className="h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-elegant hover:bg-primary/90">
                    Start your first CBT test <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                } />
              )}
              <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-slate-200 px-6 font-semibold">
                <a href="#pricing">View plans</a>
              </Button>
            </div>
            <div className="mt-7 flex items-center gap-3">
              <div className="flex -space-x-2">
                {["A", "P", "R", "S"].map((c) => (
                  <span key={c} className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-primary/15 text-xs font-bold text-primary">{c}</span>
                ))}
              </div>
              <p className="text-xs text-slate-600"><b className="text-[#0F172A]">5000+</b> aspirants already improving with Testum</p>
            </div>
          </div>

          {/* Dashboard mockup */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-elegant sm:p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Student Dashboard</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Live</span>
            </div>

            <div className="mt-4 flex items-start justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Good morning</div>
                <div className="font-display text-lg font-bold">Ready to improve?</div>
              </div>
              <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">NEET 2027</span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {[
                { l: "Tests", v: "24", s: "▲ 12%" },
                { l: "Accuracy", v: "78.5%", s: "▲ 4.2%" },
                { l: "Score", v: "642", s: "/720" },
              ].map((c) => (
                <div key={c.l} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{c.l}</div>
                  <div className="mt-1 font-display text-xl font-extrabold">{c.v}</div>
                  <div className="text-[10px] font-medium text-emerald-600">{c.s}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl bg-hero p-4 text-primary-foreground">
              <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">Recommended next</div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-bold">NEET Full Syllabus Mock  -  26</div>
                  <div className="text-[10px] opacity-85">180 Questions · 180 Minutes</div>
                </div>
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-primary-foreground/40 text-xs font-bold">89%</div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] opacity-85">
                <span>● Ready to attempt</span><span>Instant scorecard</span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Performance</span>
              <span className="text-[10px] text-slate-500">Last 8 tests</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Attempt autosaved
            </div>
          </div>
        </div>

        {/* DARK STATS STRIP */}
        <div className="mx-auto max-w-6xl px-5 pb-4">
          <div className="rounded-2xl bg-[#0B1220] px-5 py-6 text-white shadow-2xl">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              {strip.map(({ Icon, v, l }) => (
                <div key={l} className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 text-primary-foreground"><Icon className="h-4 w-4" /></div>
                  <div className="min-w-0">
                    <div className="font-display text-lg font-extrabold text-white sm:text-xl">{v}</div>
                    <div className="truncate text-[11px] text-slate-400">{l}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 border-t border-white/10 pt-5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> NEET 2027 countdown
              </div>
              <div className="mt-3"><Countdown dark /></div>
            </div>
          </div>
        </div>

        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-5 pb-10 pt-4">
          {trustRow.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Check className="h-3.5 w-3.5 text-primary" />{t}
            </span>
          ))}
        </div>
      </section>

      {/* THE TESTUM DIFFERENCE */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16 scroll-mt-20">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">The Testum difference</span>
        <h2 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          Everything an aspirant needs between <span className="text-primary">practice</span> and <span className="text-primary">selection</span>.
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          A focused test platform designed to help you identify weak areas, improve accuracy and track your progress.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {difference.map(({ Icon, t, d }, i) => (
            <div key={t} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-elegant">
              <span className="absolute right-4 top-4 text-[10px] font-bold text-slate-300">0{i + 1}</span>
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
              <div className="mt-4 font-display text-sm font-bold">{t}</div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FREE TESTS SECTION */}
      <section id="free-tests" className="bg-gradient-to-b from-emerald-950/5 to-white py-16 scroll-mt-20 border-y border-emerald-100">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                <Sparkles className="h-3.5 w-3.5" /> 100% Free · No Payment Required
              </span>
              <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight sm:text-4xl">
                Start practicing with <span className="text-emerald-600">Free NEET CBT Tests</span>.
              </h2>
              <p className="mt-2 text-sm text-slate-600 max-w-xl">
                Experience real NTA exam interface, countdown timer, question palette, and instant scorecards without paying anything.
              </p>
            </div>
            {user ? (
              <Button asChild size="lg" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-soft">
                <Link to="/app/tests" search={{ tab: "free" }}>View All Free Tests <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
              </Button>
            ) : (
              <AuthDialog defaultTab="signup" trigger={
                <Button size="lg" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-soft">
                  Unlock Free Tests <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              } />
            )}
          </div>

          <div className="mt-10">
            {freeTests.length > 0 ? (
              <div className="grid gap-5 md:grid-cols-3">
                {freeTests.map((ft: any) => (
                  <div key={ft.id} className="flex flex-col justify-between rounded-2xl border border-emerald-200/80 bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-elegant">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200">
                          100% Free
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400 capitalize">{ft.test_series?.kind ?? "Mock Test"}</span>
                      </div>
                      <h3 className="mt-4 font-display text-lg font-bold leading-snug">{ft.title}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">{ft.test_series?.title ?? "NEET Practice Series"}</p>
                      <div className="mt-4 flex items-center gap-3 text-xs font-medium text-slate-500 border-t border-slate-100 pt-3">
                        <span>{ft.total_questions} Questions</span>
                        <span>·</span>
                        <span>{ft.duration_minutes} min</span>
                        <span>·</span>
                        <span>{ft.total_questions * (ft.marks_correct || 4)} Marks</span>
                      </div>
                    </div>
                    <div className="mt-6 pt-2">
                      {user ? (
                        <Button asChild className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                          <Link to="/app/tests/$testId" params={{ testId: ft.id }}>Attempt Test Now <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                        </Button>
                      ) : (
                        <AuthDialog defaultTab="signup" trigger={
                          <Button className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                            Attempt Test Now <ArrowRight className="ml-1.5 h-4 w-4" />
                          </Button>
                        } />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-white/70 p-8 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="mt-3 font-display font-semibold text-lg">Free Practice Tests</h3>
                <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">
                  New free tests created in your Supabase admin panel will automatically appear here for instant practice.
                </p>
                <div className="mt-5">
                  {user ? (
                    <Button asChild variant="outline" className="rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                      <Link to="/app/tests">Browse Test Portal <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                    </Button>
                  ) : (
                    <AuthDialog defaultTab="signup" trigger={
                      <Button variant="outline" className="rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                        Create Student Account <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    } />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-slate-50 py-16 scroll-mt-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Testum plans & pricing</span>
            <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight sm:text-4xl">
              Focused preparation.<br /><span className="text-primary">Aspirant-friendly</span> pricing.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600">
              Choose the plan that fits your preparation. Every purchase stays valid till NEET 2027.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {plans.filter(p => {
              const code = p.t.toLowerCase().includes("chapter") ? "chapter" : p.t.toLowerCase().includes("part") ? "part" : "full";
              return isPlanActive(code);
            }).map(({ t, d, price, Icon, tone, points }) => {
              const code = t.toLowerCase().includes("chapter") ? "chapter" : t.toLowerCase().includes("part") ? "part" : "full";
              const livePrice = planPriceMap(code, price);
              return (
              <div key={t} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-elegant">
                <div className="flex items-center gap-3">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div>
                  <div>
                    <div className="font-display text-base font-bold">{t}</div>
                    <div className="text-[11px] text-slate-500">{d}</div>
                  </div>
                </div>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-[13px] text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{p}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex items-end justify-between border-t border-slate-100 pt-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Only</div>
                    <div className="font-display text-3xl font-extrabold">₹{livePrice}</div>
                  </div>
                  {user ? (
                    <Button asChild variant="outline" className="rounded-xl border-primary/30 font-semibold text-primary hover:bg-primary/5">
                      <Link to="/app/pricing">View tests <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                    </Button>
                  ) : (
                    <AuthDialog defaultTab="signin" trigger={
                      <Button variant="outline" className="rounded-xl border-primary/30 font-semibold text-primary hover:bg-primary/5">
                        View tests <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    } />
                  )}
                </div>
              </div>
            );
          })}
          </div>

          {/* COMBO BANNER */}
          {comboActive && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600"><Star className="h-6 w-6 fill-amber-400 text-amber-500" /></div>
                <div>
                  <span className="rounded-full bg-amber-200/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">Best value</span>
                  <div className="mt-1.5 font-display text-lg font-extrabold">Get Everything</div>
                  <div className="text-xs text-slate-600">Chapter Wise + Part Syllabus + Full Syllabus</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {plans.map(({ t, Icon }, i) => (
                  <div key={t} className="flex items-center gap-3">
                    {i > 0 && <span className="text-slate-400">+</span>}
                    <div className="text-center">
                      <div className="mx-auto grid h-9 w-9 place-items-center rounded-lg bg-white text-primary shadow-soft"><Icon className="h-4 w-4" /></div>
                      <div className="mt-1 text-[10px] text-slate-600">{t}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Only</div>
                  <div className="font-display text-4xl font-extrabold text-amber-600">₹{comboPrice}</div>
                </div>
                {user ? (
                  <Button asChild size="lg" className="h-12 rounded-xl bg-amber-500 px-6 font-semibold text-white hover:bg-amber-600">
                    <Link to="/app/pricing">Get all plans now <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                  </Button>
                ) : (
                  <AuthDialog defaultTab="signup" trigger={
                    <Button size="lg" className="h-12 rounded-xl bg-amber-500 px-6 font-semibold text-white hover:bg-amber-600">
                      Get all plans now <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  } />
                )}
              </div>
            </div>
          </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
            {trustBadges.map(({ Icon, t, d }) => (
              <div key={t} className="flex items-center gap-3">
                <Icon className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="text-xs font-bold">{t}</div>
                  <div className="truncate text-[11px] text-slate-500">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RESULTS THAT TEACH */}
      <section id="results" className="mx-auto max-w-6xl px-5 py-16 scroll-mt-20">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Results that teach</span>
            <h2 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Your score is<br />only the <span className="text-primary">beginning</span>.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Testum turns every test into a clear performance story  -  what worked, where you lost marks and what
              to improve before your next test.
            </p>
            <ul className="mt-6 space-y-2.5">
              {resultPoints.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[13px] text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{p}
                </li>
              ))}
            </ul>
            {user ? (
              <Link to="/app/tests" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                Experience a free analysis <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <AuthDialog defaultTab="signup" trigger={
                <button className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                  Experience a free analysis <ArrowRight className="h-3.5 w-3.5" />
                </button>
              } />
            )}
          </div>

          {/* Performance report card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-elegant sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Full syllabus mock 05</div>
                <div className="font-display text-lg font-bold">Performance report</div>
              </div>
              <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600">Download PDF</span>
            </div>

            <div className="mt-6 grid items-center gap-6 sm:grid-cols-[auto_1fr]">
              <div className="mx-auto">
                <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#E2E8F0" strokeWidth="12" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#2563EB" strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 52 * 0.892} ${2 * Math.PI * 52}`} />
                </svg>
                <div className="-mt-[86px] text-center">
                  <div className="font-display text-3xl font-extrabold">642</div>
                  <div className="text-xs text-slate-400">/720</div>
                </div>
                <div className="mt-12 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Test accuracy</div>
                  <div className="font-display text-xl font-extrabold text-primary">89.2%</div>
                </div>
              </div>

              <div className="space-y-3.5">
                {reportBars.map(({ s, v, m }) => (
                  <div key={s}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{s}</span>
                      <span className="text-slate-500">{v} / {m}</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(v / m) * 100}%` }} />
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> AI weak-topic analysis included
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-slate-50 py-16 scroll-mt-20">
        <div className="mx-auto max-w-6xl px-5">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Questions, answered</span>
          <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight sm:text-4xl">Everything clear before you begin.</h2>
          <p className="mt-2 text-sm text-slate-600">
            Still need help? Our support team is one message away on WhatsApp or Telegram.
          </p>
          <Accordion type="single" collapsible className="mt-8 grid gap-3 lg:grid-cols-2">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`i${i}`} className="h-fit overflow-hidden rounded-xl border border-slate-200 bg-white px-4">
                <AccordionTrigger className="py-3.5 text-left text-[13px] font-semibold hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="pb-4 text-[13px] text-slate-600">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* SUPPORT + CTA BAND */}
      <section id="support" className="bg-hero py-14 text-primary-foreground scroll-mt-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-80">Support that actually replies</div>
          <div className="mt-3 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <h2 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                Practice smarter. Analyse every test.<br />Improve every week.
              </h2>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {user ? (
                  <Button asChild size="lg" className="h-12 rounded-xl bg-white px-6 font-semibold text-primary hover:bg-white/90">
                    <Link to="/app">Go to Dashboard</Link>
                  </Button>
                ) : (
                  <AuthDialog defaultTab="signup" trigger={
                    <Button size="lg" className="h-12 rounded-xl bg-white px-6 font-semibold text-primary hover:bg-white/90">
                      Start your first CBT test
                    </Button>
                  } />
                )}
                <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-white/40 bg-transparent px-6 font-semibold text-primary-foreground hover:bg-white/10">
                  <a href="#pricing">View plans</a>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <a href={SUPPORT.whatsapp} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 transition hover:bg-white/20">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15"><MessageCircle className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">WhatsApp support</span>
                  <span className="block truncate text-xs opacity-85">Chat with us instantly</span>
                </span>
              </a>
              <a href={SUPPORT.telegram} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 transition hover:bg-white/20">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15"><Send className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">Telegram channel</span>
                  <span className="block truncate text-xs opacity-85">{SUPPORT.telegramHandle}</span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0B1220] text-slate-400">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="font-display text-lg font-extrabold text-white">TESTUM</div>
            <p className="mt-3 text-xs leading-relaxed">
              A focused NEET CBT test platform. Practice. Analyse. Improve. Secure your future.
            </p>
            <a href={SUPPORT.telegram} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              Join our Telegram channel <ArrowRight className="h-3 w-3" />
            </a>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white">Platform</div>
            <ul className="mt-3 space-y-2 text-xs">
              <li><a href="#pricing" className="hover:text-primary">Plans & Pricing</a></li>
              <li><a href="#results" className="hover:text-primary">How It Works</a></li>
              <li><a href="#features" className="hover:text-primary">Features</a></li>
              <li><Link to="/app/tests" className="hover:text-primary">Test Series</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white">Company</div>
            <ul className="mt-3 space-y-2 text-xs">
              <li><Link to="/auth" className="hover:text-primary">Sign in</Link></li>
              <li><a href={SUPPORT.whatsapp} target="_blank" rel="noopener noreferrer" className="hover:text-primary">WhatsApp support</a></li>
              <li><a href={SUPPORT.telegram} target="_blank" rel="noopener noreferrer" className="hover:text-primary">Telegram {SUPPORT.telegramHandle}</a></li>
              <li><a href={`mailto:${SUPPORT.email}`} className="inline-flex items-center gap-1 hover:text-primary"><Mail className="h-3 w-3" />{SUPPORT.email}</a></li>
            </ul>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white">Legal</div>
            <ul className="mt-3 space-y-2 text-xs">
              <li><Link to="/privacy" className="hover:text-primary">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-primary">Terms & Conditions</Link></li>
              <li><Link to="/refund" className="hover:text-primary">Refund Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-4">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 text-[11px] sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} Testum. Built for NEET aspirants.</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" />Secure payments by Cashfree · No refund policy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
