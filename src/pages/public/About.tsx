import { Leaf, Eye, Gauge } from "lucide-react";
import { ProducePhoto } from "@/components/shared";
import { CtaBand, PageHero, Section, SectionHeading } from "./_shared";

const FOUNDERS = [
  { name: "Oluwaseun Adeyemi", role: "Founder", initials: "OA", text: "Leads product and engineering, focused on turning inspection and logistics data into dispatch decisions warehouse teams can act on." },
  { name: "Hauwa Musa", role: "Co-founder", initials: "HM", text: "Leads operations and partnerships with aggregators, cooperatives and buyers, shaping how grading and acceptance criteria are configured." },
];

const VALUES = [
  { icon: Leaf, title: "Freshness first", text: "Every feature exists to get produce to the right buyer while it still meets their standard." },
  { icon: Eye, title: "Honest intelligence", text: "We clearly separate inspection facts from forecasts, and we never promise shelf life." },
  { icon: Gauge, title: "Operational clarity", text: "Simple, explainable recommendations that fit how warehouse teams actually work." },
];

export default function About() {
  return (
    <>
      <PageHero eyebrow="About HarvestQuoin" title="Plan dispatch around produce quality." text="We build supply chain intelligence for the businesses that move fresh produce from farms to markets — helping them decide what to dispatch, to whom, and when." />
      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Our story" title="Quality changes every day. Dispatch plans should too." />
            <div className="mt-5 space-y-4 text-muted-foreground">
              <p>Fresh produce businesses make dozens of dispatch decisions every day with incomplete information: inspection sheets in one place, temperature logs in another, buyer specifications in someone's inbox.</p>
              <p>HarvestQuoin connects those records into one view, estimates how each batch's commercial quality may change, and recommends which batches should fulfil which orders — so less produce is downgraded, rejected or wasted.</p>
              <p>We are starting with fresh tomatoes, one of the most perishable and widely traded crops, with grading that each customer can configure to their own standards.</p>
            </div>
          </div>
          <ProducePhoto name="vine" alt="Tomatoes ripening on the vine" className="h-80 w-full rounded-2xl sm:h-96" />
        </div>
      </Section>
      <Section className="bg-earth-50">
        <SectionHeading center eyebrow="Leadership" title="Meet the founders" />
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
          {FOUNDERS.map((f) => (
            <div key={f.name} className="rounded-2xl border bg-card p-7">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-forest-800 font-display text-xl font-bold text-lime-300">{f.initials}</div>
                <div>
                  <div className="font-display text-lg font-bold">{f.name}</div>
                  <div className="text-sm font-medium text-forest-600">{f.role}</div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section>
        <div className="grid gap-6 md:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-2xl border bg-card p-6">
              <v.icon className="h-6 w-6 text-forest-600" />
              <div className="mt-3 font-display text-lg font-semibold">{v.title}</div>
              <p className="mt-1.5 text-sm text-muted-foreground">{v.text}</p>
            </div>
          ))}
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
