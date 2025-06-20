import React, { ReactNode } from 'react';
import { Link } from 'wouter';
import { 
  Home, 
  Bot, 
  Database, 
  Settings, 
  User, 
  MessageSquare, 
  HelpCircle,
  LogOut
} from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  // Handle logout
  const handleLogout = () => {
    // Clear local storage
    localStorage.removeItem('dhi_token');
    localStorage.removeItem('dhi_user');
    
    // Redirect to home page
    window.location.href = '/';
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-50 border-r border-gray-200 dark:bg-gray-800 dark:border-gray-700 p-4 hidden md:block">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary">BeyondAsk</h1>
        </div>
        
        <nav className="space-y-1">
          <NavItem href="/dashboard" icon={<Home size={18} />} label="Dashboard" />
          <NavItem href="/agents" icon={<Bot size={18} />} label="Agents" />
          <NavItem href="/knowledge-bases" icon={<Database size={18} />} label="Knowledge Bases" />
          <NavItem href="/chat" icon={<MessageSquare size={18} />} label="Chat" />
          <NavItem href="/unanswered-questions" icon={<HelpCircle size={18} />} label="Unanswered Questions" />
          <NavItem href="/pinecone-explorer" icon={<Database size={18} />} label="Pinecone Explorer" />
          <NavItem href="/profile" icon={<User size={18} />} label="Profile" />
          <NavItem href="/api-keys" icon={<Settings size={18} />} label="API Keys" />
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </nav>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900">
        {children}
      </main>
    </div>
  );
};

interface NavItemProps {
  href: string;
  icon: ReactNode;
  label: string;
}

const NavItem: React.FC<NavItemProps> = ({ href, icon, label }) => {
  // Get current path to determine active state
  const currentPath = window.location.pathname;
  const isActive = currentPath === href || 
                  (href !== '/dashboard' && currentPath.startsWith(href));
  
  return (
    <Link href={href}>
      <a className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
        isActive 
          ? 'bg-primary text-white' 
          : 'text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}>
        {icon}
        <span>{label}</span>
      </a>
    </Link>
  );
};

export default DashboardLayout;