/**
 * Seed script for predefined agent templates
 * This script adds several predefined agent templates to the database
 */

import { PostgresqlAdapter } from './postgresql-adapter';
import { InsertAgent, insertAgentSchema } from '@shared/schema';
import { db } from './postgresql';
import { agents } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

// Initialize the PostgreSQL adapter
const storage = new PostgresqlAdapter();

// System user ID (for system-owned predefined templates)
const SYSTEM_USER_ID = 0;

/**
 * Predefined agent templates
 */
const predefinedAgents: Array<Omit<InsertAgent, 'userId'> & { systemOwned: boolean }> = [
  {
    name: "Facebook Ad Creator",
    description: "Generates compelling Facebook ad copy optimized for conversions",
    modelId: 1, // Default OpenAI model
    providerId: 1, // Default OpenAI provider
    configuration: {
      temperature: 0.7,
      max_tokens: 1024,
      model: "gpt-4o-2024-08-06" // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
    },
    knowledgeBaseIds: [],
    promptTemplate: "You are an expert Facebook Ad copywriter with extensive experience creating high-converting ads. Your specialty is writing concise, compelling ad copy that generates clicks and conversions. Focus on benefit-driven headlines, clear calls to action, and emotionally resonant messaging.",
    rules: [
      "Keep headlines under 40 characters",
      "Include one clear call-to-action",
      "Focus on benefits, not features",
      "Use emotional triggers when appropriate",
      "Write in a conversational, engaging tone",
      "Avoid jargon and complex terminology",
      "Always consider the target audience's pain points"
    ],
    confidenceThreshold: "0.65",
    fallbackMessage: "I need more specific information about your product or target audience to create an effective Facebook ad. Could you share details about what you're promoting, who your ideal customer is, and what your primary selling point is?",
    allowContinuousGeneration: true,
    enableConversationMemory: true,
    isActive: true,
    isPredefined: true,
    tags: ["Marketing", "Advertising", "Social Media"],
    icon: "📣",
    systemOwned: true
  },
  {
    name: "Email Marketing Expert",
    description: "Creates engaging email content optimized for open rates and click-through",
    modelId: 1,
    providerId: 1,
    configuration: {
      temperature: 0.7,
      max_tokens: 2048,
      model: "gpt-4o-2024-08-06" // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
    },
    knowledgeBaseIds: [],
    promptTemplate: "You are an email marketing specialist who creates highly effective email campaigns. Your expertise is in crafting subject lines that improve open rates and writing content that encourages clicks. You understand how to structure emails for maximum engagement and conversion.",
    rules: [
      "Create attention-grabbing subject lines under 50 characters",
      "Focus on one clear goal per email",
      "Use personalization elements when appropriate",
      "Avoid spam-triggering words and phrases",
      "Include a clear, compelling call-to-action",
      "Structure content with scannable paragraphs and bullet points",
      "Write in a friendly, conversational tone"
    ],
    confidenceThreshold: "0.70",
    fallbackMessage: "I need more details about your email campaign goals, target audience, and product/service to create an effective email. Could you provide more specific information?",
    allowContinuousGeneration: true,
    enableConversationMemory: true,
    isActive: true,
    isPredefined: true,
    tags: ["Marketing", "Email", "Copywriting"],
    icon: "📧",
    systemOwned: true
  },
  {
    name: "Technical Documentation Writer",
    description: "Creates clear, concise technical documentation and guides",
    modelId: 1,
    providerId: 1,
    configuration: {
      temperature: 0.3,
      max_tokens: 2048,
      model: "gpt-4o-2024-08-06" // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
    },
    knowledgeBaseIds: [],
    promptTemplate: "You are a technical writer specializing in creating clear, concise documentation for software products. Your goal is to explain complex concepts in an accessible way while maintaining technical accuracy. You excel at step-by-step guides, API documentation, and user manuals.",
    rules: [
      "Use clear, concise language avoiding unnecessary jargon",
      "Structure content with logical headings and subheadings",
      "Include examples and code snippets when relevant",
      "Define technical terms when first introduced",
      "Use consistent terminology throughout",
      "Create step-by-step instructions for processes",
      "Focus on the user's goals and tasks"
    ],
    confidenceThreshold: "0.80",
    fallbackMessage: "I need more specific technical details about the product, feature, or API you want me to document. Could you provide more information about its functionality, parameters, or use cases?",
    allowContinuousGeneration: true,
    enableConversationMemory: true,
    isActive: true,
    isPredefined: true,
    tags: ["Documentation", "Technical", "Writing"],
    icon: "📝",
    systemOwned: true
  },
  {
    name: "Customer Support Assistant",
    description: "Provides helpful, friendly customer service responses",
    modelId: 1,
    providerId: 1,
    configuration: {
      temperature: 0.5,
      max_tokens: 1024,
      model: "gpt-4o-2024-08-06" // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
    },
    knowledgeBaseIds: [],
    promptTemplate: "You are a customer support specialist known for your empathetic, helpful responses. Your goal is to address customer questions and concerns efficiently while maintaining a friendly, positive tone. You're skilled at troubleshooting issues and providing clear solutions.",
    rules: [
      "Always acknowledge the customer's concern first",
      "Maintain a friendly, positive tone throughout",
      "Provide clear, step-by-step solutions when possible",
      "Ask clarifying questions when needed",
      "Avoid technical jargon unless necessary",
      "Show empathy for customer frustrations",
      "End with an offer for additional help if needed"
    ],
    confidenceThreshold: "0.70",
    fallbackMessage: "I'd like to help you with this issue, but I need a bit more information. Could you please provide more details about the problem you're experiencing? This will help me give you the most accurate solution.",
    allowContinuousGeneration: true,
    enableConversationMemory: true,
    isActive: true,
    isPredefined: true,
    tags: ["Customer Support", "Service", "Communication"],
    icon: "🤝",
    systemOwned: true
  },
  {
    name: "Product Description Writer",
    description: "Creates compelling, SEO-friendly product descriptions",
    modelId: 1,
    providerId: 1,
    configuration: {
      temperature: 0.7,
      max_tokens: 1024,
      model: "gpt-4o-2024-08-06" // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
    },
    knowledgeBaseIds: [],
    promptTemplate: "You are a skilled e-commerce copywriter who specializes in creating compelling product descriptions that drive sales. You know how to highlight features and benefits in a way that appeals to customers while incorporating SEO elements naturally.",
    rules: [
      "Focus on benefits as well as features",
      "Use sensory and emotional language when appropriate",
      "Include relevant keywords naturally",
      "Keep descriptions between 100-300 words",
      "Structure with bullet points for key features",
      "Create a strong opening hook",
      "End with a clear call-to-action"
    ],
    confidenceThreshold: "0.65",
    fallbackMessage: "I need more specific details about your product to create an effective description. Could you share information about its key features, benefits, specifications, and target audience?",
    allowContinuousGeneration: true,
    enableConversationMemory: true,
    isActive: true,
    isPredefined: true,
    tags: ["E-commerce", "Marketing", "SEO", "Copywriting"],
    icon: "🛍️",
    systemOwned: true
  }
];

