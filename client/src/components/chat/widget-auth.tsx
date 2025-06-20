import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowRight, Check } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';

interface WidgetAuthProps {
  widgetId: string;
  publicKey: string;
  onAuthenticated: (token: string) => void;
  onCancel: () => void;
  theme?: {
    primaryColor: string;
    textColor: string;
  };
}

export function WidgetAuth({
  widgetId,
  publicKey,
  onAuthenticated,
  onCancel,
  theme = {
    primaryColor: '#3498db',
    textColor: '#ffffff'
  }
}: WidgetAuthProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await apiRequest(`/api/widgets/${publicKey}/auth/otp`, {
        method: 'POST',
        data: { email }
      });
      
      if (response && response.success) {
        setStep('otp');
      } else {
        setError('Failed to send verification code. Please try again.');
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      setError('Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await apiRequest(`/api/widgets/${publicKey}/auth/verify`, {
        method: 'POST',
        data: { 
          email,
          code: otpCode,
          name: name.trim() || undefined 
        }
      });
      
      if (response && response.token) {
        onAuthenticated(response.token);
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setError('Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-lg">
          {step === 'email' ? 'Login to Chat' : 'Enter Verification Code'}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {error && (
          <div className="mb-4 p-2 bg-red-100 border border-red-200 text-red-600 text-sm rounded">
            {error}
          </div>
        )}
        
        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading || !email.trim()}
              style={{ 
                backgroundColor: theme.primaryColor, 
                color: theme.textColor 
              }}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Send Verification Code
            </Button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp-code">
                Enter the 6-digit code sent to {email}
              </Label>
              <Input
                id="otp-code"
                type="text"
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                maxLength={6}
                required
                disabled={isLoading}
                className="text-center text-lg tracking-widest"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading || otpCode.length !== 6}
              style={{ 
                backgroundColor: theme.primaryColor, 
                color: theme.textColor 
              }}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Verify
            </Button>
            
            <div className="text-center text-sm text-muted-foreground">
              <button
                type="button"
                className="underline hover:text-foreground"
                onClick={() => setStep('email')}
                disabled={isLoading}
              >
                Change email address
              </button>
            </div>
          </form>
        )}
      </CardContent>
      
      <CardFooter>
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}