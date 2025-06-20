import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }
  
  console.log("Mounting React app...");
  createRoot(rootElement).render(<App />);
  console.log("React app mounted successfully");
} catch (error) {
  console.error("Failed to mount React app:", error);
  console.error("Error details:", error);
  console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
  
  // Show detailed error message for debugging
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; text-align: center; font-family: Arial, sans-serif; border: 2px solid #f00; background: #fee;">
        <h1>BeyondAsk - Application Loading Error</h1>
        <p>Failed to load the React application. Debugging information:</p>
        <pre style="text-align: left; background: #f5f5f5; padding: 10px; margin: 10px; border: 1px solid #ccc; white-space: pre-wrap;">
Error: ${error instanceof Error ? error.message : 'Unknown error'}

Stack Trace:
${error instanceof Error ? error.stack || 'No stack trace available' : 'No stack trace available'}
        </pre>
        <p>Server is running at: <a href="/health" target="_blank">/health</a></p>
        <p>API status: <a href="/api/health" target="_blank">/api/health</a></p>
      </div>
    `;
  }
}
