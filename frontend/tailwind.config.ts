import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        /** Standard Bio brand — extracted from standard.bio */
        primary: {
          DEFAULT: "#001C29",
          light: "#0A2E3F",
          dark: "#001018",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#1B1C1D",
          foreground: "#BDBDBD",
        },
        accent: {
          DEFAULT: "#38B749",
          dark: "#2FA03E",
          light: "#9EC2AF",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#6B7B85",
          foreground: "#BDBDBD",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F4F7F6",
        },
        background: {
          DEFAULT: "#F4F7F6",
        },
        border: {
          DEFAULT: "#DDE5E2",
        },
      },
      fontFamily: {
        /** Website uses Proxima Nova; Inter is the bundled fallback */
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 28 41 / 0.08), 0 1px 2px -1px rgb(0 28 41 / 0.06)",
        header: "0 1px 0 0 rgb(0 28 41 / 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
