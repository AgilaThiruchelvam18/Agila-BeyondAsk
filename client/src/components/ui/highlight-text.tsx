import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface HighlightTextProps {
  text: string;
  highlight?: string | string[];
  className?: string;
  animated?: boolean;
}

export const HighlightText: React.FC<HighlightTextProps> = ({
  text,
  highlight = '',
  className = '',
  animated = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Once the element is visible, we can stop observing it
          if (ref.current) observer.unobserve(ref.current);
        }
      },
      { threshold: 0.1 } // Trigger when at least 10% of the element is visible
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, []);

  // If no highlight terms, return the text as is
  if (!highlight || (Array.isArray(highlight) && highlight.length === 0)) {
    return <span className={className}>{text}</span>;
  }

  // Convert single string to array
  const terms = Array.isArray(highlight) ? highlight : [highlight];
  
  // Filter out empty terms
  const validTerms = terms.filter(term => term.trim().length > 0);
  
  // If no valid terms after filtering, return text as is
  if (validTerms.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Create regex pattern - escape special regex characters
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };
  
  // Join all terms with OR operator and make case insensitive
  const pattern = new RegExp(`(${validTerms.map(escapeRegExp).join('|')})`, 'gi');
  
  // Split text by matches
  const parts = text.split(pattern);

  return (
    <div ref={ref} className={className}>
      {parts.map((part, i) => {
        // Check if this part matches any of the highlight terms
        const isHighlight = validTerms.some(term => 
          part.toLowerCase() === term.toLowerCase()
        );

        if (isHighlight) {
          return (
            <span 
              key={i} 
              className={cn(
                "bg-yellow-200 font-medium rounded px-0.5 relative",
                animated && isVisible && "animate-highlight"
              )}
            >
              {part}
            </span>
          );
        }
        
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
};

export default HighlightText;