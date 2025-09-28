import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../components/ui/dropdown-menu';
import { Calendar, User, LogOut, LayoutDashboard} from 'lucide-react';
import { handleGoogleLogin } from '../utils/auth';
import { GoogleIcon } from './icons/GoogleIcon';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/landing');
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
              <div className="flex items-center space-x-4">
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                       <div className="flex items-center justify-center h-full w-full rounded-full bg-gray-100 text-gray-600">
                           <User className="h-4 w-4" />
                       </div>
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none text-gray-900">{user.name || 'User'}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem asChild>
                      <Link to="/dashboard" className="flex items-center cursor-pointer">
                        <LayoutDashboard size={14} className="mr-2"/> Dashboard
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={handleLogout} className="flex items-center text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer">
                      <LogOut size={14} className="mr-2"/> Log out
                    </DropdownMenuItem>

                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div>
                <Button onClick={handleGoogleLogin} variant="outline" size="sm">
                    <GoogleIcon className="w-4 h-4 mr-2" />
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