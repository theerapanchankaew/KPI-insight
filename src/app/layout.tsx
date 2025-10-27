
import type { Metadata } from 'next';
import { Inter, Sarabun } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { AppProviders } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['400', '700'],
  variable: '--font-sarabun',
});

export const metadata: Metadata = {
  title: 'KPI Insights',
  description: 'KPI Insights Application',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="h-full">
      <head>
        <style>
          {`
            @view-transition {
              navigation: auto;
            }
          `}
        </style>
      </head>
      <body className={cn("h-full bg-gray-50 font-sans", inter.variable, sarabun.variable)}>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
