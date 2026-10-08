import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'St. Peter Basic School — Live Election Standings',
  description: 'Live real-time basic school election dashboard powered by Google Sheets API',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-[#faf8f5] text-[#1c1917] antialiased flex flex-col selection:bg-amber-100 selection:text-amber-900">
        {children}
      </body>
    </html>
  );
}
