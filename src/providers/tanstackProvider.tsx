import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const TanstackProvider = ({children}: {children: React.ReactNode}) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                networkMode: 'always',
            },
            mutations: {
                networkMode: 'always',
            }
        }
    });
    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    )
}

export default TanstackProvider
