"use client";

import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { ArrowUpRightIcon, MenuIcon } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { navLinks } from "./content";
import { Logo } from "./logo";
import { easeOutExpo } from "./motion-presets";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        render={
          <Button
            variant="outline"
            size="icon"
            className="size-10 bg-card md:hidden"
          />
        }
      >
        <MenuIcon className="size-5" />
      </SheetTrigger>
      <SheetContent
        side="right"
        finalFocus={false}
        className="w-[min(22rem,88vw)] gap-0 bg-background p-0"
      >
        <SheetHeader className="h-20 justify-center px-6">
          <Logo />
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Jump to a section of the page or sign in
          </SheetDescription>
        </SheetHeader>
        <Separator />

        <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-3 py-6">
          <ul className="space-y-1">
            {navLinks.map((link, i) => (
              <motion.li
                key={link.href}
                initial={{ opacity: 0, x: 16 }}
                animate={open ? { opacity: 1, x: 0 } : { opacity: 0, x: 16 }}
                transition={{
                  duration: 0.4,
                  delay: 0.05 + i * 0.04,
                  ease: easeOutExpo,
                }}
              >
                <Button
                  variant="ghost"
                  nativeButton={false}
                  render={<a href={link.href} onClick={() => setOpen(false)} />}
                  className="group h-auto w-full justify-between px-4 py-3.5 text-lg font-medium tracking-tight hover:bg-card"
                >
                  {link.label}
                  <ArrowUpRightIcon
                    aria-hidden
                    className="size-4 text-foreground/40 transition-colors group-hover:text-primary"
                  />
                </Button>
              </motion.li>
            ))}
          </ul>
        </nav>

        <Separator />
        <SheetFooter className="mt-0 p-6">
          <Show when="signed-out">
            <SignUpButton>
              <Button className="h-12 w-full bg-foreground text-background hover:bg-primary hover:text-primary-foreground">
                Get started
              </Button>
            </SignUpButton>
            <SignInButton>
              <Button variant="outline" className="h-12 w-full bg-card">
                Sign in
              </Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <p className="text-center text-sm text-foreground/65">
              You&apos;re signed in.
            </p>
          </Show>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