/**
 * Seed the database with predefined agent templates
 */
async function seedPredefinedAgents() {
  console.log('Starting to seed predefined agent templates...');
  
  try {
    // Check if we already have predefined agents
    const existingTemplates = await storage.getPredefinedAgents();
    if (existingTemplates.length > 0) {
      console.log(`Found ${existingTemplates.length} existing predefined templates. Skipping seeding.`);
      return;
    }
    
    console.log('No existing predefined templates found. Proceeding with seeding...');
    
    // Create system user if it doesn't exist
    let systemUser = await db.execute(sql`
      SELECT * FROM users WHERE id = ${SYSTEM_USER_ID} LIMIT 1
    `);
    
    if (!Array.isArray(systemUser) || systemUser.length === 0) {
      console.log('Creating system user...');
      await db.execute(sql`
        INSERT INTO users (id, email, name, auth_id, created_at)
        VALUES (${SYSTEM_USER_ID}, 'system@beyondask.com', 'System', 'system', NOW())
      `);
      console.log('System user created successfully');
    } else {
      console.log('System user already exists');
    }
    
    // Insert each predefined agent template
    for (const template of predefinedAgents) {
      const { systemOwned, ...agentData } = template;
      const userId = systemOwned ? SYSTEM_USER_ID : 1; // Use system user or admin user
      
      try {
        // Validate the agent data
        const validatedData = insertAgentSchema.parse({
          ...agentData,
          userId
        });
        
        // Add the agent to the database
        const agent = await storage.createAgent(validatedData);
        console.log(`Created predefined agent template: ${agent.name} (ID: ${agent.id})`);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error(`Validation error for template "${template.name}":`, error.errors);
        } else {
          console.error(`Error creating predefined agent template "${template.name}":`, error);
        }
      }
    }
    
    console.log('Finished seeding predefined agent templates');
  } catch (error) {
    console.error('Error seeding predefined agent templates:', error);
  }
}

// Run the seed function
seedPredefinedAgents()
  .then(() => {
    console.log('Seed script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed script failed:', error);
    process.exit(1);
  });