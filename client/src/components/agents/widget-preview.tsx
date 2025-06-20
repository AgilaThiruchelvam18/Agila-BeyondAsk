import { useEffect, useRef } from 'react';
import { X, MessageSquare } from 'lucide-react';

interface WidgetPreviewProps {
  config: {
    theme: {
      primaryColor: string;
      textColor: string;
      backgroundColor: string;
    };
    position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    size: 'small' | 'medium' | 'large';
    welcomeMessage: string;
    widgetTitle: string;
    brandName: string;
    collectName: boolean;
    collectEmail: boolean;
    collectPhone: boolean;
    requireOtpVerification: boolean;
  };
  agentName: string;
}

export function WidgetPreview({ config, agentName }: WidgetPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Adjust preview based on selected positioning
  // This is just for visual representation within the preview panel
  const getWidgetPosition = () => {
    // Always center in the preview container, but add a class to indicate the position
    return `absolute bottom-4 right-4`;
  };
  
  // Simulate widget size
  const getWidgetSize = () => {
    switch (config.size) {
      case 'small': return 'w-60 h-64';
      case 'large': return 'w-72 h-96';
      case 'medium':
      default: return 'w-64 h-80';
    }
  };
  
  // Create a mini preview version of what the chat window would look like
  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-md p-4">
      {/* Chat container (always shown in preview) */}
      <div className={`relative ${getWidgetSize()} shadow-lg rounded-lg bg-white dark:bg-gray-900 overflow-hidden flex flex-col border`}>
        {/* Header */}
        <div 
          className="p-2 flex justify-between items-center"
          style={{ backgroundColor: config.theme.primaryColor, color: config.theme.textColor }}
        >
          <div className="flex flex-col">
            <h3 className="font-semibold text-sm">{config.widgetTitle || agentName}</h3>
            <span className="text-xs opacity-75">{config.brandName}</span>
          </div>
          <button className="p-1 rounded-md hover:bg-white/10">
            <X className="h-4 w-4" style={{ color: config.theme.textColor }} />
          </button>
        </div>
        
        {/* Chat body */}
        <div 
          className="flex-1 p-3 overflow-y-auto"
          style={{ backgroundColor: config.theme.backgroundColor }}
        >
          {/* Welcome message */}
          <div className="flex items-start mb-3 max-w-[85%]">
            <div 
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-2"
              style={{ backgroundColor: config.theme.primaryColor, color: config.theme.textColor }}
            >
              {(config.widgetTitle || agentName).charAt(0)}
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg text-xs">
              {config.welcomeMessage}
            </div>
          </div>
          
          {/* User fields (conditionally shown based on config) */}
          {(config.collectName || config.collectEmail || config.collectPhone) && (
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md space-y-2 mt-2">
              <p className="text-xs font-medium">Please provide your information:</p>
              
              {config.collectName && (
                <div className="flex flex-col space-y-1">
                  <label className="text-xs text-gray-600 dark:text-gray-400">Name</label>
                  <div className="h-6 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600"></div>
                </div>
              )}
              
              {config.collectEmail && (
                <div className="flex flex-col space-y-1">
                  <label className="text-xs text-gray-600 dark:text-gray-400">Email</label>
                  <div className="h-6 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600"></div>
                </div>
              )}
              
              {config.collectPhone && (
                <div className="flex flex-col space-y-1">
                  <label className="text-xs text-gray-600 dark:text-gray-400">Phone</label>
                  <div className="h-6 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600"></div>
                </div>
              )}
              
              {config.requireOtpVerification && config.collectEmail && (
                <div className="mt-2">
                  <div 
                    className="text-[8px] text-white px-1 py-0.5 rounded inline-block"
                    style={{ backgroundColor: config.theme.primaryColor }}
                  >
                    OTP Verification Required
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Input area */}
        <div 
          className="p-2 border-t border-gray-200 dark:border-gray-700 flex items-center"
          style={{ backgroundColor: config.theme.backgroundColor }}
        >
          <div className="flex-1 h-7 bg-gray-100 dark:bg-gray-700 rounded-md mr-2"></div>
          <button 
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ backgroundColor: config.theme.primaryColor }}
          >
            <span className="text-[9px]" style={{ color: config.theme.textColor }}>Send</span>
          </button>
        </div>
      </div>
      
      {/* Chat bubble button */}
      <div className={`${getWidgetPosition()}`}>
        <button
          className="rounded-full p-3 shadow-lg"
          style={{ backgroundColor: config.theme.primaryColor }}
        >
          <MessageSquare className="h-5 w-5" style={{ color: config.theme.textColor }} />
        </button>
      </div>
    </div>
  );
}