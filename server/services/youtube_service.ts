import { log } from '../vite';

export interface YouTubeMetadata {
  title: string;
  author?: string;
  length_seconds?: number;
  views?: number;
  publish_date?: string;
  video_id?: string;
  thumbnail_url?: string;
  source_url: string;
  error?: string;
}

export interface YouTubeProcessResult {
  text: string | null;
  metadata: YouTubeMetadata;
}

/**
 * Service for processing YouTube videos using the external AI service
 */
export class YouTubeService {
  private static instance: YouTubeService;

  private constructor() {
    // External AI service URL is configured in environment variables
    const AI_SERVICE_URL = process.env.FLASK_API_URL || 'https://d6081979-14b6-491c-a89e-97bb41c5c0e8-00-2mdjtxzqllnzz.kirk.replit.dev';
  }

  public static getInstance(): YouTubeService {
    if (!this.instance) {
      this.instance = new YouTubeService();
    }
    return this.instance;
  }

  /**
   * Process a YouTube URL to extract transcript and metadata
   * @param videoUrl URL of the YouTube video
   * @returns Promise containing transcript text and metadata
   */
  public async processYouTubeUrl(videoUrl: string): Promise<YouTubeProcessResult> {
    return new Promise(async (resolve) => {
      try {
        const AI_SERVICE_URL = process.env.FLASK_API_URL || 'https://d6081979-14b6-491c-a89e-97bb41c5c0e8-00-2mdjtxzqllnzz.kirk.replit.dev';
        const youtubeApiUrl = `${AI_SERVICE_URL}/api/youtube/process`;
        
        log(`Processing YouTube URL via external service: ${videoUrl}`, 'youtube-service');
        log(`Using API URL: ${youtubeApiUrl}`, 'youtube-service');
        
        // Make HTTP request to external AI service
        try {
          log(`Sending request to AI service with URL: ${videoUrl}`, 'youtube-service');
          const response = await fetch(youtubeApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: videoUrl }),
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            log(`YouTube API service returned error: ${response.status} ${errorText}`, 'youtube-service');
            resolve({
              text: null,
              metadata: {
                title: "API Service Error",
                source_url: videoUrl,
                error: `API service returned status ${response.status}: ${errorText}`
              }
            });
            return;
          }
          
          const result = await response.json();
          log(`YouTube API response received, status: OK`, 'youtube-service');
          
          // Log the response data for debugging
          // Check for transcript field instead of text field
          if (result.transcript) {
            log(`Received transcript (${result.transcript.length} characters)`, 'youtube-service');
            log(`First 100 chars: ${result.transcript.substring(0, 100)}...`, 'youtube-service');
          } else {
            log(`No transcript received in response`, 'youtube-service');
          }
          
          if (result.metadata) {
            log(`Received metadata: ${JSON.stringify(result.metadata)}`, 'youtube-service');
          } else {
            log(`No metadata received in response`, 'youtube-service');
          }
          
          // Return the transcript under the "text" field to maintain compatibility with the rest of the code
          resolve({
            text: result.transcript || null, // Use transcript field instead of text field
            metadata: result.metadata || {
              title: result.title || "YouTube Video",
              source_url: videoUrl
            }
          });
          
          log(`Successfully processed YouTube video and returned result`, 'youtube-service');
        } catch (fetchError) {
          log(`Error fetching from YouTube API service: ${fetchError}`, 'youtube-service');
          resolve({
            text: null,
            metadata: {
              title: "API Connection Error",
              source_url: videoUrl,
              error: fetchError instanceof Error ? fetchError.message : String(fetchError)
            }
          });
        }
      } catch (error) {
        log(`Error in YouTube service: ${error}`, 'youtube-service');
        resolve({
          text: null,
          metadata: {
            title: "Service Error",
            source_url: videoUrl,
            error: error instanceof Error ? error.message : String(error)
          }
        });
      }
    });
  }
}

export default YouTubeService.getInstance();