import * as motion from "motion/react-client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { dataSources, navLinks, site } from "./content";
import { Logo } from "./logo";
import { fadeUp, inViewOnce, stagger } from "./motion-presets";

export function Footer() {
  return (
    <footer>
      <Separator />
      <motion.div
        variants={stagger(0.08)}
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]"
      >
        <motion.div variants={fadeUp}>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-foreground/65">
            {site.tagline}. Branded, data-backed reports for any Canadian
            address.
          </p>
        </motion.div>

        <motion.nav variants={fadeUp} aria-label="Footer">
          <h2 className="text-sm font-semibold">Explore</h2>
          <ul className="mt-4 space-y-2.5">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Button
                  variant="link"
                  nativeButton={false}
                  render={<a href={link.href} />}
                  className="h-auto p-0 font-normal text-foreground/65 hover:text-foreground"
                >
                  {link.label}
                </Button>
              </li>
            ))}
          </ul>
        </motion.nav>

        <motion.div variants={fadeUp}>
          <h2 className="text-sm font-semibold">Data sources</h2>
          <p className="mt-4 text-sm leading-relaxed text-foreground/65">
            {dataSources.join(" · ")}
          </p>
        </motion.div>
      </motion.div>

      <Separator />
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-xs leading-relaxed text-foreground/65 sm:px-8 md:flex-row md:justify-between">
        <p className="max-w-3xl">
          Reports are for reference only and may contain errors or outdated
          data. Check zoning, lot lines, school catchments and other important
          details with the relevant authority before relying on them. Each
          report lists its data sources and the date of each dataset.
        </p>
        <p className="shrink-0">© {site.name}</p>
      </div>
    </footer>
  );
}
