import React, { useState } from 'react'; // Import useState for error message
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { authService } from '../services/auth.service';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link, useLocation } from 'react-router-dom';

// Define Zod schema for login form validation
const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [errorMessage, setErrorMessage] = useState<string | null>(null); // State for error message
    const from = location.state?.from?.pathname || "/dashboard"; // Redirect back or to dashboard

    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormInputs>({
        resolver: zodResolver(loginSchema),
    });

    const mutation = useMutation({
        mutationFn: authService.login,
        onSuccess: (data) => {
            setErrorMessage(null); // Clear error on success
            login(data.token, data.user); // Update auth context
            navigate(from, { replace: true }); // Navigate to intended page or dashboard
        },
        onError: (error) => {
            console.error('Login error:', error);
            setErrorMessage(error.message || 'Login failed. Please check your credentials.'); // Set error message
        },
    });

    const onSubmit = (data: LoginFormInputs) => {
        setErrorMessage(null); // Clear previous errors on new submit
        mutation.mutate(data);
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-center mb-6">Login</h2>
            {errorMessage && ( // Display error message
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <span className="block sm:inline">{errorMessage}</span>
                </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address
                    </label>
                    <input
                        id="email"
                        type="email"
                        {...register('email')}
                        className={`w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                        disabled={mutation.isPending}
                    />
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>
                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        {...register('password')}
                        className={`w-full px-3 py-2 border ${errors.password ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                        disabled={mutation.isPending}
                    />
                    {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                </div>
                <div>
                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? 'Logging in...' : 'Login'}
                    </button>
                </div>
            </form>
            <p className="text-center text-sm text-gray-600 mt-4">
                Don't have an account?{' '}
                <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-500">
                    Sign up
                </Link>
            </p>
        </div>
    );
};

export default LoginPage;