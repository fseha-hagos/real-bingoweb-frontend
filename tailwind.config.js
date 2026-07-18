/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/app/**/*.{js,ts,jsx,tsx,mdx}", // if you are using the App Router
    ],
    theme: {
      extend: {
        colors: {
          brand: {
            bg: "#050811",
            primary: "#6366f1", // Indigo
            secondary: "#06b6d4", // Cyan
            accent: "#f59e0b", // Amber/Gold
            surface: "rgba(255, 255, 255, 0.05)",
          }
        }
      },
    },
    plugins: [
      require('tailwind-scrollbar-hide')
    ],
  }
  