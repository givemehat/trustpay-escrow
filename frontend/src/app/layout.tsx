import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from 'next-themes';
import { NetworkMismatchBanner } from '@/components/NetworkMismatchBanner';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'TrustPay Escrow',
  description: 'Secure Escrow for Freelancers and Clients on the Stellar Network',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* FOUC prevention script - runs before theme provider hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                let targetTheme = 'light';
                if (theme === 'oled') {
                  targetTheme = 'oled';
                } else if (theme === 'dark' || (theme === 'system' && prefersDark) || (!theme && prefersDark)) {
                  targetTheme = 'dark';
                }
                document.documentElement.setAttribute('data-theme', targetTheme);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          themes={['light', 'dark', 'oled', 'system']}
          storageKey="theme"
        >
          <NetworkMismatchBanner />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
