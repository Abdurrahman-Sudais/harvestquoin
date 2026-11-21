import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CtaBand, PageHero, Section } from "./_shared";

const PLANS = [
  { name: "Pilot", price: "Free", period: "30 days", text: "Prove value with your own batches and buyers.", features: ["1 warehouse", "1 produce category", "Up to 50 batches", "Simulated forecasting", "Email support"], cta: "Start pilot", to: "/register" },
  { name: "Growth", price: "$490", period: "per month", text: "For aggregators and packhouses running daily dispatch.", features: ["Up to 3 warehouses", "1 produce category", "Unlimited batches & orders", "AI quality forecasting", "AI inspection assistant", "PDF & CSV reports"], cta: "Choose Growth", to: "/register", featured: true },
  { name: "Enterprise", price: "Custom", period: "annual", text: "Multi-site operations, cooperatives and wholesalers.", features: ["Unlimited warehouses", "Multiple produce categories", "Custom forecasting models", "SSO via Amazon Cognito", "Dedicated onboarding", "SLA & priority support"], cta: "Talk to sales", to: "/contact" },
];

export default function Pricing() {
  return (
    <>
      <PageHero eyebrow="Pricing" title="Simple plans that scale with your throughput." text="Start with a free pilot. Upgrade when HarvestQuoin is running your daily dispatch." />
      <Section>
        <div className="grid gap-6 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.name} className={cn("relative flex flex-col rounded-2xl border bg-card p-7", p.featured && "border-forest-700 shadow-xl ring-1 ring-forest-700")}>
              {p.featured && <span className="absolute -top-3 left-7 rounded-full bg-lime-400 px-3 py-0.5 text-xs font-bold text-forest-950">Most popular</span>}
              <div className="font-display text-lg font-bold">{p.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">{p.text}</div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-4xl font-extrabold text-forest-950">{p.price}</span>
                <span className="text-sm text-muted-foreground">{p.period}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-forest-600" /> {f}</li>
                ))}
              </ul>
              <Button className="mt-8" variant={p.featured ? "default" : "outline"} asChild>
                <Link to={p.to}>{p.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">Prices exclude applicable taxes. Volume pricing available for cooperatives and member networks.</p>
      </Section>
      <CtaBand />
    </>
  );
}
