/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "../src-tauri/src/**/*.rs",
  ],
  theme: {
    extend: {
      colors: {
        "bg-primary": "#1e1e1e",
        "bg-secondary": "#252526",
        "bg-tertiary": "#2d2d30",
        "border-subtle": "#3e3e42",
        "border-strong": "#007acc",
        "text-primary": "#d4d4d4",
        "text-muted": "#9da1a6",
        accent: "#007acc",
        "accent-hover": "#1f8ad2",
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
