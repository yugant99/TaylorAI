"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { User } from "@supabase/supabase-js"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null } }) => {
      if (user) {
        router.replace("/profile")
      } else {
        router.replace("/login")
      }
    })
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse">Redirecting...</div>
    </div>
  )
}