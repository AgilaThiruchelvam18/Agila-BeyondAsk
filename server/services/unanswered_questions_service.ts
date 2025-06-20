import { storage } from '../storage';
import { UnansweredQuestion, InsertUnansweredQuestion } from '@shared/schema';

/**
 * Service for handling unanswered questions detection and management
 */
export class UnansweredQuestionsService {
  /**
   * Check if a similar unanswered question already exists for the same agent/knowledge base
   * 
   * @param question The question text to check
   * @param agentId The agent ID
   * @param knowledgeBaseId Optional knowledge base ID
   * @param status Optional status filter (default: 'pending')
   * @returns boolean True if a similar question exists, false otherwise
   */
  static async hasSimilarUnansweredQuestion(
    question: string,
    agentId: number,
    knowledgeBaseId: number | null | undefined,
    status: string = 'pending'
  ): Promise<boolean> {
    try {
      // Normalize the question by lowercasing and removing punctuation
      const normalizedQuestion = question.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      // Get existing unanswered questions for this agent
      const existingQuestions = await storage.getUnansweredQuestionsByAgentId(agentId);

      // Filter questions by status (if provided) and knowledge base (if provided)
      const filteredQuestions = existingQuestions.filter(q => {
        // Filter by status
        if (status && q.status !== status) return false;

        // Filter by knowledge base (if specified)
        if (knowledgeBaseId && q.knowledgeBaseId !== knowledgeBaseId) return false;

        return true;
      });

      // Check for similar questions using normalized text comparison
      // This is a simple implementation - could be enhanced with more sophisticated 
      // similarity metrics like Levenshtein distance, cosine similarity, etc.
      for (const existingQuestion of filteredQuestions) {
        // Skip if the question is null or empty
        if (!existingQuestion.question) continue;

        // Normalize the existing question
        const normalizedExisting = existingQuestion.question.toLowerCase()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim();

        // Check for exact matches
        if (normalizedExisting === normalizedQuestion) {
          console.log(`Found duplicate question "${question}" for agent ${agentId}`);
          return true;
        }

        // Check if one is contained in the other (for partial matches)
        if (normalizedExisting.includes(normalizedQuestion) || 
            normalizedQuestion.includes(normalizedExisting)) {
          console.log(`Found similar question "${existingQuestion.question}" for agent ${agentId}`);
          return true;
        }
      }

      console.log(`No similar questions found for "${question}" for agent ${agentId}`);
      return false;
    } catch (error) {
      console.error("Error checking for similar unanswered questions:", error);
      return false; // On error, assume no duplicates to be safe
    }
  }

