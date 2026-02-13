require('dotenv').config()

const express = require('express')
const cors = require('cors')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const FormData = require('form-data')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}))
app.use(express.json())

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
})

// In-memory storage for tasks (in production, use a database)
const tasks = new Map()

// MiniMax API Configuration
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''
const MINIMAX_BASE_URL = 'https://api.minimax.io/v1'

console.log('MINIMAX_API_KEY loaded:', MINIMAX_API_KEY ? 'Yes (length: ' + MINIMAX_API_KEY.length + ')' : 'No')

// Helper function to make MiniMax API requests
async function minimaxRequest(endpoint, data) {
  const response = await axios.post(
    `${MINIMAX_BASE_URL}${endpoint}`,
    data,
    {
      headers: {
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  )
  return response.data
}

// Generate lyrics based on theme
async function generateLyrics(theme) {
  try {
    const response = await minimaxRequest('/lyrics_generation', {
      mode: 'write_full_song',
      prompt: `Anime opening song about: ${theme}. Write a dramatic, emotional J-pop style song with verse, chorus, bridge structure.`
    })
    return response.lyrics || getDefaultLyrics(theme)
  } catch (error) {
    console.error('Lyrics generation error:', error.response?.data || error.message)
    return getDefaultLyrics(theme)
  }
}

// Default lyrics fallback
function getDefaultLyrics(theme) {
  return `[Intro]
(Oh~)
This is our story now
Let's begin tonight

[Verse 1]
In the darkness we stand together
Forever bound by destiny
The stars guide our way tonight
As we chase our dreams

[Pre-Chorus]
Feel the fire in our hearts
Nothing can tear us apart

[Chorus]
We are unstoppable
Together we shine so bright
With the power of our souls
We'll keep fighting through the night

[Verse 2]
Memories fade but we'll remember
Every moment that we've shared
The journey continues on
With hope we will persevere

[Bridge]
(One more time)
We rise again
(One more time)
Until the end

[Chorus]
We are unstoppable
Together we shine so bright
With the power of our souls
We'll keep fighting through the night

[Outro]
(This is our story...)
Our story begins now...`
}

// Generate music based on theme and lyrics
async function generateMusic(theme, lyrics) {
  const response = await minimaxRequest('/music_generation', {
    model: 'music-2.5',
    prompt: `Anime J-Pop opening, ${theme}, emotional, dramatic, high energy, catchy melody, with drums, bass, guitar, synth`,
    lyrics: lyrics,
    audio_setting: {
      sample_rate: 44100,
      bitrate: 256000,
      format: 'mp3'
    },
    output_format: 'url'
  })
  return response
}

// Upload image and get URL for video generation
async function uploadImage(imagePath) {
  const formData = new FormData()
  formData.append('file', fs.createReadStream(imagePath))
  
  const response = await axios.post(
    `${MINIMAX_BASE_URL}/files/upload`,
    formData,
    {
      headers: {
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        ...formData.getHeaders()
      }
    }
  )
  
  console.log('File upload response:', JSON.stringify(response.data))
  
  // Handle different response formats
  const data = response.data
  if (data.file) {
    return data.file
  } else if (data.file_url) {
    return { file_url: data.file_url }
  } else if (data.files && data.files[0]) {
    return data.files[0]
  } else if (data.url) {
    return { file_url: data.url }
  } else {
    return data
  }
}

// Generate video from image
async function generateVideo(imageUrl, theme) {
  const prompt = `Anime style video, ${theme}, dynamic camera movement, dramatic lighting, anime aesthetic, smooth motion, cinematic`
  
  const response = await minimaxRequest('/video_generation', {
    model: 'MiniMax-Hailuo-2.3',
    prompt: prompt,
    image_url: imageUrl,
    duration: 6,
    resolution: '720P'
  })
  console.log('Video generation response:', JSON.stringify(response))
  return response
}

// Query video generation status
async function queryVideoStatus(taskId) {
  const response = await axios.get(
    `${MINIMAX_BASE_URL}/query/video_generation`,
    {
      params: { task_id: taskId },
      headers: {
        'Authorization': `Bearer ${MINIMAX_API_KEY}`
      }
    }
  )
  return response.data
}

// Merge video and audio (simplified - in production use FFmpeg)
async function mergeVideoAndAudio(videoUrl, audioUrl) {
  // For demo purposes, return the video URL
  // In production, use FFmpeg to merge video and audio
  return videoUrl
}

// Generate image from text (for video generation)
async function generateImage(prompt) {
  const response = await minimaxRequest('/image_generation', {
    model: 'image-01',
    prompt: prompt,
    num_images: 1,
    image_setting: {
      resolution: '1024x1024'
    }
  })
  console.log('Image generation response:', JSON.stringify(response))
  return response
}

// Query image generation status
async function queryImageStatus(taskId) {
  const response = await axios.get(
    `${MINIMAX_BASE_URL}/query/image_generation`,
    {
      params: { task_id: taskId },
      headers: {
        'Authorization': `Bearer ${MINIMAX_API_KEY}`
      }
    }
  )
  return response.data
}

// API Routes
app.post('/api/generate', upload.single('image'), async (req, res) => {
  try {
    const { theme } = req.body

    if (!MINIMAX_API_KEY) {
      return res.status(500).json({ 
        error: 'MiniMax API key not configured. Please set MINIMAX_API_KEY environment variable.' 
      })
    }

    // Step 1: Generate an image (text-to-image) - either from uploaded file description or theme
    let imageUrl = null
    
    if (req.file) {
      // If user uploaded an image, try to use it (this may fail due to upload endpoint issues)
      // For now, we'll also generate a new image based on the theme
      console.log('User uploaded file, but generating new image based on theme')
    }
    
    // Generate a new image based on the theme
    const imageResult = await generateImage(`${theme}, anime style, beautiful vibrant colors, high quality`)
    const imageTaskId = imageResult?.id || imageResult?.task_id
    
    if (imageTaskId) {
      // Poll for image to get the URL
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        try {
          const statusResult = await queryImageStatus(imageTaskId)
          if (statusResult?.status === 'success') {
            imageUrl = statusResult?.image?.image_url || statusResult?.data?.image_urls?.[0]
            break
          }
        } catch (e) {
          console.log('Image status check error:', e.message)
        }
      }
    }
    
    // If we still don't have an image URL, try to use the direct response
    if (!imageUrl) {
      imageUrl = imageResult?.data?.image_urls?.[0] || imageResult?.image?.image_url
    }
    
    console.log('Generated image URL:', imageUrl)

    // Step 2: Generate lyrics
    const lyrics = await generateLyrics(theme)

    // Step 3: Generate music
    const musicResult = await generateMusic(theme, lyrics)
    console.log('Music generation response:', JSON.stringify(musicResult))
    const musicUrl = musicResult?.data?.audio || musicResult?.audio_file || musicResult?.audio?.file_url || musicResult?.file_url || musicResult?.url || musicResult

    // Step 4: Generate video (if we have an image URL)
    let taskId = null
    let videoResult = null
    
    if (imageUrl) {
      videoResult = await generateVideo(imageUrl, theme)
      console.log('Video generation response:', JSON.stringify(videoResult))
      taskId = videoResult?.task_id || videoResult?.task?.task_id || videoResult
    }

    // Store task info
    if (taskId) {
      tasks.set(taskId, {
        theme,
        imageUrl,
        musicUrl,
        lyrics,
        status: 'processing',
        createdAt: Date.now()
      })
    }

    res.json({
      status: taskId ? 'processing' : 'completed',
      taskId,
      musicUrl,
      imageUrl,
      lyrics
    })
  } catch (error) {
    console.error('Generation error:', error.response?.data || error.message)
    res.status(500).json({ 
      error: error.message || 'Failed to generate anime opening' 
    })
  }
})

// Query task status
app.get('/api/status/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params
    const task = tasks.get(taskId)

    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    // Query video status
    const statusResult = await queryVideoStatus(taskId)

    if (statusResult.status === 'success') {
      const videoUrl = statusResult.video?.video_url
      
      // Merge video and audio
      const finalVideoUrl = await mergeVideoAndAudio(videoUrl, task.musicUrl)

      task.status = 'success'
      task.videoUrl = finalVideoUrl
      tasks.set(taskId, task)

      res.json({
        status: 'success',
        videoUrl: finalVideoUrl
      })
    } else if (statusResult.status === 'failed') {
      task.status = 'failed'
      tasks.set(taskId, task)
      
      res.json({
        status: 'failed',
        error: 'Video generation failed'
      })
    } else {
      res.json({
        status: 'processing'
      })
    }
  } catch (error) {
    console.error('Status query error:', error.response?.data || error.message)
    res.status(500).json({ 
      error: error.message || 'Failed to query status' 
    })
  }
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', apiKeyConfigured: !!MINIMAX_API_KEY, apiKeyLength: MINIMAX_API_KEY.length })
})

// Cleanup old files periodically
setInterval(() => {
  const uploadsDir = path.join(__dirname, 'uploads')
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir)
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    
    files.forEach(file => {
      const filePath = path.join(uploadsDir, file)
      const stats = fs.statSync(filePath)
      if (stats.mtimeMs < oneHourAgo) {
        fs.unlinkSync(filePath)
      }
    })
  }
}, 60 * 60 * 1000) // Every hour

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`MiniMax API key configured: ${!!MINIMAX_API_KEY}`)
})
