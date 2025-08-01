import { AuthProvider } from './contexts/AuthContext';
import { AppRouter } from './router'; // Uncomment
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';

const queryClient = new QueryClient({
  defaultOptions: {
      queries: {
          staleTime: 1000 * 60 * 5,
          refetchOnWindowFocus: false,
          retry: 1,
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
          <AppRouter />
          <Toaster position="bottom-center" reverseOrder={false} />
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
export default App;