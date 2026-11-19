import { ArrowLeftIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { AuthShowcase } from "@/components/globals/auth/auth-showcase";
import { Logo } from "@/components/globals/homepage/logo";
import { Button } from "@/components/ui/button";
import { easeOutExpo } from "@/components/globals/homepage/motion-presets";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh flex-1 lg:grid-cols-2">
      <AuthShowcase />

      <div className="flex flex-col px-5 py-5 sm:px-8">
        <header className="flex h-12 items-center justify-between lg:justify-end">
          <Logo className="lg:hidden" />
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/" />}
            className="h-9 px-3 font-normal text-foreground/65 hover:text-foreground"
          >
            <ArrowLeftIcon aria-hidden data-icon="inline-start" />
            Back to home
          </Button>
        </header>

        <motion.main
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOutExpo, delay: 0.1 }}
          className="flex flex-1 items-center justify-center py-10"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
