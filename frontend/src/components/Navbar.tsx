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

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/landing'); // Redirect to landing after logout
  };

  // Placeholder for profile navigation
  const handleProfileClick = () => {
      // navigate('/profile'); // Uncomment when profile page exists
      alert('Profile page not implemented yet.');
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
                <Link to="/dashboard">
                    {/* Use Button with variant="link" for text-like links */}
                    <Button variant="link" className="hidden sm:block text-sm font-medium text-gray-600 hover:text-blue-600 px-0">
                        Dashboard
                    </Button>
                </Link>

                {/* User Dropdown using shadcn/ui components */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    {/* Use Button with variant="ghost" for the trigger */}
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                       {/* You can use shadcn Avatar component here if added */}
                       {/* <Avatar className="h-8 w-8"> */}
                       {/*   <AvatarImage src={user.avatarUrl || undefined} alt={user.name || 'User'} /> */}
                       {/*   <AvatarFallback>{user.name ? user.name.charAt(0).toUpperCase() : <User size={16}/>}</AvatarFallback> */}
                       {/* </Avatar> */}

                       {/* Fallback if not using Avatar component */}
                        <span className="flex items-center justify-center h-full w-full rounded-full bg-blue-100 text-blue-600 font-semibold text-xs">
                            {user.name ? user.name.charAt(0).toUpperCase() : <User size={16}/>}
                        </span>
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
                    <DropdownMenuItem onClick={handleProfileClick} className="flex items-center cursor-pointer">
                       <Settings size={14} className="mr-2"/> Profile
                    </DropdownMenuItem>
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
              <div className="flex items-center space-x-2">
                <Link to="/login">
                  <Button variant="outline" size="sm">Log in</Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm">Sign up</Button>
                </Link>
              </div>
            )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;