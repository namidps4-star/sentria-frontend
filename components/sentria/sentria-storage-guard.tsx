'use client'

import { useEffect } from 'react'

const SENTRIA_STORAGE_KEYS = [
  'sentria_onboarded',
  'sentria_sector',
  'sentria_sectors',
  'sentria_equipment',
  'sentria_monitoring',
  'sentria_ops_type',
  'sentria_data_sources',
  'sentria_configure_later',
]

export function SentriaStorageGuard() {
  useEffect(() => {
    const appVersion =
      process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'

    const storedVersion = localStorage.getItem(
      'sentria_app_version'
    )

    if (storedVersion === appVersion) {
      return
    }

    for (const key of SENTRIA_STORAGE_KEYS) {
      localStorage.removeItem(key)
    }

    localStorage.setItem(
      'sentria_app_version',
      appVersion
    )

    window.location.reload()
  }, [])

  return null
}