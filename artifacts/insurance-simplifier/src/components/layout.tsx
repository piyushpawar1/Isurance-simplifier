import React from "react";
import { Link, useLocation } from "wouter";
import { Shield, History, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/10">
      <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur-md">
        <div className="container mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/90 transition-colors">
            <Shield className="w-6 h-6" />
            <span className="font-bold text-lg tracking-tight">Policy Simplifier</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className={cn("text-sm font-medium transition-colors hover:text-primary", location === "/" ? "text-primary" : "text-muted-foreground")}>
              Upload Policy
            </Link>
            <Link href="/policies" className={cn("text-sm font-medium transition-colors hover:text-primary", location.startsWith("/policies") ? "text-primary" : "text-muted-foreground")}>
              History
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full container mx-auto px-4 md:px-8 py-8 md:py-12">
        {children}
      </main>
      <footer className="border-t py-8 mt-auto bg-card">
        <div className="container mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between text-muted-foreground text-sm">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Shield className="w-4 h-4" />
            <span>Clear. Reassuring. Simple.</span>
          </div>
          <p>Cutting through the jargon so you know what you are covered for.</p>
        </div>
      </footer>
    </div>
  );
}
