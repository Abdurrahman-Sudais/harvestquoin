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
import { PACKAGING, STORAGE, TRANSPORT } from "@/lib/labels";

const schema = z
  .object({
    categoryId: z.string().min(1),
    variety: z.string().min(1, "Select a variety"),
    supplierId: z.string().min(1, "Select a supplier"),
    origin: z.string().min(2, "Origin is required"),
    harvestDate: z.string().optional(),
    arrivalDate: z.string().min(1, "Arrival date is required"),
    arrivalQtyKg: z.coerce.number({ invalid_type_error: "Enter a quantity" }).int("Whole kilograms only").positive("Must be greater than 0").max(200000, "Unusually large — check the quantity"),
    warehouseId: z.string().min(1, "Select a warehouse"),
    storageLocation: z.string().min(1, "Select a storage location"),
    packaging: z.enum(["ventilated_crates", "plastic_crates", "raffia_baskets", "bulk_sacks"]),
    transport: z.enum(["reefer_truck", "covered_truck", "open_truck"]),
    transitHours: z.coerce.number().min(0).max(240),
    precooled: z.boolean(),
    storageType: z.enum(["cold_room", "evaporative_cooler", "ambient_shaded"]),
    initialTempC: z.union([z.literal(""), z.coerce.number().min(-5).max(50)]).optional(),
    notes: z.string().optional(),
  })
  .refine((v) => !v.harvestDate || v.harvestDate <= v.arrivalDate, { message: "Harvest date must be on or before arrival", path: ["harvestDate"] });

type F = z.infer<typeof schema>;

export function BatchFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { state, addBatch } = useStore();
  const nav = useNavigate();
  const cat = state.categories[0];
  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: { categoryId: cat.id, variety: "", supplierId: "", origin: "", arrivalDate: state.today, warehouseId: "", storageLocation: "", packaging: "plastic_crates", transport: "covered_truck", transitHours: 12, precooled: false, storageType: "cold_room", initialTempC: "", notes: "" },
  });
  useEffect(() => { if (open) reset({ categoryId: cat.id, variety: "", supplierId: "", origin: "", arrivalDate: state.today, warehouseId: "", storageLocation: "", packaging: "plastic_crates", transport: "covered_truck", transitHours: 12, precooled: false, storageType: "cold_room", initialTempC: "", notes: "" }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const wh = state.warehouses.find((w) => w.id === watch("warehouseId"));

  const onSubmit = (v: F) => {
    const r = addBatch({
      categoryId: v.categoryId,
      variety: v.variety,
      supplierId: v.supplierId,
      origin: v.origin,
      harvestDate: v.harvestDate || undefined,
      arrivalDate: v.arrivalDate,
      arrivalQtyKg: v.arrivalQtyKg,
      warehouseId: v.warehouseId,
      storageLocation: v.storageLocation,
      handling: { packaging: v.packaging, transport: v.transport, transitHours: v.transitHours, precooled: v.precooled, storageType: v.storageType },
      temperatureLog: v.initialTempC !== "" && v.initialTempC !== undefined ? [{ date: v.arrivalDate, tempC: Number(v.initialTempC), source: "manual" }] : [],
      flag: null,
      notes: v.notes,
    });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Batch ${r.value.code} registered`, { description: "Next step: record the arrival inspection.", action: { label: "Inspect", onClick: () => nav(`/app/inspections/new?batch=${r.value.id}`) } });
    onOpenChange(false);
    nav(`/app/batches/${r.value.id}`);
  };

  const Err = ({ m }: { m?: string }) => (m ? <p className="text-xs text-red-600">{m}</p> : null);
  const sel = (name: keyof F, items: [string, string][], placeholder = "Select…", onChange?: (v: string) => void) => (
    <Controller control={control} name={name} render={({ field }) => (
      <Select value={(field.value as string) || undefined} onValueChange={(v) => { field.onChange(v); onChange?.(v); }}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>{items.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
      </Select>
    )} />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Register produce batch</DialogTitle>
          <DialogDescription>Step 1 of the workflow. Capture arrival details and handling conditions — these drive the quality forecast.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <fieldset className="grid gap-4 sm:grid-cols-3">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Produce & source</legend>
            <div className="space-y-1.5"><Label>Produce category</Label>{sel("categoryId", state.categories.map((c) => [c.id, c.name]))}</div>
            <div className="space-y-1.5"><Label>Variety</Label>{sel("variety", cat.varieties.map((v) => [v, v]))}<Err m={errors.variety?.message} /></div>
            <div className="space-y-1.5"><Label>Supplier / farm</Label>{sel("supplierId", state.suppliers.map((s) => [s.id, s.name]), "Select…", (v) => { const s = state.suppliers.find((x) => x.id === v); if (s && !watch("origin")) setValue("origin", `${s.state} State`); })}<Err m={errors.supplierId?.message} /></div>
            <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="origin">Origin</Label><Input id="origin" placeholder="e.g. Kadawa, Garun Mallam LGA, Kano" {...register("origin")} /><Err m={errors.origin?.message} /></div>
          </fieldset>
          <fieldset className="grid gap-4 sm:grid-cols-3">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Arrival & storage</legend>
            <div className="space-y-1.5"><Label htmlFor="hd">Harvest date</Label><Input id="hd" type="date" {...register("harvestDate")} /><Err m={errors.harvestDate?.message} /></div>
            <div className="space-y-1.5"><Label htmlFor="ad">Arrival date</Label><Input id="ad" type="date" max={state.today} {...register("arrivalDate")} /><Err m={errors.arrivalDate?.message} /></div>
            <div className="space-y-1.5"><Label htmlFor="q">Arrival quantity (kg)</Label><Input id="q" type="number" inputMode="numeric" step={1} min={1} {...register("arrivalQtyKg")} /><Err m={errors.arrivalQtyKg?.message} /></div>
            <div className="space-y-1.5"><Label>Warehouse</Label>{sel("warehouseId", state.warehouses.map((w) => [w.id, `${w.name} (${w.city})`]), "Select…", () => setValue("storageLocation", ""))}<Err m={errors.warehouseId?.message} /></div>
            <div className="space-y-1.5"><Label>Storage location</Label>{sel("storageLocation", (wh?.locations ?? []).map((l) => [l, l]), wh ? "Select…" : "Choose warehouse first")}<Err m={errors.storageLocation?.message} /></div>
            <div className="space-y-1.5"><Label>Storage type</Label>{sel("storageType", Object.entries(STORAGE))}</div>
          </fieldset>
          <fieldset className="grid gap-4 sm:grid-cols-3">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Handling conditions</legend>
            <div className="space-y-1.5"><Label>Packaging</Label>{sel("packaging", Object.entries(PACKAGING))}</div>
            <div className="space-y-1.5"><Label>Transport</Label>{sel("transport", Object.entries(TRANSPORT))}</div>
            <div className="space-y-1.5"><Label htmlFor="th">Transit time (hours)</Label><Input id="th" type="number" step={1} {...register("transitHours")} /></div>
            <div className="space-y-1.5"><Label htmlFor="t0">Arrival temperature (°C, optional)</Label><Input id="t0" type="number" step={0.1} {...register("initialTempC")} /><Err m={errors.initialTempC?.message as string | undefined} /></div>
            <Controller control={control} name="precooled" render={({ field }) => (
              <label className="flex items-center gap-2 pt-6 text-sm"><Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} /> Pre-cooled before transit</label>
            )} />
          </fieldset>
          <div className="space-y-1.5"><Label htmlFor="notes">Notes</Label><Textarea id="notes" rows={2} {...register("notes")} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>Register batch</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
