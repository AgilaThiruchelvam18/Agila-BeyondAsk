import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

// Declare global Window interface extension
declare global {
  interface Window {
    beyondWidget?: any;
  }
}

export default function WidgetTestPage() {
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [widgetDomPresent, setWidgetDomPresent] = useState(false);
  
  // Effect to check for widget DOM presence
  useEffect(() => {
    const checkWidgetPresence = () => {
      const widgetPresent = !!document.getElementById('beyond-widget-container');
      setWidgetDomPresent(widgetPresent);
    };
    
    // Check immediately
    checkWidgetPresence();
    
    // Set up periodic check
    const intervalId = setInterval(checkWidgetPresence, 1000);
    
    return () => clearInterval(intervalId);
  }, []);
  useEffect(() => {
    console.log('Widget test page mounted - SIMPLIFIED VERSION');
    
    // First clean up any existing widget elements
    const existingContainer = document.getElementById('beyond-widget-container');
    if (existingContainer) {
      console.log('Removing existing widget container');
      existingContainer.remove();
    }
    
    // Create and load the widget script
    console.log('Loading widget script (simple version)...');
    const script = document.createElement('script');
    script.src = '/widget.js?t=' + new Date().getTime(); // Add cache-busting query parameter
    script.async = true;
    
    // Track load status
    script.onload = () => {
      console.log('Widget script loaded successfully');
      setWidgetLoaded(true);
    };
    
    script.onerror = (error) => {
      console.error('Failed to load widget script:', error);
    };

    // Add script to page
    document.body.appendChild(script);

    // Cleanup function
    return () => {
      if (script.parentNode) {
        document.body.removeChild(script);
      }
      
      const widgetContainer = document.getElementById('beyond-widget-container');
      if (widgetContainer && widgetContainer.parentNode) {
        widgetContainer.parentNode.removeChild(widgetContainer);
      }
    };
  }, []);

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Widget Test Page</h1>
        
        <div className="bg-gray-50 p-6 rounded-lg border mb-8">
          <h2 className="text-xl font-semibold mb-4">Widget Test Environment</h2>
          
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-3 h-3 rounded-full ${widgetLoaded ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-medium">
              Widget Script Status: {widgetLoaded ? 'Loaded' : 'Loading...'}
            </span>
          </div>
          
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-3 h-3 rounded-full ${widgetDomPresent ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-medium">
              Widget DOM Status: {widgetDomPresent ? 'Visible' : 'Not Found'}
            </span>
            {!widgetDomPresent && (
              <button 
                onClick={() => window.location.reload()}
                className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Reload Page
              </button>
            )}
          </div>
          
          <p className="mb-4">
            This page is used to test the BeyondAsk Chat Widget. The widget should appear as a
            <strong className="text-red-600"> bright red </strong> 
            chat button in the bottom-right corner of this page.
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>Click the chat button to open the widget</li>
            <li>Send test messages to verify functionality</li>
            <li>The widget should simulate responses</li>
          </ul>
          <p className="text-sm text-gray-500 italic">
            Note: This is a test environment with a simplified widget implementation.
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg border shadow-sm mb-6">
          <h2 className="text-xl font-semibold mb-4">Widget Code Example</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto mb-4">
            {`<!-- BeyondAsk Widget Code -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['BeyondAskWidget']=o;w[o]=w[o]||function(){
      (w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','beyondWidget',window.location.origin + '/widget.js'));
  
  beyondWidget('init', {
    publicKey: 'your_widget_key_here', // Your unique widget key
    position: 'bottom-right',        // Options: 'bottom-right', 'bottom-left', 'top-right', 'top-left'
    size: 'medium',                  // Options: 'small', 'medium', 'large'
    welcomeMessage: 'Hello! How can I help you today?',
    widgetTitle: 'AI Assistant',
    brandName: 'BeyondAsk',
    theme: 'light',                  // Options: 'light' or 'dark'
    primaryColor: '#0078d4',         // Main color for widget bubble and accents
    themeConfig: {
      primaryColor: '#0078d4',
      textColor: '#333333',
      backgroundColor: '#ffffff',
      bubbleIcon: null                // Custom SVG icon for the chat bubble (optional)
    }
  });
</script>`}
          </pre>
          <p className="text-sm text-gray-600 mb-2">
            This code can be added to any webpage to enable the BeyondAsk chat widget.
            Customize the parameters to match your branding and needs.
          </p>
        </div>
        
        <div className="flex justify-between items-center">
          <Link href="/">
            <Button variant="outline">
              Back to Dashboard
            </Button>
          </Link>
          
          <Button 
            onClick={() => {
              // @ts-ignore
              if (window.beyondWidget) window.beyondWidget('track', 'test_event');
            }}
          >
            Test Track Event
          </Button>
        </div>
      </div>
    </div>
  );
}