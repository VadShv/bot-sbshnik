import { Link, useLocation } from "wouter";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

export function Header() {
  const [location] = useLocation();
  const nav: { href: string; label: string }[] = [
    { href: "/", label: "Новая проверка" },
    { href: "/history", label: "История" },
    { href: "/about", label: "Методика" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-3">
        <Link href="/">
          <a className="flex items-center gap-3 text-primary" data-testid="link-home">
            <Logo size={30} />
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-wide uppercase">
                Бот СБшник
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Per aspera ad astra
              </div>
            </div>
          </a>
        </Link>
        <nav className="flex items-center gap-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href}>
              <a
                data-testid={`link-nav-${n.href.slice(1) || "home"}`}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover-elevate",
                  location === n.href
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {n.label}
              </a>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
