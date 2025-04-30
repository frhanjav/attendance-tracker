import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar'; // Use the Navbar component
import { Button } from '../components/ui/button'; // Import Button from shadcn path alias
import { Calendar, CheckCircle, BarChart, Users, Clock } from 'lucide-react'; // Example icons

const LandingPage: React.FC = () => {
  // No need for useAuth here, routing handles redirection if logged in

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
                Manage your academic life seamlessly. Create timetables, track attendance percentage, calculate future needs, and stay organized – all in one place.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                {/* Use shadcn Button with Link */}
                <Button size="lg" className="w-full sm:w-auto" asChild>
                  <Link to="/signup">Get Started Free</Link>
                </Button>
                <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
                  <Link to="/login">Sign In</Link>
                </Button>
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
                        <div className="text-xl font-semibold">Weekly Timetable</div>
                        <div className="text-sm text-gray-500">May 2025</div>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {Array.from({ length: 25 }).map((_, i) => (
                          <div
                            key={i}
                            className={`p-2 text-xs rounded ${
                              [2, 8, 11, 14, 19, 22].includes(i)
                                ? "bg-indigo-100 text-indigo-800"
                                : [5, 9, 16, 20].includes(i)
                                ? "bg-emerald-100 text-emerald-800"
                                : "border border-gray-100"
                            }`}
                          >
                            {[2, 8, 11, 14, 19, 22, 5, 9, 16, 20].includes(i) && (
                              <>
                                <div className="font-medium">
                                  {[2, 8, 11, 14, 19, 22].includes(i) ? "CS101" : "Web Dev"}
                                </div>
                                <div className="text-xs opacity-80">Room 204</div>
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
                Create or join streams (e.g., B.Tech CSE), share unique codes, and manage members.
              </p>
            </div>
             {/* Feature 2 */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 mb-4">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Timetable Creation</h3>
              <p className="text-gray-600 text-sm">
                Input weekly schedules with subjects, codes, and validity dates. Manage multiple timetables per stream.
              </p>
            </div>
             {/* Feature 3 */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mb-4">
                <CheckCircle className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Daily & Bulk Attendance</h3>
              <p className="text-gray-600 text-sm">
                Mark daily class status (Occurred, Cancelled) or enter bulk attendance numbers for quick percentage calculation.
              </p>
            </div>
             {/* Feature 4 */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-600 mb-4">
                <BarChart className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Analytics & Calculator</h3>
              <p className="text-gray-600 text-sm">
                View subject-wise stats and use the calculator to see how many classes you need to attend for your target percentage.
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
            Stop guessing your attendance percentage. Get organized and stay on track with our easy-to-use tools.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
             {/* Use shadcn Button with Link */}
            <Button size="lg" variant="secondary" className="w-full sm:w-auto bg-white text-blue-600 hover:bg-gray-200" asChild>
               <Link to="/signup">Sign Up Now</Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto border-white bg-blue-600 text-white hover:bg-gray-100" asChild>
               <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      {/* <footer className="bg-gray-800 text-gray-400 py-8 px-4 mt-auto">
        <div className="container mx-auto max-w-6xl text-center text-sm">
          <p>© {new Date().getFullYear()} TimeTable. All rights reserved.</p>
        </div>
      </footer> */}

<footer className="bg-gray-900 text-gray-300 py-12 px-4 mt-auto">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between">
            <div className="mb-8 md:mb-0">
              <div className="flex items-center">
                <Calendar className="h-6 w-6 text-indigo-400 mr-2" />
                <span className="text-white font-bold text-xl">TimeTable</span>
              </div>
              <p className="mt-4 max-w-xs text-gray-400">
                The all-in-one platform for academic timetable management and attendance tracking.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">
                  Product
                </h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white">Features</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Pricing</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">FAQ</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">
                  Company
                </h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white">About</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Blog</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Contact</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">
                  Legal
                </h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white">Privacy</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Terms</a></li>
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