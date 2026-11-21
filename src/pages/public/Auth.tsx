import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, type ReactNode } from "react";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo, ProducePhoto } from "@/components/shared";
import { DEMO_USER, useAuth, type User } from "@/lib/auth";

function AuthShell({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/"><Logo /></Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-bold text-forest-950">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-forest-900 lg:block">
        <ProducePhoto name="hero" alt="Fresh tomatoes" className="absolute inset-0 h-full w-full opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/40 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <div className="font-display text-3xl font-bold">Plan dispatch around produce quality.</div>
          <p className="mt-3 max-w-md text-forest-100/80">Inspection records, handling conditions, inventory and buyer requirements — connected.</p>
        </div>
      </div>
    </div>
  );
}

const loginSchema = z.object({ email: z.string().email("Enter a valid email"), password: z.string().min(8, "Password must be at least 8 characters") });

export function Login() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const onSubmit = async (v: z.infer<typeof loginSchema>) => {
    setError(null);
    const r = await signIn(v.email, v.password);
    if (!r.ok) return setError(r.error ?? "Sign-in failed");
    toast.success("Welcome back");
    nav(loc.state?.from ?? "/app", { replace: true });
  };
  return (
    <AuthShell title="Log in to HarvestQuoin" subtitle={<>New here? <Link to="/register" className="font-medium text-forest-700 hover:underline">Create an account</Link></>}>
      <div className="mb-5 flex gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>Demo environment — authentication is simulated (Amazon Cognito integration prepared). Any email and an 8+ character password will sign you in.</div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5"><Label htmlFor="email">Work email</Label><Input id="email" type="email" autoComplete="email" {...register("email")} />{errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}</div>
        <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" {...register("password")} />{errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}</div>
        {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" />} Log in</Button>
        <Button type="button" variant="outline" className="w-full" disabled={isSubmitting} onClick={() => { setValue("email", DEMO_USER.email); setValue("password", "demo-password"); handleSubmit(onSubmit)(); }}>
          Continue with demo account
        </Button>
      </form>
    </AuthShell>
  );
}

const registerSchema = z
  .object({
    name: z.string().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid work email"),
    organisation: z.string().min(2, "Organisation is required"),
    role: z.enum(["Operations Manager", "Warehouse Manager", "Quality Inspector", "Viewer"]),
    password: z.string().min(8, "At least 8 characters").regex(/[0-9]/, "Include at least one number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

export function Register() {
  const { signUp } = useAuth();
  const nav = useNavigate();
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema), defaultValues: { role: "Operations Manager" } });
  const onSubmit = async (v: z.infer<typeof registerSchema>) => {
    const u: User = { name: v.name, email: v.email, organisation: v.organisation, role: v.role };
    await signUp(u, v.password);
    toast.success("Account created — demo data loaded for your pilot");
    nav("/app", { replace: true });
  };
  return (
    <AuthShell title="Create a demo account" subtitle={<>Already have an account? <Link to="/login" className="font-medium text-forest-700 hover:underline">Log in</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" {...register("name")} />{errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}</div>
        <div className="space-y-1.5"><Label htmlFor="email">Work email</Label><Input id="email" type="email" {...register("email")} />{errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}</div>
        <div className="space-y-1.5"><Label htmlFor="org">Organisation</Label><Input id="org" {...register("organisation")} />{errors.organisation && <p className="text-xs text-red-600">{errors.organisation.message}</p>}</div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select defaultValue="Operations Manager" onValueChange={(v) => setValue("role", v as User["role"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["Operations Manager", "Warehouse Manager", "Quality Inspector", "Viewer"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" autoComplete="new-password" {...register("password")} />{errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor="cf">Confirm</Label><Input id="cf" type="password" autoComplete="new-password" {...register("confirm")} />{errors.confirm && <p className="text-xs text-red-600">{errors.confirm.message}</p>}</div>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" />} Create account</Button>
        <p className="text-center text-xs text-muted-foreground">Demo environment — registration is simulated (Amazon Cognito prepared).</p>
      </form>
    </AuthShell>
  );
}
