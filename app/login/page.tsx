'use client'

import { useEffect, useState } from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { AuthChangeEvent, Session } from '@supabase/supabase-js'

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  
  // Check if user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.replace('/profile');
      } else {
        setIsLoading(false);
      }
    };
    
    checkUser();
  }, [router]);
  
  // Also set up auth state listener for redirects after login
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace('/profile');
      }
    });
    
    return () => subscription.unsubscribe();
  }, [router]);
  
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">TaylorAI Job Assistant</h1>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <Auth
            supabaseClient={supabase}
            appearance={{ 
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#4F46E5',
                    brandAccent: '#4338CA'
                  }
                }
              }
            }}
            providers={[]}
            redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/profile`}
            view="magic_link"
            showLinks={false}
            magicLink={true}
          />
        </div>
      </div>
    </div>
  )
}