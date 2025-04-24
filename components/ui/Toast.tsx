import { useState, useCallback } from 'react'

interface ToastProps {
  title: string
  description?: string
}

export const toast = ({ title, description }: ToastProps) => {
  // In a real app, this would be a proper toast component
  console.log(`Toast: ${title}${description ? ' - ' + description : ''}`)
  // You can implement a real toast notification system here
}

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastProps[]>([])
  
  const addToast = useCallback((props: ToastProps) => {
    toast(props)
    setToasts((prev) => [...prev, props])
  }, [])
  
  return { toast: addToast, toasts }
}