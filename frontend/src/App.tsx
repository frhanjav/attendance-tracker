import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { AppRouter } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
      queries: {
          retry: 1,
      },
      mutations: {
          retry: 1,
      }
  },
});

queryClient.setQueryDefaults(['weeklyAttendanceView'], {
  staleTime: 0,
  gcTime: 0,
  refetchOnMount: 'always',
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  retry: false
});

queryClient.setMutationDefaults(['replaceClass', 'cancelClass', 'addSubject'], {
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['weeklyAttendanceView'], exact: false });
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