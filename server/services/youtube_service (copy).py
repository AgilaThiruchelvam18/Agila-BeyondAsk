import os
import time
import logging
import tempfile
import re
import requests
import xml.etree.ElementTree as ET
from pytube import YouTube
from pydub import AudioSegment
import openai
from typing import Tuple, Optional, Dict, Any, List

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class YouTubeService:
    """Service for downloading and transcribing YouTube videos"""
    
    def __init__(self):
        """Initialize the YouTube service"""
        self.api_key = os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            logger.warning("OPENAI_API_KEY not found in environment variables")
        
        # Ensure the openai client is initialized with the API key
        openai.api_key = self.api_key
        self.client = openai.OpenAI(api_key=self.api_key)
        
        # Create temp directory for downloads
        self.temp_dir = tempfile.mkdtemp()
        logger.info(f"Temporary directory created at: {self.temp_dir}")
    
    def download_audio(self, video_url: str) -> Optional[str]:
        """
        Download audio from a YouTube video
        
        Args:
            video_url: URL of the YouTube video
            
        Returns:
            Path to the downloaded audio file or None if download failed
        """
        try:
            # Create a YouTube object with parameters that are compatible with our version
            # Using a simpler initialization to avoid version-specific parameters
            yt = YouTube(video_url)
            
            # Get video information with retries
            retry_count = 3
            title = None
            length = 0
            
            for attempt in range(retry_count):
                try:
                    title = yt.title
                    length = yt.length
                    logger.info(f"Downloading audio from: {title} (Length: {length} seconds)")
                    break
                except Exception as e:
                    logger.warning(f"Attempt {attempt+1}/{retry_count} to get video info failed: {str(e)}")
                    time.sleep(2)  # Wait before retrying
            
            if title is None:
                logger.error("Failed to get video information after multiple attempts")
                
            # Get audio stream with highest quality
            audio_stream = None
            for attempt in range(retry_count):
                try:
                    audio_stream = yt.streams.filter(only_audio=True).order_by('abr').desc().first()
                    if audio_stream:
                        break
                except Exception as e:
                    logger.warning(f"Attempt {attempt+1}/{retry_count} to get audio stream failed: {str(e)}")
                    time.sleep(2)  # Wait before retrying
            
            if not audio_stream:
                logger.error("No audio stream found after multiple attempts")
                return None
            
            # Download the audio with retries
            audio_file = None
            for attempt in range(retry_count):
                try:
                    audio_file = audio_stream.download(output_path=self.temp_dir)
                    logger.info(f"Audio downloaded to: {audio_file}")
                    break
                except Exception as e:
                    logger.warning(f"Attempt {attempt+1}/{retry_count} to download audio failed: {str(e)}")
                    time.sleep(2)  # Wait before retrying
            
            if not audio_file:
                logger.error("Failed to download audio after multiple attempts")
                return None
                
            # Convert to mp3 format if necessary
            base, ext = os.path.splitext(audio_file)
            mp3_file = f"{base}.mp3"
            
            # If the file isn't already an mp3, convert it
            if ext.lower() != '.mp3':
                try:
                    audio = AudioSegment.from_file(audio_file)
                    audio.export(mp3_file, format="mp3")
                    # Remove the original file
                    os.remove(audio_file)
                    logger.info(f"Converted to mp3: {mp3_file}")
                    return mp3_file
                except Exception as e:
                    logger.error(f"Error converting to mp3: {str(e)}")
                    return audio_file
            
            return audio_file
            
        except Exception as e:
            logger.error(f"Error downloading YouTube video: {str(e)}")
            return None
    
    def transcribe_audio(self, audio_file: str) -> Optional[str]:
        """
        Transcribe audio file using OpenAI's Whisper API
        
        Args:
            audio_file: Path to the audio file
            
        Returns:
            Transcription text or None if transcription failed
        """
        try:
            logger.info(f"Transcribing audio file: {audio_file}")
            
            with open(audio_file, "rb") as audio:
                transcription = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio
                )
            
            # Get the transcribed text
            text = transcription.text
            logger.info(f"Transcription complete: {len(text)} characters")
            
            return text
            
        except Exception as e:
            logger.error(f"Error transcribing audio: {str(e)}")
            return None
    
    def summarize_transcript(self, transcript: str, max_length: int = 5000) -> Optional[str]:
        """
        Summarize long transcripts to fit within token limits
        
        Args:
            transcript: The full transcript text
            max_length: Maximum character length for the summary
            
        Returns:
            Summarized text or original text if short enough
        """
        # If the transcript is already short enough, return it as is
        if len(transcript) <= max_length:
            return transcript
        
        try:
            logger.info(f"Summarizing long transcript ({len(transcript)} chars)")
            
            response = self.client.chat.completions.create(
                model="gpt-4o",  # Use the latest model
                messages=[
                    {"role": "system", "content": "You are a professional summarizer that preserves the most important information."},
                    {"role": "user", "content": f"This is a transcript from a YouTube video. Please summarize it to capture the key points and main content while preserving as much detail as possible:\n\n{transcript}"}
                ],
                max_tokens=2000
            )
            
            summary = response.choices[0].message.content
            logger.info(f"Summarization complete: {len(summary)} characters")
            
            return summary
            
        except Exception as e:
            logger.error(f"Error summarizing transcript: {str(e)}")
            # Return a truncated version of the original as fallback
            return transcript[:max_length] + "... [truncated due to length]"
    
    def get_video_metadata(self, video_url: str) -> Dict[str, Any]:
        """
        Get metadata for a YouTube video
        
        Args:
            video_url: URL of the YouTube video
            
        Returns:
            Dictionary with video metadata
        """
        try:
            # Create a YouTube object with simpler initialization
            yt = YouTube(video_url)
            
            # Try to extract metadata with retries
            retry_count = 3
            metadata = {
                "title": "Unknown",
                "source_url": video_url
            }
            
            for attempt in range(retry_count):
                try:
                    metadata = {
                        "title": yt.title,
                        "author": yt.author,
                        "length_seconds": yt.length,
                        "views": yt.views,
                        "publish_date": str(yt.publish_date) if yt.publish_date else None,
                        "video_id": yt.video_id,
                        "thumbnail_url": yt.thumbnail_url,
                        "source_url": video_url
                    }
                    # If we got here, we succeeded
                    break
                except Exception as e:
                    logger.warning(f"Attempt {attempt+1}/{retry_count} to get metadata failed: {str(e)}")
                    if attempt < retry_count - 1:
                        time.sleep(2)  # Wait before retrying
            
            return metadata
            
        except Exception as e:
            logger.error(f"Error getting video metadata: {str(e)}")
            return {
                "title": "Unknown",
                "source_url": video_url,
                "error": str(e)
            }
    
    def extract_video_id(self, youtube_url: str) -> Optional[str]:
        """
        Extract the video ID from a YouTube URL
        
        Args:
            youtube_url: URL of the YouTube video
            
        Returns:
            YouTube video ID or None if not found
        """
        try:
            # Try multiple regex patterns for different URL formats
            patterns = [
                r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\?\/]+)',
                r'(?:youtube\.com\/embed\/)([^&\?\/]+)',
                r'(?:youtube\.com\/v\/)([^&\?\/]+)',
                r'(?:youtube\.com\/user\/\w+\/\w+\/[^&\?\/]+)',
            ]
            
            for pattern in patterns:
                match = re.search(pattern, youtube_url)
                if match:
                    return match.group(1)
            
            # If no match found, try pytube as fallback
            try:
                yt = YouTube(youtube_url)
                return yt.video_id
            except Exception as e:
                logger.warning(f"Failed to extract video ID using pytube: {str(e)}")
                
            return None
            
        except Exception as e:
            logger.error(f"Error extracting video ID: {str(e)}")
            return None
            
    def get_captions(self, video_id: str) -> Optional[str]:
        """
        Get captions for a YouTube video using the available subtitles
        
        Args:
            video_id: YouTube video ID
            
        Returns:
            Caption text or None if not available
        """
        try:
            logger.info(f"Attempting to get captions for video ID: {video_id}")
            
            # Try to get captions through pytube first
            try:
                yt = YouTube(f"https://www.youtube.com/watch?v={video_id}")
                captions = yt.captions
                
                if captions:
                    # Prefer English captions if available
                    en_caption = None
                    for caption in captions.values():
                        if caption.code.startswith('en'):
                            en_caption = caption
                            break
                    
                    # If no English caption found, use the first available
                    caption_track = en_caption or list(captions.values())[0]
                    
                    # Get the caption text
                    xml_captions = caption_track.xml_captions
                    
                    # Parse the XML
                    root = ET.fromstring(xml_captions)
                    
                    # Extract text from each caption
                    lines = []
                    for elem in root.findall('.//text'):
                        if elem.text:
                            lines.append(elem.text.strip())
                    
                    # Join all captions into a single text
                    return ' '.join(lines)
            
            except Exception as e:
                logger.warning(f"Failed to get captions through pytube: {str(e)}")
            
            # Try alternative method with direct request
            try:
                # Use requests to get the caption track list
                caption_list_url = f"https://www.youtube.com/api/timedtext?v={video_id}&type=list"
                response = requests.get(caption_list_url)
                
                if response.status_code == 200:
                    # Parse the XML to find available caption tracks
                    root = ET.fromstring(response.text)
                    
                    # Find an English track or use the first available
                    track_elem = None
                    for track in root.findall('.//track'):
                        lang_code = track.get('lang_code', '')
                        if lang_code.startswith('en'):
                            track_elem = track
                            break
                    
                    if track_elem is None and len(root.findall('.//track')) > 0:
                        track_elem = root.findall('.//track')[0]
                    
                    if track_elem:
                        lang_code = track_elem.get('lang_code')
                        name = track_elem.get('name', '')
                        
                        # Get the caption content
                        caption_url = f"https://www.youtube.com/api/timedtext?v={video_id}&lang={lang_code}&name={name}"
                        caption_response = requests.get(caption_url)
                        
                        if caption_response.status_code == 200:
                            # Parse the XML content
                            caption_root = ET.fromstring(caption_response.text)
                            
                            # Extract text from each caption
                            lines = []
                            for elem in caption_root.findall('.//text'):
                                if elem.text:
                                    lines.append(elem.text.strip())
                            
                            # Join all captions into a single text
                            return ' '.join(lines)
            
            except Exception as e:
                logger.warning(f"Failed to get captions through direct request: {str(e)}")
            
            logger.error(f"No captions available for video ID: {video_id}")
            return None
            
        except Exception as e:
            logger.error(f"Error getting captions: {str(e)}")
            return None
    
    def get_youtube_transcript_api(self, video_id: str) -> Optional[str]:
        """
        Try to get transcript using an alternative method
        
        Args:
            video_id: YouTube video ID
            
        Returns:
            Transcript text or None if not available
        """
        try:
            # Try to use invidious API to get transcript data
            logger.info(f"Trying to get transcript from invidious API for video ID: {video_id}")
            
            # Use a public invidious instance to get video metadata and transcripts
            instances = [
                "https://invidious.snopyta.org",
                "https://invidious.kavin.rocks",
                "https://vid.puffyan.us",
                "https://yt.artemislena.eu"
            ]
            
            for instance in instances:
                try:
                    # Try to get transcripts from this instance
                    api_url = f"{instance}/api/v1/videos/{video_id}"
                    response = requests.get(api_url, timeout=5)
                    
                    if response.status_code == 200:
                        data = response.json()
                        
                        # Check if captions are available
                        if 'captions' in data and data['captions']:
                            # Get the first English caption or any caption
                            caption_url = None
                            for caption in data['captions']:
                                if caption.get('languageCode', '').startswith('en'):
                                    caption_url = f"{instance}/api/v1/captions/{video_id}?label={caption.get('label')}"
                                    break
                            
                            # If no English caption found, use the first one
                            if not caption_url and data['captions']:
                                caption_url = f"{instance}/api/v1/captions/{video_id}?label={data['captions'][0].get('label')}"
                            
                            if caption_url:
                                caption_response = requests.get(caption_url, timeout=5)
                                if caption_response.status_code == 200:
                                    caption_data = caption_response.json()
                                    
                                    # Extract text from captions
                                    if 'captions' in caption_data:
                                        lines = []
                                        for line in caption_data['captions']:
                                            if 'text' in line:
                                                lines.append(line['text'])
                                        
                                        if lines:
                                            return ' '.join(lines)
                        
                        # Extract a transcript from description and title as fallback
                        title = data.get('title', '')
                        description = data.get('description', '')
                        if title and description:
                            return f"Title: {title}\n\nDescription: {description}"
                            
                except Exception as e:
                    logger.warning(f"Failed to get transcript from {instance}: {str(e)}")
                    continue
            
            return None
            
        except Exception as e:
            logger.error(f"Error in alternative transcript method: {str(e)}")
            return None

    def process_youtube_url(self, video_url: str) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        """
        Process a YouTube URL to extract transcript and metadata
        
        Args:
            video_url: URL of the YouTube video
            
        Returns:
            Tuple containing (transcript text, metadata dictionary)
        """
        # Get metadata first
        metadata = self.get_video_metadata(video_url)
        
        # Extract video ID
        video_id = self.extract_video_id(video_url)
        if not video_id:
            logger.error(f"Failed to extract video ID from URL: {video_url}")
            return None, metadata
            
        # Try different methods to get video content
        logger.info(f"Processing YouTube video ID: {video_id}")
        
        # Method 1: Try downloading and transcribing the audio
        logger.info("Method 1: Trying to download and transcribe audio...")
        audio_file = self.download_audio(video_url)
        transcript = None
        
        if audio_file:
            try:
                # Transcribe the audio
                transcript = self.transcribe_audio(audio_file)
                
                # Clean up the audio file
                os.remove(audio_file)
                
                if transcript:
                    logger.info(f"Successfully transcribed audio: {len(transcript)} characters")
                    processed_text = self.summarize_transcript(transcript)
                    return processed_text, metadata
                
            except Exception as e:
                logger.error(f"Error processing audio: {str(e)}")
                # Clean up the audio file if it exists
                if audio_file and os.path.exists(audio_file):
                    os.remove(audio_file)
        
        # Method 2: Try to get captions/subtitles
        logger.info("Method 2: Trying to get captions/subtitles...")
        captions = self.get_captions(video_id)
        
        if captions:
            logger.info(f"Successfully retrieved captions: {len(captions)} characters")
            processed_text = self.summarize_transcript(captions)
            return processed_text, metadata
            
        # Method 3: Try alternative API approach
        logger.info("Method 3: Trying alternative transcript API...")
        alt_transcript = self.get_youtube_transcript_api(video_id)
        
        if alt_transcript:
            logger.info(f"Successfully retrieved transcript from alternative API: {len(alt_transcript)} characters")
            processed_text = self.summarize_transcript(alt_transcript)
            return processed_text, metadata
        
        # If all methods failed, return None for transcript
        logger.error("All methods failed to extract text from YouTube video")
        return None, metadata

# Example usage
if __name__ == "__main__":
    service = YouTubeService()
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"  # Replace with actual video URL
    transcript, metadata = service.process_youtube_url(url)
    
    if transcript:
        print(f"Video: {metadata['title']}")
        print(f"Transcript length: {len(transcript)} characters")
        print(transcript[:500] + "...")  # Print first 500 chars
    else:
        print(f"Failed to process video: {metadata.get('title', url)}")