import { BarChart3, ClipboardCheck, FileDown, GitMerge, LayoutDashboard, Package, Sparkles, TrendingDown, Truck, ShoppingCart, Camera, Thermometer, Settings2, ShieldCheck } from "lucide-react";
import { DashboardShot, ForecastShot } from "@/components/marketing/ProductShots";
import { CtaBand, PageHero, Section, SectionHeading } from "./_shared";

const FEATURES = [
  { icon: LayoutDashboard, title: "Operations dashboard", text: "Active batches, available inventory, priority dispatches, orders awaiting allocation, deterioration risks and recent inspections — filterable by category, warehouse, supplier, status and arrival date." },
  { icon: Package, title: "Produce batch management", text: "Batch profiles with supplier, origin, arrival quantity, storage location, handling conditions, temperature records, inspection history and a full inventory ledger." },
  { icon: ClipboardCheck, title: "Configurable inspections", text: "Category-specific criteria for visual quality, physical condition, damage, ripeness and measurements. Composite scores and grades calculated consistently." },
  { icon: Camera, title: "Photos & documents", text: "Attach inspection photographs, checklists and lab certificates to each record — structured for Amazon S3 storage." },
  { icon: TrendingDown, title: "AI quality forecasting", text: "Predicted commercial grade, quality trend, acceptance-limit risk, confidence and recommended review date. Always labelled as an estimate." },
  { icon: ShoppingCart, title: "Customer order management", text: "Accepted grade, quantity, damage/decay limits, ripeness window, delivery date and special requirements for any number of concurrent buyers." },
  { icon: GitMerge, title: "Intelligent batch allocation", text: "Explainable batch-to-order recommendations. Approve, modify or reject — with hard guards against over-allocation." },
  { icon: Truck, title: "Dispatch prioritisation", text: "Priority queue ranked by deterioration risk, deadlines, acceptance limits, age, quantity and storage. Calendar, schedule and status tracking." },
  { icon: Sparkles, title: "AI inspection assistant", text: "Structure free-text notes, summarise reports, flag missing information, explain priorities and draft dispatch plans. Built for Amazon Bedrock." },
  { icon: BarChart3, title: "Reports & analytics", text: "Quality trends, inventory distribution, predicted changes, allocation, dispatch performance, rejections and near-limit inventory." },
  { icon: FileDown, title: "PDF & CSV exports", text: "Every report exports to branded PDF or CSV for buyers, auditors and management." },
  { icon: Settings2, title: "Grading configuration", text: "Adjust grade thresholds, criterion weights and hard limits per produce category to match your commercial standards." },
];

export default function Features() {
  return (
    <>
      <PageHero eyebrow="Features" title="Everything between the arrival bay and the buyer's dock." text="HarvestQuoin brings inspections, inventory, forecasting, orders and dispatch together so every load decision is grounded in quality data." />
      <Section>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-2xl border bg-card p-6 transition-shadow hover:shadow-lg">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-forest-50 text-forest-700 transition-colors group-hover:bg-lime-300 group-hover:text-forest-900">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section className="bg-earth-50">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Accuracy by design" title="Deterministic where it matters." text="Inventory arithmetic and allocation logic are exact and reproducible: integer kilograms, a single ledger per batch, and a fixed operating date for every calculation. AI estimates inform decisions — they never silently change stock." />
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-forest-600" /> Allocations are validated against available stock and remaining order quantity before they are saved.</div>
              <div className="flex gap-3"><Thermometer className="h-5 w-5 shrink-0 text-forest-600" /> Forecasts use logged temperatures where available and reduce confidence when they are not.</div>
            </div>
          </div>
          <div className="space-y-6">
            <DashboardShot />
            <ForecastShot className="sm:ml-16" />
          </div>
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