  /**
   * Detect if a question is unanswered based on confidence score or other metrics
   */
  static async detectUnansweredQuestion(
    question: string,
    response: string,
    confidenceScore: number,
    context: string | null,
    agentId: number,
    userId: number | null,
    knowledgeBaseId: number | null,
    conversationId: number | null,
    messageId: number | null,
    source: string = 'chat',
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    // Confidence threshold for determining if a question is unanswered
    const CONFIDENCE_THRESHOLD = 60;

    // Use a combination of factors to determine if a question is unanswered
    // 1. If confidence score is below threshold
    // 2. If the response contains specific phrases indicating uncertainty
    // 3. If the response is too short to be comprehensive
    // 4. If the question is flagged as irrelevant to the knowledge domain

    const uncertaintyPhrases = [
      "I don't know",
      "I don't have information",
      "I don't have enough information",
      "I'm not sure",
      "I cannot answer",
      "I don't have access to",
      "I cannot find",
      "could not be found",
      "no information available",
      "isn't in my knowledge base",
      "not in the provided context",
      "isn't mentioned in the documents",
      "don't have enough information in my knowledge base",
      "unable to find this information",
      "not found in my knowledge base",
      "I don't have that information",
      "insufficient information available",
      "cannot provide an answer"
    ];

    // Check confidence score
    const lowConfidence = confidenceScore < CONFIDENCE_THRESHOLD;

    // Check for uncertainty phrases in the response
    let containsUncertainty = false;
    const responseLower = response.toLowerCase();

    // Log the exact response for debugging
    console.log(`Checking response for uncertainty phrases: "${response}"`);

    // Verbose logging for each phrase check
    for (const phrase of uncertaintyPhrases) {
      if (responseLower.includes(phrase.toLowerCase())) {
        console.log(`Matched uncertainty phrase: "${phrase}" in response`);
        containsUncertainty = true;
        break;
      }
    }

    // Check response length (extremely short responses might indicate a lack of information)
    const isTooShort = response.length < 50 && question.length > 20;

    // Check if the question was flagged as irrelevant by the LLM
    const isIrrelevant = metadata?.is_irrelevant === true || 
                        (metadata?.metadata as Record<string, any>)?.is_irrelevant === true;

    console.log(`Question detection metrics for "${question}":
      - Confidence Score: ${confidenceScore} (threshold: ${CONFIDENCE_THRESHOLD}, low confidence: ${lowConfidence})
      - Contains Uncertainty: ${containsUncertainty}
      - Too Short: ${isTooShort} (response length: ${response.length})
      - Flagged Irrelevant: ${isIrrelevant}
    `);

    const isUnanswered = lowConfidence || containsUncertainty || isTooShort || isIrrelevant;

    console.log(`Final determination - Is Unanswered: ${isUnanswered}`);

    // If it's unanswered, check for duplicates and then store it in the database
    if (isUnanswered) {
      // First, check if a similar question already exists for this agent/knowledge base
      const hasSimilar = await this.hasSimilarUnansweredQuestion(question, agentId, knowledgeBaseId);

      if (hasSimilar) {
        console.log(`Similar question already exists for "${question}" - skipping storage`);
        return isUnanswered; // Still return true since it was technically unanswered
      }

      // Include a flag for irrelevant questions in the metadata
      const enhancedMetadata = {
        ...metadata,
        detection_reason: {
          low_confidence: lowConfidence,
          contains_uncertainty: containsUncertainty,
          too_short: isTooShort,
          irrelevant: isIrrelevant
        }
      };

      try {
        // Helper function to recursively sanitize objects
        const sanitizeObject = (obj: any): any => {
          if (typeof obj === 'string') {
            return obj.replace(/\0/g, '');
          }
          if (obj && typeof obj === 'object') {
            if (Array.isArray(obj)) {
              return obj.map(sanitizeObject);
            }
            const sanitized: any = {};
            for (const [key, value] of Object.entries(obj)) {
              sanitized[key] = sanitizeObject(value);
            }
            return sanitized;
          }
          return obj;
        };

        // Convert null values to undefined for compatibility with InsertUnansweredQuestion
        // Sanitize ALL text fields to prevent PostgreSQL encoding errors
        const questionData: InsertUnansweredQuestion = {
          question: question.replace(/\0/g, ''), // Remove null bytes
          agentId,
          userId: userId ?? undefined, // Convert null to undefined
          knowledgeBaseId: knowledgeBaseId ?? undefined,
          conversationId: conversationId ?? undefined,
          messageId: messageId ?? undefined,
          context: context ? context.replace(/\0/g, '') : null, // Sanitize context too
          confidenceScore: confidenceScore.toString(),
          status: 'pending',
          source: source.replace(/\0/g, ''), // Sanitize source
          metadata: sanitizeObject(enhancedMetadata) // Recursively sanitize metadata
        };

        await storage.createUnansweredQuestion(questionData);
        console.log(`Question "${question}" stored as unanswered.`);
      } catch (error) {
        console.error("Error storing unanswered question:", error);
      }
    } else {
      console.log(`Question "${question}" was sufficiently answered.`);
    }

    return isUnanswered;
  }

  /**
   * Get all unanswered questions for a user
   */
  static async getUnansweredQuestionsByUserId(userId: number): Promise<UnansweredQuestion[]> {
    return await storage.getUnansweredQuestionsByUserId(userId);
  }

  /**
   * Get all unanswered questions for an agent
   */
  static async getUnansweredQuestionsByAgentId(agentId: number): Promise<UnansweredQuestion[]> {
    return await storage.getUnansweredQuestionsByAgentId(agentId);
  }

  /**
   * Get all unanswered questions for a knowledge base
   */
  static async getUnansweredQuestionsByKnowledgeBaseId(knowledgeBaseId: number): Promise<UnansweredQuestion[]> {
    return await storage.getUnansweredQuestionsByKnowledgeBaseId(knowledgeBaseId);
  }

  /**
   * Get all unanswered questions with a specific status
   */
  static async getUnansweredQuestionsByStatus(status: string): Promise<UnansweredQuestion[]> {
    return await storage.getUnansweredQuestionsByStatus(status);
  }

  /**
   * Mark an unanswered question as addressed with a resolution
   */
  static async markQuestionAddressed(
    id: number, 
    resolution: string, 
    newDocumentId?: number
  ): Promise<UnansweredQuestion | undefined> {
    const updateData: Partial<UnansweredQuestion> = {
      status: 'addressed',
      resolution,
      newDocumentId: newDocumentId ?? undefined // Convert null to undefined
    };

    return await storage.updateUnansweredQuestion(id, updateData);
  }

  /**
   * Mark an unanswered question as ignored
   */
  static async markQuestionIgnored(id: number, reason?: string): Promise<UnansweredQuestion | undefined> {
    const updateData: Partial<UnansweredQuestion> = {
      status: 'ignored',
      resolution: reason || 'Marked as ignored'
    };

    return await storage.updateUnansweredQuestion(id, updateData);
  }
}