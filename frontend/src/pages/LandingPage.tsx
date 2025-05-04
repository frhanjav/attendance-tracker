import React from 'react';
import Navbar from '../components/Navbar'; // Use the Navbar component
import { Button } from '../components/ui/button'; // Import Button from shadcn path alias
import { Calendar, CheckCircle, BarChart, Users, Clock } from 'lucide-react'; // Example icons
import { config } from '../config'; // Import config

const GoogleIcon = () => (
    <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
        <path
            fill="#FFC107"
            d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
        ></path>
        <path
            fill="#FF3D00"
            d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
        ></path>
        <path
            fill="#4CAF50"
            d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
        ></path>
        <path
            fill="#1976D2"
            d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l0.001-0.001l6.19,5.238C39.712,34.466,44,28.756,44,24C44,22.659,43.862,21.35,43.611,20.083z"
        ></path>
    </svg>
);

const LandingPage: React.FC = () => {
    const handleGoogleLogin = () => {
        const googleAuthUrl = `${config.apiBaseUrl}/auth/google`;

        console.log("Redirecting to Google Auth:", googleAuthUrl);
        window.location.href = googleAuthUrl;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Navbar />

            {/* Hero Section */}
            <section className="bg-white py-16 md:py-24 px-4">
                <div className="container mx-auto max-w-6xl">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                        <div className="md:w-1/2 text-center md:text-left">
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-6">
                                Effortless Attendance Tracking & Scheduling
                            </h1>
                            <p className="mt-4 text-lg text-gray-600 mb-8">
                                Manage your academic life seamlessly. Create timetables, track
                                attendance percentage, calculate future needs, and stay organized –
                                all in one place.
                            </p>
                            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                                {/* Single Button to Sign in/Sign up with Google */}
                                <Button
                                    size="lg"
                                    className="w-full sm:w-auto"
                                    onClick={handleGoogleLogin}
                                >
                                    <GoogleIcon /> Get Started with Google
                                </Button>
                                {/* Removed separate Sign In / Get Started buttons */}
                            </div>
                        </div>

                        {/* <div className="md:w-1/2 mt-10 md:mt-0">
               Placeholder for an image or illustration 
              <div className="bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 p-8 rounded-lg shadow-lg aspect-video flex items-center justify-center">
                 <Calendar size={80} className="text-blue-500 opacity-80" />
                 {/* Or use an actual image: <img src="/path/to/hero-image.svg" alt="TimeTable Illustration" />
              </div>
            </div> */}

                        <div className="md:w-1/2">
                            <div className="relative">
                                <div className="absolute -left-4 -top-4 w-72 h-72 bg-indigo-100 rounded-full mix-blend-multiply filter blur-xl opacity-70"></div>
                                <div className="absolute -right-4 -bottom-4 w-72 h-72 bg-emerald-100 rounded-full mix-blend-multiply filter blur-xl opacity-70"></div>
                                <div className="relative">
                                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                                        <div className="bg-indigo-600 h-12 flex items-center px-4">
                                            <div className="flex space-x-2">
                                                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                            </div>
                                        </div>
                                        <div className="p-6">
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="text-xl font-semibold">
                                                    Weekly Timetable
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    May 2025
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-5 gap-2">
                                                {Array.from({ length: 25 }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`p-2 text-xs rounded ${
                                                            [2, 8, 11, 14, 19, 22].includes(i)
                                                                ? 'bg-indigo-100 text-indigo-800'
                                                                : [5, 9, 16, 20].includes(i)
                                                                  ? 'bg-emerald-100 text-emerald-800'
                                                                  : 'border border-gray-100'
                                                        }`}
                                                    >
                                                        {[
                                                            2, 8, 11, 14, 19, 22, 5, 9, 16, 20,
                                                        ].includes(i) && (
                                                            <>
                                                                <div className="font-medium">
                                                                    {[
                                                                        2, 8, 11, 14, 19, 22,
                                                                    ].includes(i)
                                                                        ? 'CS101'
                                                                        : 'Web Dev'}
                                                                </div>
                                                                <div className="text-xs opacity-80">
                                                                    Room 204
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="py-16 px-4 bg-gray-50">
                <div className="container mx-auto max-w-6xl">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        Core Features
                    </h2>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {/* Feature 1 */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-4">
                                <Users className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Stream Management</h3>
                            <p className="text-gray-600 text-sm">
                                Create or join streams (e.g., B.Tech CSE), share unique codes, and
                                manage members.
                            </p>
                        </div>
                        {/* Feature 2 */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 mb-4">
                                <Clock className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Timetable Creation</h3>
                            <p className="text-gray-600 text-sm">
                                Input weekly schedules with subjects, codes, and validity dates.
                                Manage multiple timetables per stream.
                            </p>
                        </div>
                        {/* Feature 3 */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mb-4">
                                <CheckCircle className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Daily & Bulk Attendance</h3>
                            <p className="text-gray-600 text-sm">
                                Mark daily class status (Occurred, Cancelled) or enter bulk
                                attendance numbers for quick percentage calculation.
                            </p>
                        </div>
                        {/* Feature 4 */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-600 mb-4">
                                <BarChart className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Analytics & Calculator</h3>
                            <p className="text-gray-600 text-sm">
                                View subject-wise stats and use the calculator to see how many
                                classes you need to attend for your target percentage.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-4 bg-blue-600">
                <div className="container mx-auto max-w-4xl text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Take Control of Your Attendance Today
                    </h2>
                    <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
                        Stop guessing your attendance percentage. Get organized and stay on track
                        with our easy-to-use tools.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        {/* Single Button */}
                        <Button
                            size="lg"
                            variant="secondary"
                            className="w-full sm:w-auto bg-white text-blue-600 hover:bg-gray-100"
                            onClick={handleGoogleLogin}
                        >
                            <GoogleIcon /> Sign Up / Sign In with Google
                        </Button>
                    </div>
                </div>
            </section>

            <footer className="bg-gray-900 text-gray-300 py-12 px-4 mt-auto">
                <div className="container mx-auto max-w-6xl">
                    <div className="flex flex-col md:flex-row justify-between">
                        <div className="mb-8 md:mb-0">
                            <div className="flex items-center">
                                <Calendar className="h-6 w-6 text-indigo-400 mr-2" />
                                <span className="text-white font-bold text-xl">TimeTable</span>
                            </div>
                            <p className="mt-4 max-w-xs text-gray-400">
                                The all-in-one platform for academic timetable management and
                                attendance tracking.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                            <div>
                                <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">
                                    Product
                                </h3>
                                <ul className="space-y-2">
                                    <li>
                                        <a href="#" className="text-gray-400 hover:text-white">
                                            Features
                                        </a>
                                    </li>
                                    <li>
                                        <a href="#" className="text-gray-400 hover:text-white">
                                            Pricing
                                        </a>
                                    </li>
                                    <li>
                                        <a href="#" className="text-gray-400 hover:text-white">
                                            FAQ
                                        </a>
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">
                                    Company
                                </h3>
                                <ul className="space-y-2">
                                    <li>
                                        <a href="#" className="text-gray-400 hover:text-white">
                                            About
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href="https://farhan.leverage.blog/"
                                            className="text-gray-400 hover:text-white"
                                        >
                                            Blog
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href="https://github.com/frhanjav"
                                            className="text-gray-400 hover:text-white"
                                        >
                                            Contact
                                        </a>
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">
                                    Legal
                                </h3>
                                <ul className="space-y-2">
                                    <li>
                                        <a href="#" className="text-gray-400 hover:text-white">
                                            Privacy
                                        </a>
                                    </li>
                                    <li>
                                        <a href="#" className="text-gray-400 hover:text-white">
                                            Terms
                                        </a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 pt-8 border-t border-gray-800 text-sm text-gray-400">
                        <p>© 2025 TimeTable. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
