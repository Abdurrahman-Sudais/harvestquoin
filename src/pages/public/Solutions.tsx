import { Building2, Store, Users, Warehouse, Check } from "lucide-react";
import { ProducePhoto } from "@/components/shared";
import { CtaBand, PageHero, Section } from "./_shared";

const SOLUTIONS = [
  { icon: Warehouse, title: "Produce aggregators", photo: "crates", text: "Consolidate lots from many smallholders with very different handling. Spot the batches that travelled badly and move them first.", points: ["Supplier-level quality history", "Arrival inspection at scale", "Route weaker lots to processors"] },
  { icon: Building2, title: "Packing houses", photo: "produce", text: "Grade consistently across shifts and inspectors, then pack to each buyer's specification with a clear view of cold-room capacity.", points: ["Configurable grading criteria", "Cold-room temperature records", "Pre-dispatch inspections"] },
  { icon: Users, title: "Agricultural cooperatives", photo: "field", text: "Give member farmers transparent feedback on quality and rejections, and negotiate better offtake with buyers using evidence.", points: ["Member batch traceability", "Rejection records with reasons", "Exportable quality reports"] },
  { icon: Store, title: "Fresh-food wholesalers", photo: "market", text: "Serve retailers, food service and processors simultaneously — each with their own acceptance limits — without over-committing stock.", points: ["Multi-buyer allocation", "Delivery deadline tracking", "Dispatch performance analytics"] },
];

export default function Solutions() {
  return (
    <>
      <PageHero eyebrow="Solutions" title="Built for every link in the fresh produce chain." text="Whether you aggregate, pack, market collectively or wholesale, HarvestQuoin adapts to your grading standards and your buyers." />
      <Section>
        <div className="space-y-16">
          {SOLUTIONS.map((s, i) => (
            <div key={s.title} className="grid items-center gap-10 lg:grid-cols-2">
              <ProducePhoto name={s.photo} alt={s.title} className={`h-72 w-full rounded-2xl sm:h-80 ${i % 2 ? "lg:order-2" : ""}`} />
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-700">
                  <s.icon className="h-3.5 w-3.5" /> {s.title}
                </div>
                <h2 className="mt-4 text-3xl font-bold text-forest-950">{s.title}</h2>
                <p className="mt-3 text-muted-foreground">{s.text}</p>
                <ul className="mt-5 space-y-2">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm"><span className="grid h-5 w-5 place-items-center rounded-full bg-lime-300 text-forest-900"><Check className="h-3 w-3" /></span> {p}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
