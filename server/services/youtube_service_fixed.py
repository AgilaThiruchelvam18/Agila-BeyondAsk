"""
YouTube Service for downloading and transcribing YouTube videos
"""
import os
import re
import time
import json
import random
import hashlib
import logging
import tempfile
import requests
from typing import List, Dict, Tuple, Optional, Any

import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled, VideoUnavailable

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class YouTubeService:
    """Service for downloading and transcribing YouTube videos"""

    def __init__(self):
        """Initialize the YouTube service"""
        # Create a temporary directory for storage of files during processing
        self.temp_dir = tempfile.mkdtemp()
        
        # List of public Invidious instances
        self.invidious_instances = [
            "https://invidious.snopyta.org",
            "https://invidious.kavin.rocks",
            "https://vid.puffyan.us",
            "https://invidious.namazso.eu",
            "https://yt.artemislena.eu",
            "https://invidious.flokinet.to",
            "https://invidious.projectsegfau.lt",
            "https://y.com.sb",
            "https://invidious.slipfox.xyz"
        ]
        
        # List of user agents to rotate through to avoid detection
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
            "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
            "Mozilla/5.0 (Windows NT 10.0; rv:123.0) Gecko/20100101 Firefox/123.0"
        ]
        
        # Try to load proxies
        self.proxies = self.load_proxies()

    def load_proxies(self) -> List[Dict[str, str]]:
        """
        Load a list of proxies to use for transcript fetching

        Returns:
            List of proxy configurations
        """
        proxy_list = []
        try:
            # Try to load proxies from environment variables or a predefined list
            proxy_list = [
                {"http": "http://proxy1.example.com:8080", "https": "https://proxy1.example.com:8080"},
                {"http": "http://proxy2.example.com:8080", "https": "https://proxy2.example.com:8080"}
            ]
        except Exception as e:
            logger.warning(f"Failed to load proxies: {str(e)}")
        
        return proxy_list

    def get_random_user_agent(self):
        """Get a random user agent to avoid detection"""
        return random.choice(self.user_agents)

    def get_random_proxy(self) -> Optional[Dict[str, str]]:
        """
        Get a random proxy from the list

        Returns:
            Proxy configuration dictionary or None if no proxies available
        """
        if not self.proxies:
            return None
        return random.choice(self.proxies)

    def get_transcript_with_youtube_transcript_api(self, video_id: str) -> Optional[str]:
        """
        Get transcript using the YouTube Transcript API with retry and fallback mechanisms

        Args:
            video_id: YouTube video ID

        Returns:
            Transcript text or None if not available
        """
        try:
            logger.info(f"Attempting to get transcript with YouTube Transcript API: {video_id}")
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            
            # Try to get English transcript first
            try:
                transcript = transcript_list.find_transcript(['en'])
                full_transcript = transcript.fetch()
                
                # Combine all text entries
                text_parts = [entry['text'] for entry in full_transcript]
                return ' '.join(text_parts)
            except NoTranscriptFound:
                logger.info("No English transcript found, trying auto-generated")
                
                # Try to get auto-generated English transcript
                try:
                    transcript = transcript_list.find_generated_transcript(['en'])
                    full_transcript = transcript.fetch()
                    
                    # Combine all text entries
                    text_parts = [entry['text'] for entry in full_transcript]
                    return ' '.join(text_parts)
                except Exception as e:
                    logger.info(f"No auto-generated transcript found: {str(e)}")
                    
                    # Try to get any transcript and translate if needed
                    try:
                        transcript = transcript_list.find_transcript(['en', 'en-US', 'en-GB'])
                        full_transcript = transcript.fetch()
                        
                        # Combine all text entries
                        text_parts = [entry['text'] for entry in full_transcript]
                        return ' '.join(text_parts)
                    except Exception as e:
                        logger.info(f"Failed to find any transcript: {str(e)}")
                        
                        # Try the first available transcript as a last resort
                        try:
                            transcript = list(transcript_list)[0]
                            # Translate if not in English
                            if transcript.language_code != 'en':
                                transcript = transcript.translate('en')
                            full_transcript = transcript.fetch()
                            
                            # Combine all text entries
                            text_parts = [entry['text'] for entry in full_transcript]
                            return ' '.join(text_parts)
                        except Exception as e:
                            logger.error(f"Failed to get any transcript as last resort: {str(e)}")
        
        except (NoTranscriptFound, TranscriptsDisabled, VideoUnavailable) as e:
            logger.warning(f"YouTube Transcript API failed: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error with YouTube Transcript API: {str(e)}")
            
        return None

    def get_transcript_from_proxy_service(self, video_id: str) -> Optional[str]:
        """
        Try to get transcript using youtube_transcript_api through a proxy service

        Args:
            video_id: YouTube video ID

        Returns:
            Transcript text or None if not available
        """
        try:
            logger.info(f"Attempting to get transcript through proxy service: {video_id}")
            
            # Try with proxies if available
            proxy = self.get_random_proxy()
            if proxy:
                transcript_list = YouTubeTranscriptApi.list_transcripts(video_id, proxies=proxy)
            else:
                # Try with a different user agent if no proxies
                headers = {'User-Agent': self.get_random_user_agent()}
                transcript_list = YouTubeTranscriptApi.list_transcripts(video_id, headers=headers)
            
            # Try to get English transcript
            try:
                transcript = transcript_list.find_transcript(['en'])
                full_transcript = transcript.fetch()
                
                # Combine all text entries
                text_parts = [entry['text'] for entry in full_transcript]
                return ' '.join(text_parts)
            except Exception:
                # Try to get auto-generated transcript
                try:
                    transcript = transcript_list.find_generated_transcript(['en'])
                    full_transcript = transcript.fetch()
                    
                    # Combine all text entries
                    text_parts = [entry['text'] for entry in full_transcript]
                    return ' '.join(text_parts)
                except Exception:
                    # Last resort: get any transcript and translate if needed
                    try:
                        transcript = list(transcript_list)[0]
                        if transcript.language_code != 'en':
                            transcript = transcript.translate('en')
                        full_transcript = transcript.fetch()
                        
                        # Combine all text entries
                        text_parts = [entry['text'] for entry in full_transcript]
                        return ' '.join(text_parts)
                    except Exception as e:
                        logger.error(f"Failed to get any transcript: {str(e)}")
        
        except Exception as e:
            logger.error(f"Error getting transcript through proxy API: {str(e)}")
            return None

    def download_audio_from_youtube(self, video_url: str) -> Optional[str]:
        """
        Download audio from a YouTube video
        
        Args:
            video_url: URL of the YouTube video
            
        Returns:
            Path to downloaded audio file or None if failed
        """
        try:
            logger.info(f"Downloading audio from YouTube URL: {video_url}")
            
            # Create a unique filename
            random_id = hashlib.md5(os.urandom(8)).hexdigest()[:8]
            audio_path = os.path.join(self.temp_dir, f"audio-{random_id}.mp3")
            
            # Set up options for yt-dlp
            ydl_opts = {
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
                'outtmpl': audio_path.replace('.mp3', ''),  # yt-dlp will add the extension
                'quiet': True,
                'no_warnings': True,
                'nocheckcertificate': True,
                'socket_timeout': 30,
                'retries': 10,
                'fragment_retries': 10,
                'http_headers': {
                    'User-Agent': self.get_random_user_agent(),
                }
            }
            
            # Download the audio
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([video_url])
            
            # Return the path to the audio file (yt-dlp adds extension)
            audio_path = audio_path.replace('.mp3', '') + '.mp3'
            
            if os.path.exists(audio_path):
                logger.info(f"Successfully downloaded audio to: {audio_path}")
                return audio_path
            else:
                logger.error("Audio file not found after download")
                return None
                
        except Exception as e:
            logger.error(f"Error downloading YouTube audio: {str(e)}")
            return None
    
    def transcribe_audio(self, audio_path: str) -> Optional[str]:
        """
        Transcribe an audio file using OpenAI's Whisper API
        
        Args:
            audio_path: Path to the audio file
            
        Returns:
            Transcribed text or None if failed
        """
        try:
            logger.info(f"Transcribing audio file: {audio_path}")
            
            try:
                # Use whisper for transcription
                import whisper
                model = whisper.load_model("base")
                result = model.transcribe(audio_path)
                
                if result and "text" in result:
                    transcription = result["text"]
                    logger.info(f"Successfully transcribed audio: {len(transcription)} characters")
                    return transcription
                else:
                    logger.error("Failed to get transcription from whisper")
                    return None
                    
            except ImportError as e:
                logger.error(f"Whisper not available, trying alternative method: {str(e)}")
                
                # Fallback to OpenAI API if whisper package not available
                try:
                    from openai import OpenAI
                    
                    # Check if we have an API key
                    api_key = os.environ.get("OPENAI_API_KEY")
                    if not api_key:
                        logger.error("OPENAI_API_KEY not found in environment variables")
                        return None
                        
                    client = OpenAI(api_key=api_key)
                    
                    with open(audio_path, "rb") as audio_file:
                        transcription = client.audio.transcriptions.create(
                            model="whisper-1", 
                            file=audio_file
                        )
                    
                    if transcription and hasattr(transcription, "text"):
                        logger.info(f"Successfully transcribed audio with OpenAI API: {len(transcription.text)} characters")
                        return transcription.text
                    else:
                        logger.error("Failed to get transcription from OpenAI API")
                        return None
                        
                except Exception as e:
                    logger.error(f"Failed to transcribe with OpenAI API: {str(e)}")
                    return None
        
        except Exception as e:
            logger.error(f"Error transcribing audio: {str(e)}")
            return None
        finally:
            # Clean up the audio file
            try:
                if audio_path and os.path.exists(audio_path):
                    os.remove(audio_path)
                    logger.info(f"Cleaned up audio file: {audio_path}")
            except Exception as e:
                logger.warning(f"Failed to clean up audio file: {str(e)}")

    def get_full_transcript_with_enhanced_yt_dlp(self, video_url: str) -> Optional[str]:
        """
        Attempt to get full transcript using an enhanced yt-dlp configuration.
        This function prioritizes subtitle extraction and falls back to downloading
        and transcribing the video if subtitles aren't available.

        Args:
            video_url: URL of the YouTube video

        Returns:
            Transcript text or None if not available
        """
        try:
            logger.info(f"Attempting to get full transcript with enhanced yt-dlp: {video_url}")

            # Create a unique filename for this attempt
            random_id = hashlib.md5(os.urandom(8)).hexdigest()[:8]
            subtitle_path = os.path.join(self.temp_dir, f"subs-{random_id}")

            # Set up advanced options for yt-dlp
            ydl_opts = {
                'writesubtitles': True,
                'writeautomaticsub': True,
                'subtitleslangs': ['en', 'en-US', 'en-GB', 'en-CA', 'en-AU'],
                'skip_download': True,
                'outtmpl': subtitle_path,
                'quiet': True,
                'no_warnings': True,
                # Additional options to try to bypass restrictions
                'nocheckcertificate': True,
                'socket_timeout': 15,
                'retries': 10,
                'fragment_retries': 10,
                'hls_prefer_native': False,
                'extractor_retries': 10,
                'http_headers': {
                    'User-Agent': self.get_random_user_agent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'TE': 'trailers',
                    'X-YouTube-Client-Name': '1',
                    'X-YouTube-Client-Version': '2.20230526.01.00'
                },
                'cookies': f'/tmp/youtube-cookies-{random_id}.txt'  # Use a random cookie file
            }

            # Initialize variables
            info = None
            
            # Default metadata
            metadata = {
                "title": "Unknown",
                "author": "Unknown",
                "source_url": video_url
            }

            # Try to get metadata with yt-dlp
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(video_url, download=False)
                    
                    if info:
                        metadata = {
                            "title": info.get('title', 'Unknown'),
                            "author": info.get('uploader', 'Unknown'),
                            "length_seconds": info.get('duration', 0),
                            "views": info.get('view_count', 0),
                            "publish_date": info.get('upload_date', None),
                            "video_id": info.get('id', None),
                            "thumbnail_url": info.get('thumbnail', None),
                            "source_url": video_url
                        }
            except Exception as e:
                logger.error(f"Error getting metadata with yt-dlp: {str(e)}")
                # Continue with default metadata

            # Extract video ID from URL if not already in metadata
            video_id = metadata.get('video_id')
            if not video_id:
                video_id = self.extract_video_id(video_url)
                if not video_id:
                    logger.error(f"Failed to extract video ID from URL: {video_url}")
                    return None

            # STEP 1: Look for subtitle files that may have been downloaded
            logger.info("Checking for downloaded subtitle files...")
            potential_subtitle_files = []
            for ext in ['vtt', 'srt', 'ttml', 'srv1', 'srv2', 'srv3']:
                for lang in ['en', 'en-US', 'en-GB', 'en-CA', 'en-AU']:
                    potential_file = f"{subtitle_path}.{lang}.{ext}"
                    if os.path.exists(potential_file):
                        potential_subtitle_files.append(potential_file)
                    
            # Process subtitle files if found
            if potential_subtitle_files:
                # Use the first subtitle file found
                subtitle_file = potential_subtitle_files[0]
                logger.info(f"Found subtitle file: {subtitle_file}")

                with open(subtitle_file, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Parse subtitles based on file extension
                if subtitle_file.endswith('.vtt'):
                    # Parse WebVTT
                    lines = []
                    for line in content.split('\n'):
                        line = line.strip()
                        # Skip timestamps, headers, and empty lines
                        if line and not line.startswith('WEBVTT') and not re.match(r'^\d{2}:\d{2}', line) and not re.match(r'^\d{2}:\d{2}:\d{2}', line) and not re.match(r'^-->$', line):
                            lines.append(line)
                    return ' '.join(lines)
                elif subtitle_file.endswith('.srt'):
                    # Parse SRT
                    lines = []
                    for line in content.split('\n'):
                        line = line.strip()
                        # Skip timestamps, indexes, and empty lines
                        if line and not re.match(r'^\d+$', line) and not re.match(r'^\d{2}:\d{2}', line) and not re.match(r'^-->$', line):
                            lines.append(line)
                    return ' '.join(lines)
                else:
                    # Generic parsing for other formats
                    return re.sub(r'\s+', ' ', content)

            # STEP 2: If no subtitle files, try to use the transcript from info if available
            logger.info("No subtitle files found, checking for transcript in video info...")
            if info and 'subtitles' in info and info['subtitles']:
                for lang in ['en', 'en-US', 'en-GB', 'en-CA', 'en-AU']:
                    if lang in info['subtitles']:
                        logger.info(f"Found transcript in video info for language: {lang}")
                        return f"Transcript from subtitles: {info['subtitles'][lang]}"
                        
            # STEP 3: Try downloading and transcribing the audio
            logger.info("No subtitles found, attempting to download and transcribe audio...")
            audio_path = self.download_audio_from_youtube(video_url)
            
            if audio_path and os.path.exists(audio_path):
                logger.info(f"Successfully downloaded audio, attempting to transcribe: {audio_path}")
                transcript = self.transcribe_audio(audio_path)
                
                if transcript and len(transcript) > 100:
                    logger.info(f"Successfully transcribed audio: {len(transcript)} characters")
                    return transcript
                    
            # STEP 4: If we still don't have a transcript, use description as fallback
            logger.info("All transcript extraction methods failed, using description as fallback")
            title = info.get('title', '') if info else metadata.get('title', '')
            description = info.get('description', '') if info else ''
            
            if title and description and len(description) > 100:
                logger.info(f"Using title and description as fallback: {len(description)} characters")
                return f"Title: {title}\n\nDescription: {description}"

            # Generate minimal fallback text from metadata
            title = metadata.get("title", "Unknown")
            author = metadata.get("author", "Unknown")
            logger.warning(f"Unable to extract content from YouTube video: {video_url}")
            return f"Title: {title}\nAuthor: {author}\n\nUnable to extract content from this YouTube video."

        except Exception as e:
            logger.error(f"Error getting full transcript with enhanced yt-dlp: {str(e)}")
            return None

    def get_transcript_from_invidious_with_enhanced_options(self, video_id: str) -> Optional[str]:
        """
        Get transcript using invidious instances with enhanced options

        Args:
            video_id: YouTube video ID

        Returns:
            Transcript text or None if not available
        """
        try:
            logger.info(f"Trying to get transcript from invidious with enhanced options for video ID: {video_id}")

            # Shuffle instances to distribute load
            random.shuffle(self.invidious_instances)

            for instance in self.invidious_instances:
                # Shuffle user agents for each instance
                random.shuffle(self.user_agents)

                for user_agent in self.user_agents:
                    try:
                        headers = {
                            'User-Agent': user_agent,
                            'Accept': 'application/json',
                            'Connection': 'keep-alive',
                            'Referer': instance,
                            'Sec-Fetch-Dest': 'empty',
                            'Sec-Fetch-Mode': 'cors',
                            'Sec-Fetch-Site': 'same-origin',
                            'X-Requested-With': 'XMLHttpRequest'
                        }

                        # STEP 1: Try direct transcript/captions API first - this is specifically focused on subtitles
                        logger.info(f"Trying Invidious captions API for {video_id} using instance {instance}")
                        api_url = f"{instance}/api/v1/captions/{video_id}"
                        response = requests.get(api_url, headers=headers, timeout=15)

                        if response.status_code == 200:
                            try:
                                data = response.json()

                                if isinstance(data, list) and len(data) > 0:
                                    # Process the captions list
                                    logger.info(f"Found {len(data)} caption tracks through Invidious")
                                    
                                    # First try to find English captions
                                    english_captions = []
                                    for caption_item in data:
                                        if 'label' in caption_item and caption_item.get('languageCode', '').startswith('en'):
                                            english_captions.append(caption_item)
                                    
                                    # If no English captions, use whatever is available
                                    captions_to_try = english_captions if english_captions else data
                                    
                                    for caption_item in captions_to_try:
                                        if 'url' in caption_item:
                                            caption_url = caption_item['url']
                                            # Fix relative URLs
                                            if caption_url.startswith('/'):
                                                caption_url = f"{instance}{caption_url}"
                                                
                                            logger.info(f"Fetching caption from URL: {caption_url}")
                                            # Fetch captions - retry a few times
                                            for attempt in range(3):
                                                try:
                                                    caption_response = requests.get(caption_url, headers=headers, timeout=15)
                                                    if caption_response.status_code == 200:
                                                        # Process and return captions
                                                        caption_content = caption_response.text
                                                        
                                                        # Parse based on format (VTT, SRT etc)
                                                        if caption_url.endswith('.vtt') or 'format=vtt' in caption_url:
                                                            # Parse WebVTT
                                                            logger.info("Parsing VTT format captions")
                                                            lines = []
                                                            for line in caption_content.split('\n'):
                                                                line = line.strip()
                                                                # Skip timestamps, headers, and empty lines
                                                                if line and not line.startswith('WEBVTT') and not re.match(r'^\d{2}:\d{2}', line) and not re.match(r'^\d{2}:\d{2}:\d{2}', line) and not re.match(r'^-->$', line):
                                                                    lines.append(line)
                                                                    
                                                            combined_text = ' '.join(lines)
                                                            if len(combined_text) > 100:  # Only return if we have substantial content
                                                                logger.info(f"Successfully extracted VTT captions: {len(combined_text)} characters")
                                                                return combined_text
                                                        elif caption_url.endswith('.srt') or 'format=srt' in caption_url:
                                                            # Parse SRT
                                                            logger.info("Parsing SRT format captions")
                                                            lines = []
                                                            for line in caption_content.split('\n'):
                                                                line = line.strip()
                                                                # Skip timestamps, indexes, and empty lines
                                                                if line and not re.match(r'^\d+$', line) and not re.match(r'^\d{2}:\d{2}', line) and not re.match(r'^-->$', line):
                                                                    lines.append(line)
                                                                    
                                                            combined_text = ' '.join(lines)
                                                            if len(combined_text) > 100:
                                                                logger.info(f"Successfully extracted SRT captions: {len(combined_text)} characters")
                                                                return combined_text
                                                        else:
                                                            # Generic processing for unknown formats
                                                            logger.info("Parsing generic caption format")
                                                            processed_text = re.sub(r'\s+', ' ', caption_content)
                                                            if len(processed_text) > 100:
                                                                logger.info(f"Successfully extracted generic captions: {len(processed_text)} characters")
                                                                return processed_text
                                                        
                                                        break  # Exit retry loop on success
                                                    else:
                                                        logger.warning(f"Failed to fetch caption URL (attempt {attempt+1}): HTTP {caption_response.status_code}")
                                                except Exception as e:
                                                    logger.error(f"Error fetching caption URL (attempt {attempt+1}): {str(e)}")
                                                    
                                                if attempt < 2:  # Don't sleep after the last attempt
                                                    time.sleep(2)  # Wait before retrying
                            except Exception as e:
                                logger.error(f"Error processing Invidious captions: {str(e)}")

                        # STEP 2: If transcript API failed, try getting video details which might include captions
                        try:
                            logger.info(f"Trying Invidious video API for {video_id} using instance {instance}")
                            api_url = f"{instance}/api/v1/videos/{video_id}"
                            response = requests.get(api_url, headers=headers, timeout=15)

                            if response.status_code == 200:
                                data = response.json()

                                # Try to extract captions from video details
                                if 'captions' in data and isinstance(data['captions'], list) and len(data['captions']) > 0:
                                    logger.info(f"Found {len(data['captions'])} captions in video details")
                                    
                                    # First prioritize English captions
                                    english_captions = [c for c in data['captions'] if c.get('languageCode', '').startswith('en')]
                                    captions_to_try = english_captions if english_captions else data['captions']
                                    
                                    for caption in captions_to_try:
                                        caption_url = caption.get('url')
                                        if caption_url:
                                            # Fix relative URLs
                                            if caption_url.startswith('/'):
                                                caption_url = f"{instance}{caption_url}"

                                            logger.info(f"Fetching caption from video details URL: {caption_url}")
                                            # Retry a few times
                                            for attempt in range(3):
                                                try:
                                                    caption_response = requests.get(caption_url, headers=headers, timeout=15)
                                                    if caption_response.status_code == 200:
                                                        caption_content = caption_response.text
                                                        
                                                        # Parse based on format
                                                        if caption_url.endswith('.vtt') or 'format=vtt' in caption_url:
                                                            # Parse WebVTT
                                                            logger.info("Parsing VTT format captions from video details")
                                                            lines = []
                                                            for line in caption_content.split('\n'):
                                                                line = line.strip()
                                                                # Skip timestamps, headers, and empty lines
                                                                if line and not line.startswith('WEBVTT') and not re.match(r'^\d{2}:\d{2}', line) and not re.match(r'^\d{2}:\d{2}:\d{2}', line) and not re.match(r'^-->$', line):
                                                                    lines.append(line)
                                                                    
                                                            combined_text = ' '.join(lines)
                                                            if len(combined_text) > 100:
                                                                logger.info(f"Successfully extracted VTT captions from video details: {len(combined_text)} characters")
                                                                return combined_text
                                                        elif caption_url.endswith('.srt') or 'format=srt' in caption_url:
                                                            # Parse SRT
                                                            logger.info("Parsing SRT format captions from video details")
                                                            lines = []
                                                            for line in caption_content.split('\n'):
                                                                line = line.strip()
                                                                # Skip timestamps, indexes, and empty lines
                                                                if line and not re.match(r'^\d+$', line) and not re.match(r'^\d{2}:\d{2}', line) and not re.match(r'^-->$', line):
                                                                    lines.append(line)
                                                                    
                                                            combined_text = ' '.join(lines)
                                                            if len(combined_text) > 100:
                                                                logger.info(f"Successfully extracted SRT captions from video details: {len(combined_text)} characters")
                                                                return combined_text
                                                        else:
                                                            # Generic processing
                                                            logger.info("Parsing generic caption format from video details")
                                                            processed_text = re.sub(r'\s+', ' ', caption_content)
                                                            if len(processed_text) > 100:
                                                                logger.info(f"Successfully extracted generic captions from video details: {len(processed_text)} characters")
                                                                return processed_text
                                                            
                                                        break  # Exit retry loop on success
                                                    else:
                                                        logger.warning(f"Failed to fetch caption from video details (attempt {attempt+1}): HTTP {caption_response.status_code}")
                                                except Exception as e:
                                                    logger.error(f"Error fetching caption from video details (attempt {attempt+1}): {str(e)}")
                                                    
                                                if attempt < 2:
                                                    time.sleep(2)  # Wait before retrying

                                # STEP 3: If no captions found, we use the description as a last resort
                                # This is NOT the primary goal of this function but it's better than nothing
                                if 'description' in data and data['description'] and len(data['description']) > 200:
                                    title = data.get('title', 'Unknown')
                                    description = data['description']
                                    logger.info(f"Using video description as fallback: {len(description)} characters")
                                    return f"Title: {title}\n\nDescription: {description}"
                            
                        except Exception as e:
                            logger.error(f"Error getting video details from Invidious: {str(e)}")
                            
                    except Exception as e:
                        logger.error(f"Error with instance {instance} and user agent {user_agent}: {str(e)}")

                    # Small delay between attempts with the same instance
                    time.sleep(1)
                
                # Longer delay between instances
                time.sleep(2)

            logger.warning(f"All Invidious instances failed for video ID: {video_id}")
            return None

        except Exception as e:
            logger.error(f"Error getting transcript from Invidious with enhanced options: {str(e)}")
            return None

    def extract_video_id(self, youtube_url: str) -> Optional[str]:
        """
        Extract the video ID from a YouTube URL

        Args:
            youtube_url: URL of the YouTube video

        Returns:
            YouTube video ID or None if not found
        """
        try:
            # Try various URL patterns
            if 'youtu.be/' in youtube_url:
                # Short URL format: https://youtu.be/VIDEO_ID
                video_id = youtube_url.split('youtu.be/')[1].split('?')[0].split('&')[0]
                return video_id
            elif 'youtube.com/watch' in youtube_url:
                # Standard URL format: https://www.youtube.com/watch?v=VIDEO_ID
                if 'v=' in youtube_url:
                    video_id = youtube_url.split('v=')[1].split('&')[0]
                    return video_id
            elif 'youtube.com/embed/' in youtube_url:
                # Embed URL format: https://www.youtube.com/embed/VIDEO_ID
                video_id = youtube_url.split('embed/')[1].split('?')[0].split('&')[0]
                return video_id
            elif 'youtube.com/v/' in youtube_url:
                # Old embed URL format: https://www.youtube.com/v/VIDEO_ID
                video_id = youtube_url.split('v/')[1].split('?')[0].split('&')[0]
                return video_id
            
            # Use yt-dlp as fallback for more complex URLs
            try:
                ydl_opts = {
                    'quiet': True,
                    'no_warnings': True,
                    'skip_download': True,
                    'extract_flat': True
                }
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(youtube_url, download=False)
                    if info and 'id' in info:
                        return info['id']
            except Exception as e:
                logger.error(f"Failed to extract video ID using yt-dlp: {str(e)}")
            
            logger.error(f"Could not extract video ID from URL: {youtube_url}")
            return None
        except Exception as e:
            logger.error(f"Error extracting video ID: {str(e)}")
            return None

    def process_youtube_url(self, video_url: str) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        """
        Process a YouTube URL to extract transcript and metadata

        Args:
            video_url: URL of the YouTube video

        Returns:
            Tuple containing (transcript text, metadata dictionary)
        """
        # Get metadata first with enhanced options
        metadata = None
        try:
            # Try to get metadata with yt-dlp directly first
            logger.info(f"Getting metadata with yt-dlp: {video_url}")

            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'skip_download': True,
                'extract_flat': True,
                'force_generic_extractor': False,
                'http_headers': {
                    'User-Agent': self.get_random_user_agent()
                }
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                
                if info:
                    metadata = {
                        "title": info.get('title', 'Unknown'),
                        "author": info.get('uploader', 'Unknown'),
                        "length_seconds": info.get('duration', 0),
                        "views": info.get('view_count', 0),
                        "publish_date": info.get('upload_date', None),
                        "video_id": info.get('id', None),
                        "thumbnail_url": info.get('thumbnail', None),
                        "source_url": video_url
                    }
        except Exception as e:
            logger.error(f"Error getting metadata with yt-dlp: {str(e)}")
            # Set default metadata as fallback
            metadata = {
                "title": "Unknown",
                "source_url": video_url
            }
            
        # Try different methods to get video content
        video_id = metadata.get('video_id')
        if not video_id:
            video_id = self.extract_video_id(video_url)
            if not video_id:
                logger.error(f"Failed to extract video ID from URL: {video_url}")
                return None, metadata
                
        # Try different transcript acquisition methods
        logger.info(f"Processing YouTube video ID: {video_id}")

        # METHOD 1: Try YouTube Transcript API first
        logger.info("Method 1: Trying the YouTube Transcript API...")
        transcript_from_api = self.get_transcript_with_youtube_transcript_api(video_id)

        if transcript_from_api and len(transcript_from_api) > 500:
            logger.info(f"Successfully retrieved transcript with YouTube Transcript API: {len(transcript_from_api)} characters")
            return transcript_from_api, metadata

        # METHOD 2: Try YouTube Transcript API through proxies
        logger.info("Method 2: Trying YouTube Transcript API through proxies...")
        proxy_transcript = self.get_transcript_from_proxy_service(video_id)

        if proxy_transcript and len(proxy_transcript) > 500:
            logger.info(f"Successfully retrieved transcript through proxy service: {len(proxy_transcript)} characters")
            return proxy_transcript, metadata

        # METHOD 3: Try getting full transcript with enhanced yt-dlp options
        logger.info("Method 3: Trying to get full transcript with enhanced yt-dlp...")
        full_transcript = self.get_full_transcript_with_enhanced_yt_dlp(video_url)

        if full_transcript and len(full_transcript) > 500:
            logger.info(f"Successfully retrieved full transcript with enhanced yt-dlp: {len(full_transcript)} characters")
            return full_transcript, metadata

        # METHOD 4: Try Invidious API
        logger.info("Method 4: Trying to get transcript from Invidious with enhanced options...")
        enhanced_invidious_transcript = self.get_transcript_from_invidious_with_enhanced_options(video_id)

        if enhanced_invidious_transcript and len(enhanced_invidious_transcript) > 500:
            logger.info(f"Successfully retrieved transcript from Invidious with enhanced options: {len(enhanced_invidious_transcript)} characters")
            return enhanced_invidious_transcript, metadata

        # Use whatever partial content we might have obtained
        if transcript_from_api:
            logger.info("Using partial content from YouTube Transcript API")
            return transcript_from_api, metadata
        elif proxy_transcript:
            logger.info("Using partial content from proxy transcript service")
            return proxy_transcript, metadata
        elif full_transcript:
            logger.info("Using partial content from enhanced yt-dlp")
            return full_transcript, metadata
        elif enhanced_invidious_transcript:
            logger.info("Using partial content from Invidious with enhanced options")
            return enhanced_invidious_transcript, metadata

        # If we got to this point, return a fallback message
        logger.warning(f"Failed to retrieve any transcript content for video: {video_url}")
        fallback_text = f"Title: {metadata.get('title', 'Unknown')}\nAuthor: {metadata.get('author', 'Unknown')}\n\nUnable to extract content from this YouTube video."
        return fallback_text, metadata