import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Section({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`py-16 sm:py-24 ${className}`}>
      <div className="container">{children}</div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, text, center = false }: { eyebrow?: string; title: ReactNode; text?: ReactNode; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-forest-600">{eyebrow}</div>}
      <h2 className="text-balance text-3xl font-bold text-forest-950 sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">{text}</p>}
    </div>
  );
}

export function PageHero({ eyebrow, title, text, children }: { eyebrow: string; title: ReactNode; text: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b bg-earth-50">
      <div className="absolute inset-0 bg-grain opacity-60" />
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-lime-300/30 blur-3xl" />
      <div className="container relative py-16 sm:py-20">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-forest-600">{eyebrow}</div>
        <h1 className="max-w-3xl text-balance text-4xl font-extrabold text-forest-950 sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{text}</p>
        {children}
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="py-16 sm:py-20">
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl bg-forest-900 px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="absolute inset-0 bg-grain opacity-20" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-lime-400/20 blur-3xl" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-balance text-3xl font-bold text-white sm:text-4xl">Dispatch the right batch, to the right buyer, at the right time.</h2>
            <p className="mt-4 text-forest-100/80">Start a 30-day pilot with your own batches and buyer specifications. We'll configure your grading criteria with your quality team.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" variant="lime" asChild>
                <Link to="/register">Start free pilot <ArrowRight /></Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10" asChild>
                <Link to="/login">Explore the live demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
