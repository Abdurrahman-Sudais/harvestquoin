import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { addDays } from "@/lib/dates";

const ANY = "__any";

export function OrderFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { state, addOrder } = useStore();
  const nav = useNavigate();
  const cat = state.categories[0];
  const schema = z.object({
    customer: z.string().min(2, "Customer name is required"),
    customerType: z.enum(["Retailer", "Processor", "Wholesaler", "Food Service", "Exporter"]),
    categoryId: z.string().min(1),
    variety: z.string(),
    requiredQtyKg: z.coerce.number({ invalid_type_error: "Enter a quantity" }).int("Whole kilograms only").positive("Must be greater than 0"),
    acceptedGrade: z.enum(["A", "B", "C"]),
    maxDamagePct: z.coerce.number().min(0).max(100),
    maxDecayPct: z.coerce.number().min(0).max(100),
    minFirmness: z.union([z.literal(""), z.coerce.number().min(1).max(10)]),
    acceptedRipeness: z.array(z.number()).min(1, "Select at least one ripeness stage"),
    deliveryDate: z.string().min(1).refine((d) => d >= state.today, "Delivery date cannot be in the past"),
    transitDays: z.coerce.number().int().min(0).max(10),
    deliveryLocation: z.string().min(3, "Delivery location is required"),
    specialRequirements: z.string().max(500),
  }).refine((v) => v.deliveryDate >= addDays(state.today, v.transitDays), { message: "Delivery is too soon for the transit time", path: ["transitDays"] });
  type F = z.infer<typeof schema>;
  const defaults: F = { customer: "", customerType: "Retailer", categoryId: cat.id, variety: ANY, requiredQtyKg: "" as unknown as number, acceptedGrade: "A", maxDamagePct: 5, maxDecayPct: 1, minFirmness: 7, acceptedRipeness: [2, 3, 4], deliveryDate: addDays(state.today, 3), transitDays: 1, deliveryLocation: "", specialRequirements: "" };
  const { register, handleSubmit, control, reset, setValue, formState: { errors, isSubmitting } } = useForm<F>({ resolver: zodResolver(schema), defaultValues: defaults });
  useEffect(() => { if (open) reset(defaults); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const presets: Record<string, Partial<F>> = {
    Retailer: { acceptedGrade: "A", maxDamagePct: 5, maxDecayPct: 1, minFirmness: 7, acceptedRipeness: [2, 3, 4] },
    Wholesaler: { acceptedGrade: "B", maxDamagePct: 10, maxDecayPct: 3, minFirmness: "", acceptedRipeness: [1, 2, 3, 4, 5] },
    "Food Service": { acceptedGrade: "B", maxDamagePct: 8, maxDecayPct: 2, minFirmness: "", acceptedRipeness: [3, 4, 5] },
    Processor: { acceptedGrade: "C", maxDamagePct: 20, maxDecayPct: 6, minFirmness: "", acceptedRipeness: [3, 4, 5] },
    Exporter: { acceptedGrade: "A", maxDamagePct: 3, maxDecayPct: 0, minFirmness: 8, acceptedRipeness: [1, 2] },
  };

  const onSubmit = (v: F) => {
    const r = addOrder({
      customer: v.customer.trim(), customerType: v.customerType, categoryId: v.categoryId, variety: v.variety === ANY ? null : v.variety, requiredQtyKg: v.requiredQtyKg, acceptedGrade: v.acceptedGrade,
      spec: { maxDamagePct: v.maxDamagePct, maxDecayPct: v.maxDecayPct, acceptedRipeness: [...v.acceptedRipeness].sort(), minFirmness: v.minFirmness === "" ? undefined : v.minFirmness },
      deliveryDate: v.deliveryDate, deliveryLocation: v.deliveryLocation, transitDays: v.transitDays, specialRequirements: v.specialRequirements, manualStatus: "open",
    });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Order ${r.value.code} created`, { description: "Allocation recommendations updated." });
    onOpenChange(false);
    nav(`/app/orders/${r.value.id}`);
  };
  const E = ({ m }: { m?: string }) => (m ? <p className="text-xs text-red-600">{m}</p> : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Create customer order</DialogTitle><DialogDescription>Step 4 of the workflow. Buyer acceptance criteria drive batch compatibility.</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <fieldset className="grid gap-4 sm:grid-cols-3">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</legend>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cust">Customer name</Label><Input id="cust" list="customers" {...register("customer")} /><datalist id="customers">{[...new Set(state.orders.map((o) => o.customer))].map((c) => <option key={c} value={c} />)}</datalist><E m={errors.customer?.message} /></div>
            <div className="space-y-1.5"><Label>Customer type</Label>
              <Controller control={control} name="customerType" render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => { field.onChange(v); const p = presets[v]; if (p) Object.entries(p).forEach(([k, val]) => setValue(k as keyof F, val as never)); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(presets).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </div>
          </fieldset>
          <fieldset className="grid gap-4 sm:grid-cols-4">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product & quality specification</legend>
            <div className="space-y-1.5"><Label>Category</Label><Controller control={control} name="categoryId" render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{state.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>} /></div>
            <div className="space-y-1.5"><Label>Variety</Label><Controller control={control} name="variety" render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ANY}>Any variety</SelectItem>{cat.varieties.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>} /></div>
            <div className="space-y-1.5"><Label htmlFor="qty">Required (kg)</Label><Input id="qty" type="number" step={1} {...register("requiredQtyKg")} /><E m={errors.requiredQtyKg?.message} /></div>
            <div className="space-y-1.5"><Label>Accepted grade (min)</Label><Controller control={control} name="acceptedGrade" render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{cat.grades.filter((g) => g.code !== "R").map((g) => <SelectItem key={g.code} value={g.code}>{g.label}</SelectItem>)}</SelectContent></Select>} /></div>
            <div className="space-y-1.5"><Label htmlFor="md">Max damage %</Label><Input id="md" type="number" step={0.5} {...register("maxDamagePct")} /></div>
            <div className="space-y-1.5"><Label htmlFor="mdc">Max decay %</Label><Input id="mdc" type="number" step={0.5} {...register("maxDecayPct")} /></div>
            <div className="space-y-1.5"><Label htmlFor="mf">Min firmness (1–10)</Label><Input id="mf" type="number" step={1} placeholder="optional" {...register("minFirmness")} /></div>
            <div className="space-y-1.5 sm:col-span-4"><Label>Accepted ripeness at delivery</Label>
              <Controller control={control} name="acceptedRipeness" render={({ field }) => (
                <div className="flex flex-wrap gap-3">{cat.ripenessStages.map((s, i) => (
                  <label key={s} className="flex items-center gap-1.5 text-sm"><Checkbox checked={field.value.includes(i)} onCheckedChange={(c) => field.onChange(c ? [...field.value, i] : field.value.filter((x) => x !== i))} />{s}</label>
                ))}</div>
              )} />
              <E m={errors.acceptedRipeness?.message} />
            </div>
          </fieldset>
          <fieldset className="grid gap-4 sm:grid-cols-4">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivery</legend>
            <div className="space-y-1.5"><Label htmlFor="dd">Delivery date</Label><Input id="dd" type="date" min={state.today} {...register("deliveryDate")} /><E m={errors.deliveryDate?.message} /></div>
            <div className="space-y-1.5"><Label htmlFor="td">Transit (days)</Label><Input id="td" type="number" step={1} {...register("transitDays")} /><E m={errors.transitDays?.message} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="dl">Delivery location</Label><Input id="dl" {...register("deliveryLocation")} /><E m={errors.deliveryLocation?.message} /></div>
            <div className="space-y-1.5 sm:col-span-4"><Label htmlFor="sr">Special requirements</Label><Textarea id="sr" rows={2} {...register("specialRequirements")} /></div>
          </fieldset>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={isSubmitting}>Create order</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
