import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Berkeley Dining API",
  description: "Backend for Berkeley Dining mobile app",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
