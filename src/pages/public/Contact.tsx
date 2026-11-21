import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHero, Section } from "./_shared";

const schema = z.object({
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Enter a valid work email"),
  company: z.string().min(2, "Company is required"),
  segment: z.string().min(1, "Select your business type"),
  message: z.string().min(10, "Tell us a little more (10+ characters)"),
});
type F = z.infer<typeof schema>;

export default function Contact() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<F>({ resolver: zodResolver(schema), defaultValues: { segment: "" } });
  const onSubmit = async () => {
    await new Promise((r) => setTimeout(r, 500));
    setSent(true);
    toast.success("Message received — we'll be in touch within one business day.");
  };
  return (
    <>
      <PageHero eyebrow="Contact" title="Let's talk about your dispatch operation." text="Tell us about your produce, warehouses and buyers. We'll show you HarvestQuoin with data that looks like yours." />
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-6">
            {[
              { i: Mail, t: "Email", v: "hello@harvestquoin.com" },
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
            {sent ? (
              <div className="py-10 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-forest-600" />
                <div className="mt-4 font-display text-xl font-bold">Thank you!</div>
                <p className="mt-2 text-muted-foreground">Our team will contact you within one business day.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
                <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" {...register("name")} />{errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}</div>
                <div className="space-y-1.5"><Label htmlFor="email">Work email</Label><Input id="email" type="email" {...register("email")} />{errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}</div>
                <div className="space-y-1.5"><Label htmlFor="company">Company</Label><Input id="company" {...register("company")} />{errors.company && <p className="text-xs text-red-600">{errors.company.message}</p>}</div>
                <div className="space-y-1.5">
                  <Label>Business type</Label>
                  <Select onValueChange={(v) => setValue("segment", v, { shouldValidate: true })}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {["Produce aggregator", "Packing house", "Agricultural cooperative", "Fresh-food wholesaler", "Other"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.segment && <p className="text-xs text-red-600">{errors.segment.message}</p>}
                </div>
                <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="message">How can we help?</Label><Textarea id="message" rows={5} {...register("message")} />{errors.message && <p className="text-xs text-red-600">{errors.message.message}</p>}</div>
                <div className="sm:col-span-2"><Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">{isSubmitting ? "Sending…" : "Send message"}</Button></div>
              </form>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
