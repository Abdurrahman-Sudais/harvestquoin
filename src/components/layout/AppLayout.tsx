import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  LayoutDashboard, Package, ClipboardCheck, TrendingDown, ShoppingCart, GitMerge, Truck, Sparkles, BarChart3, Settings, Menu, LogOut, CalendarClock, ChevronDown, RotateCcw, Cloud,
} from "lucide-react";
import { Logo } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { fmtDate } from "@/lib/dates";
import { toast } from "sonner";

const NAV = [
  { group: "Overview", items: [{ to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true }] },
  {
    group: "Workflow",
    items: [
      { to: "/app/batches", label: "Produce batches", icon: Package, step: 1 },
      { to: "/app/inspections", label: "Inspections", icon: ClipboardCheck, step: 2 },
      { to: "/app/forecasting", label: "Quality forecasting", icon: TrendingDown, step: 3 },
      { to: "/app/orders", label: "Customer orders", icon: ShoppingCart, step: 4 },
      { to: "/app/allocation", label: "Batch allocation", icon: GitMerge, step: 5 },
      { to: "/app/dispatch", label: "Dispatch planning", icon: Truck, step: 6 },
    ],
  },
  {
    group: "Intelligence",
    items: [
      { to: "/app/assistant", label: "AI assistant", icon: Sparkles },
      { to: "/app/reports", label: "Reports", icon: BarChart3 },
      { to: "/app/settings", label: "Settings & AWS", icon: Settings },
    ],
  },
];

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { derived } = useStore();
  const pendingAlloc = derived.plan.recommendations.length;
  const urgent = derived.priority.filter((p) => p.level === "dispatch_now").length;
  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4 scrollbar-thin">
      {NAV.map((g) => (
        <div key={g.group}>
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-forest-300/70">{g.group}</div>
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const badge = it.to === "/app/allocation" ? pendingAlloc : it.to === "/app/dispatch" ? urgent : 0;
              return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={"end" in it ? it.end : false}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn("group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-forest-100/80 transition-colors hover:bg-white/5 hover:text-white", isActive && "bg-white/10 text-white")
                  }
                >
                  {({ isActive }) => (
                    <>
                      <it.icon className={cn("h-4 w-4", isActive ? "text-lime-400" : "text-forest-300")} />
                      <span className="flex-1">{it.label}</span>
                      {"step" in it && <span className="text-[10px] text-forest-300/60">{it.step}</span>}
                      {badge > 0 && <span className={cn("rounded-full px-1.5 text-[10px] font-bold", it.to === "/app/dispatch" ? "bg-red-500 text-white" : "bg-lime-400 text-forest-950")}>{badge}</span>}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-forest-950">
      <div className="flex h-16 items-center px-5">
        <Link to="/" onClick={onNavigate}>
          <Logo light />
        </Link>
      </div>
      <SideNav onNavigate={onNavigate} />
      <div className="m-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-forest-200/80">
        <div className="flex items-center gap-1.5 font-semibold text-white">
          <Cloud className="h-3.5 w-3.5 text-lime-400" /> Demo environment
        </div>
        <p className="mt-1 leading-relaxed">Forecasts and AI are simulated. AWS SageMaker & Bedrock adapters are prepared.</p>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { state, advanceDay, resetDemo } = useStore();
  const nav = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarInner />
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-0 p-0 [&>button]:text-white">
              <SheetClose asChild>
                <div className="h-full">
                  <SidebarInner />
                </div>
              </SheetClose>
            </SheetContent>
          </Sheet>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarClock className="h-4 w-4 text-forest-600" />
                <span className="hidden sm:inline text-muted-foreground">Operating date</span>
                <span className="font-semibold">{fmtDate(state.today, { weekday: true, year: true })}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                All forecasts, priorities and allocations are calculated against this fixed operating date so results are deterministic.
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { advanceDay(1); toast.success("Advanced one day — forecasts recalculated"); }}>
                <CalendarClock /> Advance one day (simulate)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { advanceDay(-1); toast("Moved back one day"); }}>
                <CalendarClock /> Go back one day
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { resetDemo(); toast.success("Demo data reset"); }} className="text-red-600">
                <RotateCcw /> Reset demo data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-secondary">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-forest-800 text-xs font-bold text-lime-300">
                  {user?.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <span className="hidden text-left md:block">
                  <span className="block text-sm font-medium leading-tight">{user?.name}</span>
                  <span className="block text-[11px] leading-tight text-muted-foreground">{user?.role}</span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <div className="text-sm">{user?.name}</div>
                <div className="text-xs font-normal text-muted-foreground">{user?.organisation}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => nav("/app/settings")}>
                <Settings /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { signOut(); nav("/"); }}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
