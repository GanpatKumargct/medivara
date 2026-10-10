import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { AuthProvider } from './context/AuthContext'
import { DisplayPrefsProvider } from './context/DisplayPrefsContext'
import { ToastProvider } from './context/ToastContext'
import './index.css'

// No automatic retries on 4xx (FE-1.3). Dummy-data mode resolves locally.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <DisplayPrefsProvider>
        <AuthProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </AuthProvider>
      </DisplayPrefsProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
