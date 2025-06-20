import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HighlightText } from '@/components/ui/highlight-text';

export default function NotFoundPage() {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sample text with content to highlight
  const sampleText = `BeyondAsk is a powerful AI assistant that helps you manage knowledge and answer questions. 
  It uses advanced technology to process documents, videos, and other content sources.
  With BeyondAsk, you can create custom knowledge bases for your business or personal needs.
  The system leverages AI to provide accurate and contextual answers based on your data.
  Search functionality helps you find exactly what you need quickly and efficiently.`;
  
  return (
    <div className="container mx-auto px-4 py-16 max-w-6xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4 gradient-text">Search Highlighting Demo</h1>
        <p className="text-lg text-gray-600 mb-8">
          Type any word from the text below to see the highlight animation in action
        </p>
        
        <div className="flex gap-2 max-w-md mx-auto mb-12">
          <Input
            type="text"
            placeholder="Enter search term..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <Button variant="default" onClick={() => setSearchTerm('')}>
            Clear
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Original Text</CardTitle>
            <CardDescription>Without highlighting</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-800 leading-relaxed">
              {sampleText}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Highlighted Text</CardTitle>
            <CardDescription>With animated highlighting</CardDescription>
          </CardHeader>
          <CardContent>
            <HighlightText 
              text={sampleText}
              highlight={searchTerm}
              className="text-gray-800 leading-relaxed"
              animated={true}
            />
          </CardContent>
        </Card>
      </div>
      
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
          <CardDescription>Implementation details</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-800 leading-relaxed mb-4">
            The highlight component uses:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Intersection Observer API to trigger animations only when visible</li>
            <li>Regular expressions to identify matching text</li>
            <li>CSS animations for the highlight effect</li>
            <li>React hooks for state management</li>
          </ul>
          <p className="mt-4 text-gray-800">
            This component can be used throughout the application to highlight search terms or important information.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}