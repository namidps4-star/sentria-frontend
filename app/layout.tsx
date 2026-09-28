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
const themeScript = `try{if(localStorage.getItem('sentria-theme')==='dark'){var e=document.documentElement;e.classList.remove('light');e.classList.add('dark')}}catch(e){}`

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
colorScheme: 'light dark',
themeColor: '#ECE7D6',
}

export default function RootLayout({
children,
}: Readonly<{
children: React.ReactNode
}>) {
return (
<html
lang="fr"
className="light"
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
