import { Database, Cpu, Cloud, Lock, Activity, FileBox, Zap } from "lucide-react";
import { CtaBand, PageHero, Section, SectionHeading } from "./_shared";

const STEPS = [
  { n: "01", title: "Register produce batches", text: "Each lot gets a batch ID with variety, supplier, origin, arrival quantity, storage location, packaging, transport and temperature records." },
  { n: "02", title: "Record inspections", text: "Inspectors score colour, appearance, firmness, damage, decay, ripeness, Brix and moisture loss. HarvestQuoin calculates the composite score and commercial grade, and records any culled quantity." },
  { n: "03", title: "Forecast quality changes", text: "The forecasting model projects quality forward using temperature, handling, ripeness, damage and supplier history — producing a predicted grade, trend, risk, confidence and review date." },
  { n: "04", title: "Create customer orders", text: "Capture each buyer's accepted grade, quantity, damage and decay limits, ripeness window, delivery date and location." },
  { n: "05", title: "Recommend batch allocations", text: "The allocation engine matches compatible batches to orders, preferring lots nearest their acceptance limit that still meet spec, and explains every choice." },
  { n: "06", title: "Approve dispatch", text: "Managers approve, modify or reject. Approved loads appear in the dispatch calendar and priority queue, and are tracked from loading to delivery." },
];

const AWS = [
  { icon: Cpu, name: "Amazon SageMaker AI", role: "Quality forecasting models" },
  { icon: Zap, name: "Amazon Bedrock", role: "Inspection note normalisation & summaries" },
  { icon: FileBox, name: "Amazon S3", role: "Batch datasets & documents" },
  { icon: Database, name: "Amazon DynamoDB", role: "Inventory, batches & orders" },
  { icon: Cloud, name: "AWS Lambda", role: "Allocation & processing" },
  { icon: Lock, name: "Amazon Cognito", role: "Authentication" },
  { icon: Activity, name: "Amazon CloudWatch", role: "Monitoring" },
];

export default function HowItWorks() {
  return (
    <>
      <PageHero eyebrow="How it works" title="Six steps from arrival to approved dispatch." text="A single workflow where every inspection and order automatically updates forecasts, priorities and recommendations." />
      <Section>
        <div className="relative mx-auto max-w-3xl">
          <div className="absolute bottom-0 left-6 top-0 w-px bg-gradient-to-b from-forest-300 via-lime-400 to-forest-300" />
          <div className="space-y-10">
            {STEPS.map((s) => (
              <div key={s.n} className="relative flex gap-6">
                <div className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full border-4 border-background bg-forest-800 font-display text-sm font-bold text-lime-300">{s.n}</div>
                <div className="pt-1.5">
                  <h3 className="text-xl font-semibold text-forest-950">{s.title}</h3>
                  <p className="mt-2 text-muted-foreground">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>
      <Section className="bg-earth-50">
        <SectionHeading center eyebrow="Architecture" title="Designed for AWS from day one." text="HarvestQuoin's services are structured around managed AWS building blocks for reliability, security and scale." />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AWS.map((a) => (
            <div key={a.name} className="rounded-2xl border bg-card p-5">
              <a.icon className="h-6 w-6 text-forest-600" />
              <div className="mt-3 font-semibold">{a.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">{a.role}</div>
            </div>
          ))}
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
