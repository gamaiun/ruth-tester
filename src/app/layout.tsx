import "./globals.css";

export const metadata = {
  title: "Simple Next.js & React Website",
  description: "A simple Next.js website with React and TypeScript",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}
