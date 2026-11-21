import { Link } from "react-router-dom";
import { ArrowRight, ClipboardCheck, GitMerge, Package, ShieldCheck, Sparkles, Thermometer, TrendingDown, Truck, ShoppingCart, Warehouse, Users, Building2, Store, FlaskConical, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProducePhoto } from "@/components/shared";
import { AllocationShot, DashboardShot, ForecastShot } from "@/components/marketing/ProductShots";
import { CtaBand, Section, SectionHeading } from "./_shared";

const WORKFLOW = [
  { icon: Package, title: "Register batches", text: "Capture supplier, origin, arrival quantity, handling and storage for every lot." },
  { icon: ClipboardCheck, title: "Record inspections", text: "Score colour, firmness, damage, decay and ripeness against your own criteria." },
  { icon: TrendingDown, title: "Forecast quality", text: "Estimate how commercial grade may change given temperature and handling." },
  { icon: ShoppingCart, title: "Capture buyer orders", text: "Accepted grade, quantity, quality specs and delivery deadlines per customer." },
  { icon: GitMerge, title: "Recommend allocations", text: "Match batches to orders with explainable, inventory-safe recommendations." },
  { icon: Truck, title: "Approve dispatch", text: "Prioritise loads before quality becomes a problem, and track every delivery." },
];

