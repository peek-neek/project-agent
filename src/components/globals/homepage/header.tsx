import {
  ClerkLoaded,
  ClerkLoading,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import * as motion from "motion/react-client";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { navLinks } from "./content";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { easeOutExpo } from "./motion-presets";

export function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeOutExpo }}
      className="sticky top-0 z-30 border-b border-foreground/5 bg-background/80 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Logo />

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Button
                  variant="ghost"
                  nativeButton={false}
                  render={<a href={link.href} />}
                  className="group h-9 gap-2 px-3 font-normal text-foreground/80 hover:bg-transparent hover:text-foreground"
                >
                  <span className="size-1 bg-foreground/60 transition-colors group-hover:bg-primary" />
                  {link.label}
                </Button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Suspense fallback={<div className="h-10 w-10 sm:w-40" />}>
            <Show when="signed-out">
              <SignInButton>
                <Button
                  variant="ghost"
                  className="hidden h-10 px-4 text-foreground/80 md:inline-flex"
                >
                  Sign in
                </Button>
              </SignInButton>
              <SignUpButton>
                <Button className="hidden h-10 bg-foreground px-5 text-background hover:bg-primary hover:text-primary-foreground sm:inline-flex">
                  Get started
                </Button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              {/* Client-only, like the dashboard header: UserButton renders
                  differently on the server, which breaks hydration. */}
              <ClerkLoading>
                <Skeleton className="size-7" />
              </ClerkLoading>
              <ClerkLoaded>
                <UserButton />
              </ClerkLoaded>
            </Show>
          </Suspense>
          <MobileNav />
        </div>
      </div>
    </motion.header>
  );
}
