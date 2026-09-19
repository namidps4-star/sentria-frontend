
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Geist_Mono } from 'next/font/google'
import './globals.css'
import { THEME_INIT_SCRIPT } from "@/lib/theme"

const geistSans = Space_Grotesk({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

/* The first-paint default, and what a crawler sees. It cannot depend on
   the operator's language: this is evaluated when the page is built and
   the choice lives in localStorage, read after mount.
   components/sentria/document-language.tsx corrects both of these, and
   the <html lang> below, once the choice is known.

   i18n-ignore-start: static build-time metadata, corrected at runtime */
export const metadata: Metadata = {
  title: 'SentrIA | Intelligence opérationnelle',
  description:
    'SentrIA : surveillance et intelligence prédictive des systèmes, équipements et opérations critiques.',
  /* i18n-ignore-end */
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
    {
      media: '(prefers-color-scheme: light)',
      color: 'white',
    },
    {
      media: '(prefers-color-scheme: dark)',
      color: 'black',
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      /* The default. DocumentLanguage sets the real one after mount. */
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} bg-background`}
      suppressHydrationWarning
    >
      <head>
        {/* Sets the theme class before the first paint, so there is no
            flash of the wrong theme and nothing for React to reconcile.
            The class this writes is why <html> carries
            suppressHydrationWarning. */}
        <script
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>

      <body className="font-sans antialiased">
        {children}

        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

