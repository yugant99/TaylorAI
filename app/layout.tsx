"use client"

import { Inter } from "next/font/google"
import "./globals.css"
import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user && pathname !== "/login") {
        router.replace("/login")
      }
      if (user && pathname === "/login") {
        router.replace("/jobs")
      }
    })
  }, [router, pathname])

  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>{children}</body>
    </html>
  )
}