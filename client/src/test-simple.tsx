import { createRoot } from "react-dom/client";

function SimpleApp() {
  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>BeyondAsk - Test App Loading</h1>
      <p>React application is working correctly!</p>
      <p>Timestamp: {new Date().toISOString()}</p>
    </div>
  );
}

try {
  console.log("Starting simple React app test...");
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }
  
  console.log("Root element found, mounting app...");
  createRoot(rootElement).render(<SimpleApp />);
  console.log("Simple React app mounted successfully");
} catch (error) {
  console.error("Failed to mount simple React app:", error);
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; text-align: center; font-family: Arial, sans-serif; background: #fee; border: 1px solid #f00;">
        <h1>React Mount Error</h1>
        <p>Failed to load the React application.</p>
        <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        <pre style="text-align: left; background: #f5f5f5; padding: 10px; margin: 10px;">${error instanceof Error ? error.stack : 'No stack trace available'}</pre>
      </div>
    `;
  }
}