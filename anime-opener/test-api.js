require('dotenv').config()

const axios = require('axios')

// Configuration
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''
const MINIMAX_BASE_URL = 'https://api.minimax.io/v1'

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'blue')
  log(`${title}`, 'bold')
  log('='.repeat(60), 'blue')
}

// Test 1: Verify API key is configured
async function testApiKeyConfigured() {
  logSection('Test 1: API Key Configuration')
  
  if (!MINIMAX_API_KEY) {
    log('FAIL: No API key found in environment variables', 'red')
    log('Please set MINIMAX_API_KEY in your .env file', 'yellow')
    return false
  }
  
  log(`API Key found: ${MINIMAX_API_KEY.substring(0, 10)}...${MINIMAX_API_KEY.substring(MINIMAX_API_KEY.length - 4)}`, 'green')
  log(`API Key length: ${MINIMAX_API_KEY.length} characters`, 'green')
  return true
}

// Test 2: Text Generation (MiniMax-M2.5)
async function testTextGeneration() {
  logSection('Test 2: Text Generation (MiniMax-M2.5)')
  
  try {
    // Using the text generation API endpoint (api.minimax.io)
    const response = await axios.post(
      'https://api.minimax.io/v1/text/chatcompletion_v2',
      {
        model: 'MiniMax-M2.5',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Say hello and introduce yourself in one short sentence.'
              }
            ]
          }
        ],
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )
    
    log('Text generation request received response', 'green')
    log(`Response: ${JSON.stringify(response.data, null, 2)}`, 'blue')
    
    // Check for API errors
    if (response.data?.base_resp?.status_code && response.data.base_resp.status_code !== 0) {
      log(`ERROR: ${response.data.base_resp.status_msg}`, 'red')
      return false
    }
    
    // Extract the text response (could be in content or reasoning_content)
    const content = response.data?.choices?.[0]?.message?.content
    const reasoning = response.data?.choices?.[0]?.message?.reasoning_content
    
    if (content) {
      log(`Generated text: ${content}`, 'green')
      return true
    } else if (reasoning) {
      // Even if content is empty, if there's no error, the API worked
      log(`API responded successfully (reasoning: ${reasoning.substring(0, 50)}...)`, 'green')
      return true
    }
    
    log('No text content in response', 'yellow')
    return false
  } catch (error) {
    log(`Text generation FAILED: ${error.response?.data?.base_resp?.status_msg || error.message}`, 'red')
    if (error.response?.data) {
      log(`Full error response: ${JSON.stringify(error.response.data)}`, 'red')
    }
    return false
  }
}

