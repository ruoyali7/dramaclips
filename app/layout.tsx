import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "DramaClips — Find it. Watch it.", template: "%s · DramaClips" },
  description: "Find the exact short drama from your feed and continue watching in the official app.",
  openGraph: { title: "DramaClips", description: "Your drama. One tap away.", type: "website" },
  twitter: { card: "summary_large_image" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
