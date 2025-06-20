import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  size = 'md',
  showText = true 
}) => {
  // Size mappings
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`flex items-center ${className}`}>
      <svg
        className={sizeMap[size]}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="40" height="40" rx="8" fill="url(#paint0_linear)" />
        <path d="M12 20C12 13.9249 16.9249 9 23 9V31C16.9249 31 12 26.0751 12 20Z" fill="white"/>
        <path d="M24 15H28C29.6569 15 31 16.3431 31 18V22C31 23.6569 29.6569 25 28 25H24V15Z" fill="white"/>
        <defs>
          <linearGradient id="paint0_linear" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6D6AFF" />
            <stop offset="1" stopColor="#FF4BCB" />
          </linearGradient>
        </defs>
      </svg>
      
      {showText && (
        <span className="ml-2 text-lg font-semibold">
          Beyond<span className="text-secondary-color">Ask</span>
        </span>
      )}
    </div>
  );
};

export default Logo;