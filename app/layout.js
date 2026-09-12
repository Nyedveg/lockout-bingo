import { Special_Elite, Courier_Prime } from "next/font/google";
import "./globals.css";
import SWRegister from "./components/SWRegister";

const specialElite = Special_Elite({
  weight: "400",
  subsets: ["latin", "latin-ext"], // latin-ext covers Lithuanian diacritics (ą č ę ė į š ų ū ž)
  variable: "--font-stamp",
  display: "swap",
});

const courierPrime = Courier_Prime({
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-type",
  display: "swap",
});

export const metadata = {
  title: "Daninių Bingo",
  description: "A 3-team Taskmaster-inspired lockout bingo party game.",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Daninių Bingo",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#211d17",
};

export default function RootLayout({ children }) {
  return (
    <html lang="lt" className={`${specialElite.variable} ${courierPrime.variable}`}>
      <body>
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
