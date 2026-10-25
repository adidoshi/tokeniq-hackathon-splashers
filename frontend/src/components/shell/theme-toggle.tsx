"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";

/** Light / dark switch. The icon is only rendered after hydration, when the stored theme is known. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  // resolvedTheme is unknown on the server, so only trust it after hydration (keeps the aria-label identical on first render)
  const dark = hydrated && resolvedTheme === "dark";
  return (
    <Button
      variant="outline"
      size="icon"
      className="size-9 rounded-xl"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {hydrated ? dark ? <Sun /> : <Moon /> : null}
    </Button>
  );
}
