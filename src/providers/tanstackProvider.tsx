import React from 'react';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { PacerDevtoolsPanel } from '@tanstack/react-pacer-devtools';

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
            <TanStackDevtools
                eventBusConfig={{
                    debug: false,
                }}
                plugins={[
                    {
                        name: 'TanStack Query',
                        render: <ReactQueryDevtoolsPanel theme='dark' />,
                        defaultOpen: true
                    },
                    {
                        name: 'TanStack Pacer',
                        render: <PacerDevtoolsPanel theme='dark' devtoolsOpen={false} />,
                        defaultOpen: false
                    },
                ]}
            />
        </QueryClientProvider>
    )
}

export default TanstackProvider
