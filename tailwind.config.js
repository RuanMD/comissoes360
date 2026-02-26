/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                shopee: "#EE4D2D",
                "primary": "#f2a20d",
                "background-light": "#f8f7f5",
                "background-dark": "#181611",
                "surface-dark": "#221c10",
                "surface-highlight": "#2d261a",
                "border-dark": "#393328",
                "text-secondary": "#baaf9c",
                dark: {
                    900: "#0A0A0A",
                    800: "#1A1A1A",
                    700: "#2A2A2A",
                }
            },
            fontFamily: {
                sans: ["Manrope", "sans-serif"],
                display: ["Manrope", "sans-serif"]
            },
            borderRadius: { "DEFAULT": "0.5rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px" },
        },
    },
    plugins: [],
}
