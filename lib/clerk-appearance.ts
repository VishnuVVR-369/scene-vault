import type { ResolvedTheme } from "@/components/theme-provider";

/**
 * Themes the embedded Clerk widget to match SceneVault's palette in both
 * light and dark mode. Clerk parses these as real colors, so we pass literal
 * hex values that mirror the tokens in globals.css.
 */
export function clerkAppearance(resolved: ResolvedTheme) {
  const light = {
    colorPrimary: "#6965db",
    colorText: "#1b1b1f",
    colorTextSecondary: "#76705f",
    colorBackground: "#fffdf8",
    colorInputBackground: "#fffdf8",
    colorInputText: "#1b1b1f",
  };
  const dark = {
    colorPrimary: "#8e88ff",
    colorText: "#f2eee4",
    colorTextSecondary: "#a8a293",
    colorBackground: "#211f27",
    colorInputBackground: "#2a2833",
    colorInputText: "#f2eee4",
  };

  return {
    variables: {
      ...(resolved === "dark" ? dark : light),
      borderRadius: "0.75rem",
      fontFamily: "var(--font-nunito), ui-sans-serif, system-ui, sans-serif",
    },
    elements: {
      rootBox: "w-full",
      cardBox: "w-full shadow-none",
      card: "bg-transparent shadow-none border-0 p-0",
      header: "gap-1",
      headerTitle: "font-display text-2xl",
      socialButtonsBlockButton: "rounded-lg",
      formButtonPrimary:
        "rounded-lg text-sm font-semibold normal-case shadow-none",
      formFieldInput: "rounded-lg",
      footer: "bg-transparent",
    },
  } as const;
}
