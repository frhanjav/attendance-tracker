import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; // Corrected import path
import { Button } from '../components/ui/button'; // Import from shadcn path alias
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../components/ui/dropdown-menu'; // Import from shadcn path alias
import { Calendar, User, LogOut, LayoutDashboard, Settings, GraduationCap } from 'lucide-react'; // Import icons
import { config } from '../config'; // Import config

const GoogleIcon = () => (
  <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l0.001-0.001l6.19,5.238C39.712,34.466,44,28.756,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
  </svg>
);

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/landing'); // Redirect to landing after logout
  };

  // Placeholder for profile navigation
  // const handleProfileClick = () => {
  //     // navigate('/profile'); // Uncomment when profile page exists
  //     alert('Profile page not implemented yet.');
  // };

    // Function to initiate Google Login
    const handleGoogleLogin = () => {
      // Construct the absolute URL pointing to the backend via the proxy/host
      // We know the proxy runs on localhost:8080 in this test setup
      const backendApiPrefix = '/api/v1'; // Matches VITE_API_BASE_URL used for client-side fetch
      const proxyOrigin = window.location.origin; // Gets http://localhost:8080
      // We need the backend origin for the redirect, which might be different
      // For the local prod test, the backend is accessible via host port 3001
      // For actual deployment, it would be your domain.
      // Let's assume for this test, we redirect directly to backend's exposed port
      // OR rely on the proxy handling it (which failed before).
      // BEST APPROACH: Redirect to the path on the CURRENT origin (the proxy)
      const googleAuthUrl = `${proxyOrigin}${backendApiPrefix}/auth/google`; // e.g., http://localhost:8080/api/v1/auth/google
  
      // --- Alternative (if direct backend access needed, less ideal with proxy) ---
      // const backendOrigin = 'http://localhost:3001'; // Backend's direct access port
      // const googleAuthUrl = `${backendOrigin}${backendApiPrefix}/auth/google`;
      // ---
  
      console.log("Redirecting to Google Auth:", googleAuthUrl);
      window.location.href = googleAuthUrl; // Redirect browser
  };
  
  return (
    <header className="border-b border-gray-200 bg-white py-3 px-4 md:px-6 lg:px-8 sticky top-0 z-40">
      <div className="container mx-auto flex items-center justify-between">
        {/* Logo/Brand */}
        <Link to={user ? "/dashboard" : "/landing"} className="flex items-center space-x-2 text-xl font-bold text-blue-600 hover:opacity-80 transition-opacity">
          <Calendar className="h-6 w-6" />
          <span className="text-gray-900">TimeTable</span>
        </Link>

        {/* Navigation/Actions */}
        <div>
            {user ? (
              // --- Logged In State ---
              <div className="flex items-center space-x-4">
                

                {/* User Dropdown using shadcn/ui components */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                       <div className="flex items-center justify-center h-full w-full rounded-full bg-gray-100 text-gray-600">
                           <User className="h-4 w-4" /> {/* Use Lucide User icon */}
                       </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none text-gray-900">{user.name || 'User'}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                        {/* Add role if available on user object - adjust user type if needed */}
                        {/* {user.role && (
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground pt-1">
                            <GraduationCap className="h-3 w-3" />
                            <span className="capitalize">{user.role}</span>
                            </div>
                        )} */}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {/* Use DropdownMenuItem with asChild for Links */}
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard" className="flex items-center cursor-pointer">
                        <LayoutDashboard size={14} className="mr-2"/> Dashboard
                      </Link>
                    </DropdownMenuItem>
                    {/* <DropdownMenuItem onClick={handleProfileClick} className="flex items-center cursor-pointer">
                       <Settings size={14} className="mr-2"/> Profile
                    </DropdownMenuItem> */}
                    <DropdownMenuSeparator />
                    {/* Use DropdownMenuItem directly for actions */}
                    <DropdownMenuItem onClick={handleLogout} className="flex items-center text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer">
                      <LogOut size={14} className="mr-2"/> Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              // --- Logged Out State ---
              <div>
                <Button onClick={handleGoogleLogin} variant="outline" size="sm">
                    <GoogleIcon />
                    Sign in with Google
                </Button>
              </div>
            )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;