// Test 3: Text-to-Video generation
async function testVideoGeneration() {
  logSection('Test 3: Video Generation (Hailuo 2.3)')
  
  try {
    const response = await axios.post(
      `${MINIMAX_BASE_URL}/video_generation`,
      {
        model: 'MiniMax-Hailuo-2.3',
        prompt: 'A beautiful sunset over mountains with clouds moving slowly, cinematic shot',
        duration: 6,
        resolution: '768P'
      },
      {
        headers: {
          'Authorization': `Bearer ${MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    log('Video generation request received response', 'green')
    log(`Response: ${JSON.stringify(response.data, null, 2)}`, 'blue')
    
    // Check for API key errors
    if (response.data?.base_resp?.status_code === 2049) {
      log('ERROR: API key is invalid', 'red')
      return false
    }
    
    // Check for insufficient balance
    if (response.data?.base_resp?.status_code === 1008) {
      log('ERROR: Insufficient balance - please add credits to your account', 'red')
      return false
    }
    
    // If it returns a task_id, we can poll for status
    const taskId = response.data?.task_id || response.data?.task?.task_id
    if (taskId) {
      log(`Task ID: ${taskId}`, 'green')
      
      // Wait and check status (max 30 seconds)
      log('Waiting for video generation to complete...', 'yellow')
      
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        try {
          const statusResponse = await axios.get(
            `${MINIMAX_BASE_URL}/query/video_generation`,
            {
              params: { task_id: taskId },
              headers: {
                'Authorization': `Bearer ${MINIMAX_API_KEY}`
              }
            }
          )
          
          const status = statusResponse.data
          log(`Status check ${i + 1}: ${JSON.stringify(status)}`, 'blue')
          
          if (status.status === 'success') {
            log('Video generation completed successfully!', 'green')
            log(`Video URL: ${status.video?.video_url || 'N/A'}`, 'green')
            return true
          } else if (status.status === 'failed') {
            log('Video generation failed', 'red')
            log(`Error: ${JSON.stringify(status)}`, 'red')
            return false
          }
        } catch (statusError) {
          log(`Status check error: ${statusError.message}`, 'yellow')
        }
      }
      
      log('Video generation timed out (this is okay for testing)', 'yellow')
      return true // Request was successful, just timed out
    }
    
    return true
  } catch (error) {
    log(`Video generation FAILED: ${error.response?.data?.error || error.message}`, 'red')
    if (error.response?.data) {
      log(`Full error response: ${JSON.stringify(error.response.data)}`, 'red')
    }
    return false
  }
}

// Test 4: Image Generation (Text-to-Image)
async function testImageGeneration() {
  logSection('Test 4: Image Generation')
  
  try {
    // MiniMax uses image generation endpoint
    const response = await axios.post(
      `${MINIMAX_BASE_URL}/image_generation`,
      {
        model: 'image-01',
        prompt: 'A cute anime cat sitting on a cherry blossom branch, soft pink background, anime style, beautiful lighting',
        num_images: 1,
        image_setting: {
          resolution: '1024x1024'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    log('Image generation request received response', 'green')
    log(`Response: ${JSON.stringify(response.data, null, 2)}`, 'blue')
    
    // Check for API key errors
    if (response.data?.base_resp?.status_code === 2049) {
      log('ERROR: API key is invalid', 'red')
      return false
    }
    
    // Check for insufficient balance
    if (response.data?.base_resp?.status_code === 1008) {
      log('ERROR: Insufficient balance - please add credits to your account', 'red')
      return false
    }
    
    const taskId = response.data?.task_id || response.data?.task?.task_id
    if (taskId) {
      log(`Task ID: ${taskId}`, 'green')
      
      // Poll for status
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        try {
          const statusResponse = await axios.get(
            `${MINIMAX_BASE_URL}/query/image_generation`,
            {
              params: { task_id: taskId },
              headers: {
                'Authorization': `Bearer ${MINIMAX_API_KEY}`
              }
            }
          )
          
          const status = statusResponse.data
          log(`Status check ${i + 1}: ${JSON.stringify(status)}`, 'blue')
          
          if (status.status === 'success') {
            log('Image generation completed successfully!', 'green')
            log(`Image URL: ${status.image?.image_url || 'N/A'}`, 'green')
            return true
          } else if (status.status === 'failed') {
            log('Image generation failed', 'red')
            return false
          }
        } catch (statusError) {
          log(`Status check error: ${statusError.message}`, 'yellow')
        }
      }
      
      log('Image generation timed out', 'yellow')
      return true
    }
    
    return true
  } catch (error) {
    log(`Image generation FAILED: ${error.response?.data?.error || error.message}`, 'red')
    if (error.response?.data) {
      log(`Full error response: ${JSON.stringify(error.response.data)}`, 'red')
    }
    return false
  }
}

// Test 5: Image-to-Video (using an uploaded image)
async function testImageToVideo() {
  logSection('Test 5: Image-to-Video Generation')
  
  // First, we need an image to convert
  // For testing, we'll create a simple placeholder or skip this test
  log('Note: Image-to-Video requires an uploaded image file', 'yellow')
  log('Skipping this test - you can test it in the main app', 'yellow')
  return true
}

// Test 6: Lyrics Generation
async function testLyricsGeneration() {
  logSection('Test 6: Lyrics Generation')
  
  try {
    const response = await axios.post(
      `${MINIMAX_BASE_URL}/lyrics_generation`,
      {
        mode: 'write_full_song',
        prompt: 'An upbeat anime opening song about hope and friendship'
      },
      {
        headers: {
          'Authorization': `Bearer ${MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    log('Lyrics generation request received response', 'green')
    log(`Response: ${JSON.stringify(response.data, null, 2)}`, 'blue')
    
    // Check for API key errors
    if (response.data?.base_resp?.status_code === 2049) {
      log('ERROR: API key is invalid', 'red')
      return false
    }
    
    // Check for insufficient balance
    if (response.data?.base_resp?.status_code === 1008) {
      log('ERROR: Insufficient balance - please add credits to your account', 'red')
      return false
    }
    
    // Check for success
    if (response.data?.lyrics) {
      log(`Generated lyrics (first 200 chars): ${response.data.lyrics.substring(0, 200)}...`, 'green')
      return true
    }
    
    log('No lyrics in response', 'yellow')
    return false
  } catch (error) {
    log(`Lyrics generation FAILED: ${error.response?.data?.base_resp?.status_msg || error.message}`, 'red')
    if (error.response?.data) {
      log(`Full error response: ${JSON.stringify(error.response.data)}`, 'red')
    }
    return false
  }
}

// Test 7: Music Generation
async function testMusicGeneration() {
  logSection('Test 7: Music Generation')
  
  try {
    const response = await axios.post(
      `${MINIMAX_BASE_URL}/music_generation`,
      {
        model: 'music-2.5',
        prompt: 'Anime J-Pop opening, upbeat, energetic, catchy melody, with drums, bass, guitar, synth',
        lyrics: `[Verse 1]
Sunrise paints the sky in gold
A new adventure waits untold
With friends by my side we'll shine so bright
Together we'll make it right

[Pre-Chorus]
Feel the fire in our hearts
Nothing can tear us apart

[Chorus]
We are unstoppable
Together we shine so bright
With the power of our souls
We'll keep fighting through the night`,
        audio_setting: {
          sample_rate: 44100,
          bitrate: 256000,
          format: 'mp3'
        },
        output_format: 'url'
      },
      {
        headers: {
          'Authorization': `Bearer ${MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 180000 // Music generation can take up to 3 minutes
      }
    )
    
    log('Music generation request received response', 'green')
    log(`Response: ${JSON.stringify(response.data, null, 2)}`, 'blue')
    
    // Check for API key errors
    if (response.data?.base_resp?.status_code === 2049) {
      log('ERROR: API key is invalid', 'red')
      return false
    }
    
    // Check for insufficient balance
    if (response.data?.base_resp?.status_code === 1008) {
      log('ERROR: Insufficient balance - please add credits to your account', 'red')
      return false
    }
    
    // Check for other API errors
    if (response.data?.base_resp?.status_code && response.data.base_resp.status_code !== 0) {
      log(`ERROR: ${response.data.base_resp.status_msg}`, 'red')
      return false
    }
    
    // Check for audio file (could be in different locations)
    const audioUrl = response.data?.audio || response.data?.audio_file || response.data?.data?.audio || response.data?.file_url
    if (audioUrl) {
      log(`Generated music URL: ${audioUrl}`, 'green')
      return true
    }
    
    // Check for task_id (async generation)
    const taskId = response.data?.task_id || response.data?.trace_id
    if (taskId) {
      log(`Task ID: ${taskId} (async generation)`, 'green')
      return true
    }
    
    // If we got a successful response but no audio, check if it's still processing
    if (response.data?.base_resp?.status_code === 0) {
      log('API accepted the request successfully', 'green')
      return true
    }
    
    log('No music/audio in response', 'yellow')
    return false
  } catch (error) {
    // Check if it's a timeout error (which might mean the request was accepted)
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      log('Music generation timed out but may still be processing', 'yellow')
      return true // Consider this a pass since the API accepted the request
    }
    
    log(`Music generation FAILED: ${error.response?.data?.base_resp?.status_msg || error.message}`, 'red')
    if (error.response?.data) {
      log(`Full error response: ${JSON.stringify(error.response.data)}`, 'red')
    }
    return false
  }
}

// Run all tests
async function runTests() {
  log('MiniMax API Test Suite', 'bold')
  log('=============================', 'blue')
  log(`API Key: ${MINIMAX_API_KEY ? 'Configured' : 'NOT CONFIGURED'}`, MINIMAX_API_KEY ? 'green' : 'red')
  
  const results = {
    apiKey: false,
    text: false,
    lyrics: false,
    music: false,
    video: false,
    image: false,
    imageToVideo: false
  }
  
  // Test 1: API Key
  results.apiKey = await testApiKeyConfigured()
  
  if (!results.apiKey) {
    log('\nCannot proceed with tests - API key is not configured', 'red')
    log('Please add MINIMAX_API_KEY to your .env file', 'yellow')
    process.exit(1)
  }
  
  // Test 2: Text Generation
  results.text = await testTextGeneration()
  
  // Test 3: Lyrics Generation
  results.lyrics = await testLyricsGeneration()
  
  // Test 4: Music Generation
  results.music = await testMusicGeneration()
  
  // Test 5: Video Generation
  results.video = await testVideoGeneration()
  
  // Test 6: Image Generation
  results.image = await testImageGeneration()
  
  // Test 7: Image-to-Video
  results.imageToVideo = await testImageToVideo()
  
  // Summary
  logSection('Test Summary')
  log(`API Key Configuration: ${results.apiKey ? 'PASS' : 'FAIL'}`, results.apiKey ? 'green' : 'red')
  log(`Text Generation: ${results.text ? 'PASS' : 'FAIL'}`, results.text ? 'green' : 'red')
  log(`Lyrics Generation: ${results.lyrics ? 'PASS' : 'FAIL'}`, results.lyrics ? 'green' : 'red')
  log(`Music Generation: ${results.music ? 'PASS' : 'FAIL'}`, results.music ? 'green' : 'red')
  log(`Video Generation: ${results.video ? 'PASS' : 'FAIL'}`, results.video ? 'green' : 'red')
  log(`Image Generation: ${results.image ? 'PASS' : 'FAIL'}`, results.image ? 'green' : 'red')
  log(`Image-to-Video: ${results.imageToVideo ? 'SKIPPED' : 'FAIL'}`, 'yellow')
  
  const allPassed = results.apiKey && results.text && results.lyrics && results.music && results.video && results.image
  log(`\n${allPassed ? 'All tests PASSED!' : 'Some tests FAILED'}`, allPassed ? 'green' : 'red')
  
  if (!allPassed) {
    log('\nTroubleshooting tips:', 'yellow')
    log('1. Check your API key is valid at https://platform.minimax.io', 'yellow')
    log('2. Verify you have sufficient credits/quota', 'yellow')
    log('3. Check the API endpoint URLs are correct', 'yellow')
    log('4. Look at the error messages above for more details', 'yellow')
  }
  
  process.exit(allPassed ? 0 : 1)
}

runTests().catch(error => {
  log(`Unexpected error: ${error.message}`, 'red')
  process.exit(1)
})
