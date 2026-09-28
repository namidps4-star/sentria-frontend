import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'

import { ThemeSync } from '@/components/sentria/theme-sync'

import './globals.css'

const inter = Inter({
variable: '--font-inter',
subsets: ['latin'],
axes: ['opsz'],
})

// Applies the saved theme before paint; brand default is dark (noir + lime).
// Applies the saved theme before paint; ThemeSync re-applies it after hydration.
const themeScript = `try{if(localStorage.getItem('sentria-theme')==='light'){var e=document.documentElement;e.classList.remove('dark');e.classList.add('light')}}catch(e){}`

export const metadata: Metadata = {
title: 'SentrIA — Intelligence opérationnelle',
description:
'SentrIA : surveillance et intelligence prédictive des systèmes, équipements et opérations critiques.',
generator: 'v0.app',
icons: {
icon: [
{ url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
{ url: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
{ url: '/favicon.svg', type: 'image/svg+xml' },
],
apple: '/favicon-180.png',
},
}

export const viewport: Viewport = {
colorScheme: 'dark light',
themeColor: '#0B0C08',
}

export default function RootLayout({
children,
}: Readonly<{
children: React.ReactNode
}>) {
return (
<html
lang="fr"
className="dark"
suppressHydrationWarning
>
<head>
<script dangerouslySetInnerHTML={{ __html: themeScript }} />
</head>
<body className={`${inter.variable} bg-background font-sans antialiased`}>
<ThemeSync />
{children}
{process.env.NODE_ENV === 'production' && <Analytics />} </body> </html>
)
}
