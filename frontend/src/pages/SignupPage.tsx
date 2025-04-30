import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { authService } from '../services/auth.service';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';

// Define Zod schema for signup form validation
const signupSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }).optional(), // Optional name
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
  // Optional: Add confirm password validation
  // confirmPassword: z.string().min(1, { message: 'Please confirm your password' }),
})
// Optional: Refine to check if passwords match
// .refine((data) => data.password === data.confirmPassword, {
//   message: "Passwords don't match",
//   path: ["confirmPassword"], // path of error
// });

type SignupFormInputs = z.infer<typeof signupSchema>;

const SignupPage: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const { register, handleSubmit, formState: { errors } } = useForm<SignupFormInputs>({
        resolver: zodResolver(signupSchema),
    });

    const mutation = useMutation({
        mutationFn: authService.signup,
        onSuccess: (data) => {
            setErrorMessage(null);
            login(data.token, data.user); // Log in the user immediately after signup
            navigate('/dashboard'); // Navigate to dashboard
        },
        onError: (error) => {
            console.error('Signup error:', error);
            setErrorMessage(error.message || 'Signup failed. Please try again.');
        },
    });

    const onSubmit = (data: SignupFormInputs) => {
        setErrorMessage(null);
        // Exclude confirmPassword if you added it to the schema but don't send to backend
        const { /* confirmPassword, */ ...signupData } = data;
        mutation.mutate(signupData);
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-center mb-6">Create Account</h2>
            {errorMessage && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <span className="block sm:inline">{errorMessage}</span>
                </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                 <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Name (Optional)
                    </label>
                    <input
                        id="name"
                        type="text"
                        {...register('name')}
                        className={`w-full px-3 py-2 border ${errors.name ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                        disabled={mutation.isPending}
                    />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                </div>
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
                 {/* Optional: Confirm Password Field */}
                 {/* <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm Password
                    </label>
                    <input
                        id="confirmPassword"
                        type="password"
                        {...register('confirmPassword')}
                        className={`w-full px-3 py-2 border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                        disabled={mutation.isPending}
                    />
                    {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
                </div> */}
                <div>
                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? 'Creating Account...' : 'Sign Up'}
                    </button>
                </div>
            </form>
            <p className="text-center text-sm text-gray-600 mt-4">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                    Login
                </Link>
            </p>
        </div>
    );
};

export default SignupPage;