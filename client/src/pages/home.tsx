import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import { LoginButton } from "@/components/auth/login-button";
import { useAuth } from "@/components/auth/auth-provider";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BrainCircuit, 
  Database, 
  MessageSquare, 
  Zap, 
  CheckCircle, 
  Globe,
  BookOpen,
  Star, 
  Shield, 
  Code, 
  ArrowRight, 
  Users, 
  BarChart, 
  Lock, 
  Sparkles,
  HelpCircle
} from "lucide-react";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  


  const pricingPlans = [
    {
      name: "Starter",
      price: {
        monthly: "9",
        annual: "7"
      },
      description: "Perfect for individuals and small projects",
      features: [
        "1 AI Agent",
        "3 Knowledge Bases",
        "100 MB Storage",
        "500 Questions/month",
        "Basic Analytics",
        "Community Support"
      ],
      highlighted: false,
      buttonText: "Start Free Trial",
      callout: "",
    },
    {
      name: "Professional",
      price: {
        monthly: "29",
        annual: "23"
      },
      description: "Ideal for small teams and growing businesses",
      features: [
        "5 AI Agents",
        "10 Knowledge Bases",
        "5 GB Storage",
        "5,000 Questions/month",
        "Advanced Analytics",
        "Priority Support",
        "Widget Embedding",
        "Custom Domains"
      ],
      highlighted: true,
      buttonText: "Get Started",
      callout: "Most Popular",
    },
    {
      name: "Enterprise",
      price: {
        monthly: "99",
        annual: "79"
      },
      description: "For organizations with advanced needs",
      features: [
        "Unlimited AI Agents",
        "Unlimited Knowledge Bases",
        "50 GB Storage",
        "50,000 Questions/month",
        "Enterprise Analytics",
        "Dedicated Support",
        "API Access",
        "SSO & Advanced Security",
        "Custom Integrations",
        "SLA Guarantee"
      ],
      highlighted: false,
      buttonText: "Contact Sales",
      callout: "",
    }
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <div className="flex-1">
        {/* Hero section */}
        <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden relative bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center">
              <div className="md:w-1/2 mb-12 md:mb-0">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                  Intelligent <span className="gradient-text">Automation</span> for Knowledge Workflows
                </h1>
                <p className="text-gray-500 text-lg md:text-xl mb-8 max-w-lg">
                  BeyondAsk leverages advanced AI to transform your documents and content into searchable knowledge bases,
                  boosting productivity while providing accurate answers.
                </p>
                <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                  {isAuthenticated ? (
                    <Link href="/dashboard">
                      <button className="btn-primary rounded-lg px-8 py-4 font-semibold text-lg">
                        Go to Dashboard
                      </button>
                    </Link>
                  ) : (
                    <LoginButton className="btn-primary rounded-lg px-8 py-4 font-semibold text-lg h-auto" variant="default" />
                  )}
                  <a href="#pricing">
                    <button className="btn-secondary rounded-lg px-8 py-4 font-semibold text-lg">
                      View Pricing
                    </button>
                  </a>
                </div>
                <div className="mt-8 flex items-center space-x-2">
                  <div className="flex -space-x-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white" />
                    ))}
                  </div>
                  <p className="text-gray-500"><span className="font-medium text-gray-800">500+</span> companies trust BeyondAsk</p>
                </div>
              </div>
              <div className="md:w-1/2 relative">
                {/* Hero image/illustration with floating elements */}
                <div className="w-full h-80 md:h-96 lg:h-112 relative">
                  <div className="hero-glow bg-primary"></div>
                  
                  {/* Floating UI element 1 */}
                  <div className="hero-element top-1/3 left-1/3 w-32 h-32 float">
                    <div className="w-full h-2 bg-accent rounded mb-2"></div>
                    <div className="w-3/4 h-2 bg-gray-200 rounded mb-4"></div>
                    <div className="flex justify-between items-center">
                      <div className="w-8 h-8 rounded-full bg-amber-400"></div>
                      <div className="w-1/2 h-2 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                  
                  {/* Floating UI element 2 */}
                  <div className="hero-element bottom-1/3 right-1/3 w-40 h-40 float float-delay-1">
                    <div className="w-full h-2 bg-secondary rounded mb-2"></div>
                    <div className="w-2/3 h-2 bg-gray-200 rounded mb-4"></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="w-full h-8 rounded bg-gray-100"></div>
                      <div className="w-full h-8 rounded bg-gray-100"></div>
                      <div className="w-full h-8 rounded bg-gray-100"></div>
                      <div className="w-full h-8 rounded bg-gray-100"></div>
                    </div>
                  </div>
                  
                  {/* Floating UI element 3 */}
                  <div className="hero-element top-1/4 right-1/4 w-36 h-36 float float-delay-2">
                    <div className="w-full h-2 bg-primary rounded mb-2"></div>
                    <div className="w-1/2 h-2 bg-gray-200 rounded mb-6"></div>
                    <div className="w-full h-20 rounded bg-gray-100 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-accent"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-1/4 left-10 w-2 h-2 rounded-full bg-secondary opacity-70"></div>
          <div className="absolute top-1/3 left-20 w-3 h-3 rounded-full bg-accent opacity-70"></div>
          <div className="absolute top-2/3 left-12 w-4 h-4 rounded-full bg-primary opacity-70"></div>
          <div className="absolute top-1/2 right-10 w-3 h-3 rounded-full bg-amber-400 opacity-70"></div>
          <div className="absolute bottom-1/4 right-20 w-2 h-2 rounded-full bg-secondary opacity-70"></div>
        </section>

        {/* Partners section */}
        <section className="w-full py-8 border-y border-gray-100 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <p className="text-sm text-gray-500 uppercase tracking-wider">Trusted by innovative companies</p>
              <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 py-4 opacity-70">
                {['Company', 'Enterprise', 'Startup', 'Partners', 'Platform'].map((item, index) => (
                  <div key={index} className="text-gray-400 font-bold text-xl">{item}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features section */}
        <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-3">Features</h2>
              <h3 className="text-3xl md:text-4xl font-bold mb-4">
                Everything You Need to <span className="gradient-text">Supercharge</span> Your Knowledge
              </h3>
              <p className="text-gray-500 text-xl max-w-3xl mx-auto">
                BeyondAsk provides a comprehensive suite of tools for embedding, organizing, and deploying AI-powered knowledge assistants.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="feature-card">
                <div className="feature-icon-wrapper feature-icon-primary">
                  <Database className="feature-icon text-primary" />
                </div>
                <h4 className="text-xl font-bold mb-2">Knowledge Bases</h4>
                <p className="text-gray-500">
                  Create intelligent repositories from your documents, websites, and other sources with advanced vector embedding technology.
                </p>
              </div>
              
              {/* Feature 2 */}
              <div className="feature-card">
                <div className="feature-icon-wrapper feature-icon-secondary">
                  <BrainCircuit className="feature-icon text-secondary" />
                </div>
                <h4 className="text-xl font-bold mb-2">AI Agents</h4>
                <p className="text-gray-500">
                  Configure custom agents with personality, expertise, and knowledge access to handle specific use cases with precision.
                </p>
              </div>
              
              {/* Feature 3 */}
              <div className="feature-card">
                <div className="feature-icon-wrapper feature-icon-accent">
                  <MessageSquare className="feature-icon text-accent" />
                </div>
                <h4 className="text-xl font-bold mb-2">Semantic Search</h4>
                <p className="text-gray-500">
                  Find precisely what you need with powerful vector-based search that understands context and meaning, not just keywords.
                </p>
              </div>
              
              {/* Feature 4 */}
              <div className="feature-card">
                <div className="feature-icon-wrapper feature-icon-highlight">
                  <Globe className="feature-icon text-amber-400" />
                </div>
                <h4 className="text-xl font-bold mb-2">Website Embedding</h4>
                <p className="text-gray-500">
                  Embed your knowledge assistant on any website with our customizable widget for seamless integration with your existing systems.
                </p>
              </div>
              
              {/* Feature 5 */}
              <div className="feature-card">
                <div className="feature-icon-wrapper feature-icon-primary">
                  <HelpCircle className="feature-icon text-primary" />
                </div>
                <h4 className="text-xl font-bold mb-2">Unanswered Questions</h4>
                <p className="text-gray-500">
                  Automatically detect and manage knowledge gaps to continuously improve your assistant's capabilities and performance.
                </p>
              </div>
              
              {/* Feature 6 */}
              <div className="feature-card">
                <div className="feature-icon-wrapper feature-icon-secondary">
                  <Lock className="feature-icon text-secondary" />
                </div>
                <h4 className="text-xl font-bold mb-2">Privacy & Security</h4>
                <p className="text-gray-500">
                  Enterprise-grade security with data isolation, encryption, and compliance features built-in for peace of mind.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works section */}
        <section className="w-full bg-gray-50 py-12 md:py-24 lg:py-32">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <Badge className="w-fit" variant="outline">How It Works</Badge>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                  Simple Process, Powerful Results
                </h2>
                <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Get started in minutes and see immediate value from your knowledge
                </p>
              </div>
            </div>
            <div className="mx-auto max-w-5xl py-12">
              <div className="grid gap-8 md:grid-cols-3">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border-2 border-primary text-primary text-xl font-bold">1</div>
                  <h3 className="text-xl font-bold">Upload Knowledge</h3>
                  <p className="text-gray-500">
                    Upload documents, connect to websites, or enter text directly into knowledge bases
                  </p>
                </div>
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border-2 border-primary text-primary text-xl font-bold">2</div>
                  <h3 className="text-xl font-bold">Configure Agents</h3>
                  <p className="text-gray-500">
                    Set up AI agents with specific personalities, access to knowledge, and functionality
                  </p>
                </div>
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border-2 border-primary text-primary text-xl font-bold">3</div>
                  <h3 className="text-xl font-bold">Deploy & Integrate</h3>
                  <p className="text-gray-500">
                    Use built-in chat interfaces or embed widgets on your website for seamless interaction
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Flexible Pricing Plans</h2>
              <p className="text-text-secondary text-lg max-w-2xl mx-auto">
                Choose the perfect plan for your business needs with transparent pricing and no hidden fees.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Starter Plan */}
              <div className="pricing-card rounded-lg overflow-hidden relative">
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-2">Starter</h3>
                  <p className="text-text-secondary mb-6">Perfect for small teams and startups</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">$49</span>
                    <span className="text-text-secondary">/month</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center">
                      <div className="w-5 h-5 rounded-full bg-accent mr-3 flex-shrink-0"></div>
                      <span>Up to 5 users</span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-5 h-5 rounded-full bg-accent mr-3 flex-shrink-0"></div>
                      <span>10 automated workflows</span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-5 h-5 rounded-full bg-accent mr-3 flex-shrink-0"></div>
                      <span>Basic analytics</span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-5 h-5 rounded-full bg-accent mr-3 flex-shrink-0"></div>
                      <span>Email support</span>
                    </li>
                  </ul>
                  <button className="btn-primary w-full rounded-lg py-3 font-medium text-white">
                    Get Started
                  </button>
                </div>
              </div>
              
              {/* Professional Plan */}
              <div className="pricing-card rounded-lg overflow-hidden relative border-2">
                <div className="bg-primary text-center py-1 text-sm font-medium text-white">
                  Most Popular
                </div>
                <div className="p-6 pt-10">
                  <h3 className="text-xl font-semibold mb-2">Professional</h3>
                  <p className="text-text-secondary mb-6">Ideal for growing businesses</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">$149</span>
                    <span className="text-text-secondary">/month</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center">
                      <div className="w-5 h-5 rounded-full bg-secondary mr-3 flex-shrink-0"></div>
                      <span>Up to 20 users</span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-5 h-5 rounded-full bg-secondary mr-3 flex-shrink-0"></div>
                      <span>Unlimited workflows</span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-5 h-5 rounded-full bg-secondary mr-3 flex-shrink-0"></div>
                      <span>Advanced analytics</span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-5 h-5 rounded-full bg-secondary mr-3 flex-shrink-0"></div>
                      <span>Priority support</span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-5 h-5 rounded-full bg-secondary mr-3 flex-shrink-0"></div>
                      <span>Custom integrations</span>
                    </li>
                  </ul>
                  <button className="btn-primary w-full rounded-lg py-3 font-medium text-white">
                    Get Started
                  </button>
                </div>
              </div>
              
              {/* Enterprise Plan */}
              <div className="pricing-card rounded-lg overflow-hidden relative">
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-2">Enterprise</h3>
                  <p className="text-text-secondary mb-6">For large organizations</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">Custom</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center">
                      <div className="w-5 h-5 rounded-full bg-highlight mr-3 flex-shrink-0"></div>
                      <span>Unlimited users</span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-5 h-5 rounded-full bg-highlight mr-3 flex-shrink-0"></div>
                      <span>Unlimited workflows</span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-5 h-5 rounded-full bg-highlight mr-3 flex-shrink-0"></div>
                      <span>Custom analytics dashboards</span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-5 h-5 rounded-full bg-highlight mr-3 flex-shrink-0"></div>
                      <span>24/7 dedicated support</span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-5 h-5 rounded-full bg-highlight mr-3 flex-shrink-0"></div>
                      <span>Enterprise-level security</span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-5 h-5 rounded-full bg-highlight mr-3 flex-shrink-0"></div>
                      <span>On-premise option</span>
                    </li>
                  </ul>
                  <button className="btn-secondary w-full rounded-lg py-3 font-medium">
                    Contact Sales
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials section */}
        <section className="w-full bg-gray-50 py-12 md:py-24 lg:py-32">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <Badge className="w-fit" variant="outline">Testimonials</Badge>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                  Trusted by Innovators
                </h2>
                <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  See what our customers are saying about our platform
                </p>
              </div>
            </div>
            
            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 py-12 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  quote: "BeyondAsk has transformed how we manage our documentation. Our support team is 60% more efficient.",
                  author: "Sarah Johnson",
                  role: "Director of Support, TechCorp"
                },
                {
                  quote: "The AI agents understand our complex product perfectly. Our customers get instant, accurate answers 24/7.",
                  author: "Michael Chen",
                  role: "CTO, SaaS Solutions"
                },
                {
                  quote: "We've embedded the knowledge widget on our help center and reduced support tickets by 40% in the first month.",
                  author: "Amanda Rivera",
                  role: "Head of Customer Success, DataFlow"
                }
              ].map((testimonial, index) => (
                <div key={index} className="flex flex-col space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  <p className="flex-1 text-gray-600 italic">"{testimonial.quote}"</p>
                  <div>
                    <p className="font-semibold">{testimonial.author}</p>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="w-full bg-white py-12 md:py-24 lg:py-32">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <Badge className="w-fit" variant="outline">FAQ</Badge>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                  Frequently Asked Questions
                </h2>
                <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Find answers to common questions about our platform
                </p>
              </div>
            </div>
            
            <div className="mx-auto max-w-3xl space-y-8 py-12">
              {[
                {
                  question: "How does BeyondAsk work?",
                  answer: "BeyondAsk uses advanced AI to process your documents, websites, and other content into searchable knowledge bases. Our system creates vector embeddings that allow AI agents to understand the context and deliver accurate answers based on your data."
                },
                {
                  question: "What types of content can I upload?",
                  answer: "You can upload PDFs, text documents, website URLs, and direct text input. Our system processes and indexes all this content to make it accessible to your AI agents."
                },
                {
                  question: "Is my data secure?",
                  answer: "Yes! We use enterprise-grade security measures including data isolation, encryption at rest and in transit, and role-based access controls. Your data is only used to power your agents and is never shared."
                },
                {
                  question: "How do I integrate with my website?",
                  answer: "Our platform provides customizable widgets that can be embedded on any website with a simple code snippet. You can customize the appearance and behavior to match your brand."
                },
                {
                  question: "Can I use my own LLM provider?",
                  answer: "Yes, our Enterprise plan allows you to connect to your preferred LLM providers such as OpenAI, Anthropic, and others. You can even use your own API keys for maximum flexibility."
                }
              ].map((faq, index) => (
                <div key={index} className="space-y-2">
                  <h3 className="text-xl font-bold">{faq.question}</h3>
                  <p className="text-gray-500">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <Badge className="w-fit" variant="secondary">Get Started Today</Badge>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                  Ready to Transform Your Knowledge?
                </h2>
                <p className="max-w-[600px] text-gray-600 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Join thousands of professionals using BeyondAsk to power their intelligent knowledge systems.
                </p>
              </div>
              <div className="mx-auto w-full max-w-sm space-y-2">
                {isAuthenticated ? (
                  <Link href="/dashboard">
                    <Button size="lg" className="w-full font-medium">
                      <Zap className="mr-2 h-4 w-4" />
                      Go to Dashboard
                    </Button>
                  </Link>
                ) : (
                  <LoginButton className="w-full" />
                )}
                <p className="text-sm text-gray-500 mt-2">No credit card required to start your free trial</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t bg-white">
          <div className="container mx-auto px-4 py-12">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <BrainCircuit className="h-6 w-6 text-primary" />
                  <h3 className="text-xl font-bold">BeyondAsk</h3>
                </div>
                <p className="text-gray-500">
                  Transform your information into intelligent agents that answer questions and provide insights.
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-bold">Product</h3>
                <ul className="space-y-2">
                  <li><a href="#features" className="text-gray-500 hover:text-gray-900">Features</a></li>
                  <li><a href="#pricing" className="text-gray-500 hover:text-gray-900">Pricing</a></li>
                  <li><a href="#" className="text-gray-500 hover:text-gray-900">Integrations</a></li>
                  <li><a href="#" className="text-gray-500 hover:text-gray-900">Enterprise</a></li>
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-bold">Company</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-500 hover:text-gray-900">About Us</a></li>
                  <li><a href="#" className="text-gray-500 hover:text-gray-900">Careers</a></li>
                  <li><a href="#" className="text-gray-500 hover:text-gray-900">Blog</a></li>
                  <li><a href="#" className="text-gray-500 hover:text-gray-900">Contact</a></li>
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-bold">Legal</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-500 hover:text-gray-900">Privacy Policy</a></li>
                  <li><a href="#" className="text-gray-500 hover:text-gray-900">Terms of Service</a></li>
                  <li><a href="#" className="text-gray-500 hover:text-gray-900">Cookie Policy</a></li>
                  <li><a href="#" className="text-gray-500 hover:text-gray-900">GDPR</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t flex flex-col md:flex-row justify-between items-center">
              <p className="text-sm text-gray-500">
                © 2024 BeyondAsk. All rights reserved.
              </p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <a href="#" className="text-gray-500 hover:text-gray-900">
                  <span className="sr-only">Twitter</span>
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"></path>
                  </svg>
                </a>
                <a href="#" className="text-gray-500 hover:text-gray-900">
                  <span className="sr-only">GitHub</span>
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"></path>
                  </svg>
                </a>
                <a href="#" className="text-gray-500 hover:text-gray-900">
                  <span className="sr-only">LinkedIn</span>
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
