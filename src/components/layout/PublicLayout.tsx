import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Menu, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const NAV = [
  { to: "/features", label: "Features" },
  { to: "/solutions", label: "Solutions" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export function PublicLayout() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to="/" aria-label="HarvestQuoin home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cn("rounded-md px-3 py-2 text-sm font-medium text-forest-900/75 transition-colors hover:text-forest-900", isActive && "text-forest-900")}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            {user ? (
              <Button asChild>
                <Link to="/app">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild>
                  <Link to="/register">Start free pilot</Link>
                </Button>
              </>
            )}
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-6">
              <Logo />
              <nav className="mt-8 flex flex-col gap-1">
                {NAV.map((n) => (
                  <SheetClose asChild key={n.to}>
                    <Link to={n.to} className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-secondary">
                      {n.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-6 flex flex-col gap-2">
                <SheetClose asChild>
                  <Button variant="outline" asChild>
                    <Link to="/login">Log in</Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button asChild>
                    <Link to="/register">Start free pilot</Link>
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="bg-forest-950 text-forest-100">
        <div className="container grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs text-sm text-forest-200/80">Plan dispatch around produce quality. Supply chain intelligence for aggregators, packhouses, cooperatives and fresh-food wholesalers.</p>
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Product</div>
            <ul className="mt-3 space-y-2 text-sm text-forest-200/80">
              <li><Link to="/features" className="hover:text-white">Features</Link></li>
              <li><Link to="/how-it-works" className="hover:text-white">How it works</Link></li>
              <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
              <li><Link to="/login" className="hover:text-white">Live demo</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Company</div>
            <ul className="mt-3 space-y-2 text-sm text-forest-200/80">
              <li><Link to="/about" className="hover:text-white">About</Link></li>
              <li><Link to="/solutions" className="hover:text-white">Solutions</Link></li>
              <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
            </ul>
          </div>
          <div className="space-y-2 text-sm text-forest-200/80">
            <div className="text-sm font-semibold text-white">Get in touch</div>
            <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> hello@harvestquoin.com</div>
            <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> +234 (0) 700 000 0000</div>
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Lagos · Abuja · Kano</div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="container flex flex-col gap-2 py-5 text-xs text-forest-300/70 sm:flex-row sm:justify-between">
            <span>© {new Date().getFullYear()} HarvestQuoin. All rights reserved.</span>
            <span>Forecasts are decision-support estimates, not inspection results or shelf-life guarantees.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
