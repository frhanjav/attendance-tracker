import { AuthProvider } from './contexts/AuthContext';
import { AppRouter } from './router'; // Uncomment
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';

// const queryClient = new QueryClient({ /* ... options ... */ });

const queryClient = new QueryClient({
  defaultOptions: {
      queries: {
          // How long data is considered fresh (won't refetch on mount/window focus)
          // Good default to avoid excessive refetching
          staleTime: 1000 * 60 * 5, // 5 minutes

          // Consider keeping this false unless you specifically need background updates on focus
          refetchOnWindowFocus: false,

          // Retry failed queries once by default (can be adjusted)
          retry: 1,

          // Optional: Default time data remains in cache after unmount before garbage collection
          // gcTime: 1000 * 60 * 15, // 15 minutes (formerly cacheTime)
      },
      mutations: {
          // Optional: Default retry for mutations (usually 0)
          // retry: 0,
      }
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRouter /> {/* Render the router */}
          <Toaster position="bottom-center" reverseOrder={false} /> {/* Add Toaster */}
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
export default App;