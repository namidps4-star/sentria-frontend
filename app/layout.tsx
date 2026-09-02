import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
<<<<<<< HEAD
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
=======
import { IBM_Plex_Sans, Geist_Mono } from 'next/font/google'
import './globals.css'

const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})
>>>>>>> feature/layout
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
<<<<<<< HEAD
  title: 'SentrIA — Intelligence opérationnelle',
=======
  title: 'SentrIA | Intelligence opérationnelle',
>>>>>>> feature/layout
  description: 'SentrIA : surveillance et intelligence prédictive des systèmes, équipements et opérations critiques.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="fr"
<<<<<<< HEAD
      className={`light ${geistSans.variable} ${geistMono.variable} bg-background`}
=======
      className={`light ${plexSans.variable} ${geistMono.variable} bg-background`}
>>>>>>> feature/layout
    >
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
<<<<<<< HEAD
}
=======
}
>>>>>>> feature/layout
