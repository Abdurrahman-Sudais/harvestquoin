import { ContactForm } from "@/kit/LeadForms";
import { SITE } from "@/kit/site";

import { Mail, MapPin, Phone } from "lucide-react";

import { PageHero, Section } from "./_shared";

export default function Contact() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Let's talk about your dispatch operation." text="Tell us about your produce, warehouses and buyers. We'll show you HarvestQuoin with data that looks like yours." />
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-6">
            {[
              { i: Mail, t: "Email", v: SITE.email },
              { i: Phone, t: "Phone", v: "+234 (0) 700 000 0000" },
              { i: MapPin, t: "Offices", v: "Lagos · Abuja · Kano" },
            ].map((x) => (
              <div key={x.t} className="flex gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-forest-50 text-forest-700"><x.i className="h-5 w-5" /></div>
                <div><div className="text-sm text-muted-foreground">{x.t}</div><div className="font-medium">{x.v}</div></div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border bg-card p-6 sm:p-8">
            <ContactForm bare />
          </div>
        </div>
      </Section>
    </>
  );
}
