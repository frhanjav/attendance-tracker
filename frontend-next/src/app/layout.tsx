import QueryClientWrapper from '@/components/QueryClientWrapper';
import { AuthProvider } from '@/contexts/AuthContext';
import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
    title: 'Attendance Tracker',
    description: 'Track attendance for your classes and streams',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased">
                <QueryClientWrapper>
                    <AuthProvider>
                        {children}
                        <Toaster position="bottom-center" reverseOrder={false} />
                    </AuthProvider>
                </QueryClientWrapper>
            </body>
        </html>
    );
}