const SEGMENTS = [
  { icon: Warehouse, label: "Produce aggregators" },
  { icon: Building2, label: "Packing houses" },
  { icon: Users, label: "Agricultural cooperatives" },
  { icon: Store, label: "Fresh-food wholesalers" },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-earth-50">
        <div className="absolute inset-0 bg-grain opacity-60" />
        <div className="absolute -right-40 top-10 h-[480px] w-[480px] rounded-full bg-lime-300/30 blur-3xl" />
        <div className="container relative grid items-center gap-12 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-forest-200 bg-card px-3 py-1 text-xs font-medium text-forest-700">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-500" /> Agricultural supply chain intelligence
            </div>
            <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.08] text-forest-950 sm:text-5xl lg:text-[56px]">
              Know Which Produce to Dispatch <span className="text-forest-600">Before Quality Becomes a Problem.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              HarvestQuoin connects produce inspection records, handling conditions, inventory, and buyer requirements to help agricultural businesses make smarter dispatch decisions.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link to="/register">Start free pilot <ArrowRight /></Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Explore the live demo</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-forest-800/80">
              {["Configurable grading", "Inventory-safe allocation", "Explainable recommendations"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-forest-600" /> {t}</span>
              ))}
            </div>
          </div>
          <div className="relative">
            <ProducePhoto name="hero" alt="Fresh tomatoes in harvest crates" className="absolute -right-6 -top-6 hidden h-56 w-56 rounded-2xl shadow-xl sm:block lg:h-64 lg:w-64" />
            <DashboardShot className="relative mt-10 sm:mr-16 sm:mt-24" />
            <div className="absolute -bottom-6 left-4 hidden items-center gap-3 rounded-xl border bg-card p-3 shadow-lg sm:flex">
              <div className="rounded-lg bg-red-100 p-2 text-red-600"><Thermometer className="h-4 w-4" /></div>
              <div className="text-xs">
                <div className="font-semibold">Ambient Bay A · 29.5°C</div>
                <div className="text-muted-foreground">2 batches flagged for priority dispatch</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Segments */}
      <section className="border-y bg-card">
        <div className="container flex flex-col items-center gap-4 py-6 md:flex-row md:justify-between">
          <span className="text-sm font-medium text-muted-foreground">Built for fresh produce operators</span>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:flex">
            {SEGMENTS.map((s) => (
              <span key={s.label} className="inline-flex items-center gap-2 text-sm font-semibold text-forest-800">
                <s.icon className="h-4 w-4 text-forest-500" /> {s.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              eyebrow="The dispatch problem"
              title="Produce doesn't wait for your spreadsheet."
              text="Batches arrive with different histories — a cool reefer run, an open truck in the midday heat, a crushed bottom layer of raffia baskets. When dispatch is planned first-in-first-out, buyers receive fruit that no longer meets their spec, and premium lots are wasted on processing orders."
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { k: "Quality-first", v: "Rank by deterioration risk, not just arrival date" },
                { k: "Buyer-aware", v: "Match grade and spec to each customer's acceptance limits" },
                { k: "Traceable", v: "Every decision linked to inspections and handling history" },
              ].map((x) => (
                <div key={x.k} className="rounded-xl border bg-card p-4">
                  <div className="font-display font-bold text-forest-800">{x.k}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{x.v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ProducePhoto name="crates" alt="Tomatoes packed in crates" className="h-64 w-full rounded-2xl sm:h-80" />
            <ProducePhoto name="market" alt="Fresh produce market" className="mt-10 h-64 w-full rounded-2xl sm:h-80" />
          </div>
        </div>
      </Section>

      {/* Workflow */}
      <Section className="bg-forest-950 text-white">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-lime-400">One connected workflow</div>
          <h2 className="text-balance text-3xl font-bold sm:text-4xl">From arrival bay to buyer's dock</h2>
          <p className="mt-4 text-forest-100/75">Every step feeds the next, so recommendations are always grounded in your actual inspection records and inventory.</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WORKFLOW.map((w, i) => (
            <div key={w.title} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime-400 text-forest-950"><w.icon className="h-5 w-5" /></span>
                <span className="font-display text-sm text-lime-300/80">Step {i + 1}</span>
              </div>
              <div className="mt-4 font-display text-lg font-semibold">{w.title}</div>
              <p className="mt-1.5 text-sm text-forest-100/70">{w.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Feature: forecast */}
      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <ForecastShot />
          <div>
            <SectionHeading
              eyebrow="Quality forecasting"
              title="See where each batch is heading — clearly labelled as a forecast."
              text="HarvestQuoin estimates how commercial quality may change using arrival date, handling, storage temperature, inspection scores and supplier history. Inspection grades and predicted grades are always shown separately, with confidence levels and a recommended review date."
            />
            <ul className="mt-6 space-y-3 text-sm">
              {["Predicted commercial grade and quality trend", "Acceptance-limit risk with confidence level", "Driver breakdown: temperature, packaging, ripeness, damage", "Built for Amazon SageMaker AI model deployment"].map((t) => (
                <li key={t} className="flex gap-2"><FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" /> {t}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Feature: allocation */}
      <Section className="bg-earth-50">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <SectionHeading
              eyebrow="Intelligent allocation"
              title="Recommendations your warehouse managers can trust."
              text="For every open order, HarvestQuoin proposes the most suitable batches — checking category, variety, available quantity, current and predicted grade, damage and decay limits, ripeness at delivery and dispatch date. Managers approve, modify or reject with one click."
            />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { i: ShieldCheck, t: "Never over-allocates", d: "Deterministic inventory ledger blocks any allocation above available stock." },
                { i: Sparkles, t: "Explains every match", d: "Plain-language reasons for each recommendation." },
              ].map((x) => (
                <div key={x.t} className="rounded-xl border bg-card p-4">
                  <x.i className="h-5 w-5 text-forest-600" />
                  <div className="mt-2 font-semibold">{x.t}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{x.d}</div>
                </div>
              ))}
            </div>
          </div>
          <AllocationShot className="order-1 lg:order-2" />
        </div>
      </Section>

      {/* Photo band */}
      <section className="relative h-72 overflow-hidden sm:h-96">
        <ProducePhoto name="field" alt="Farmland at harvest" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-r from-forest-950/85 via-forest-950/50 to-transparent" />
        <div className="container relative flex h-full items-center">
          <div className="max-w-lg text-white">
            <div className="font-display text-2xl font-bold sm:text-3xl">Freshness, efficiency and traceability — from farm gate to buyer.</div>
            <p className="mt-3 text-forest-100/80">Starting with fresh tomatoes, with configurable grading for each produce category you handle.</p>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
