import express from 'express'
import cors from 'cors'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { fileURLToPath } from 'url'
import FormData from 'form-data'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
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
const MINIMAX_BASE_URL = 'https://api.minimax.chat/v1'

// Helper function to make MiniMax API requests
async function minimaxRequest(endpoint: string, data: any) {
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
async function generateLyrics(theme: string) {
  try {
    const response = await minimaxRequest('/lyrics_generation', {
      mode: 'write_full_song',
      prompt: `Anime opening song about: ${theme}. Write a dramatic, emotional J-pop style song with verse, chorus, bridge structure.`
    })
    return response.lyrics || getDefaultLyrics(theme)
  } catch (error) {
    console.error('Lyrics generation error:', error)
    return getDefaultLyrics(theme)
  }
}

// Default lyrics fallback
function getDefaultLyrics(theme: string): string {
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
async function generateMusic(theme: string, lyrics: string) {
  const response = await minimaxRequest('/music_generation', {
    model: 'music-01',
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
async function uploadImage(imagePath: string) {
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
  return response.data.file
}

// Generate video from image
async function generateVideo(imageUrl: string, theme: string) {
  const prompt = `Anime style video, ${theme}, dynamic camera movement, dramatic lighting, anime aesthetic, smooth motion, cinematic`
  
  const response = await minimaxRequest('/video_generation', {
    model: 'video-01',
    prompt: prompt,
    image_url: imageUrl,
    duration: 6,
    resolution: '720P'
  })
  return response
}

// Query video generation status
async function queryVideoStatus(taskId: string) {
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
async function mergeVideoAndAudio(videoUrl: string, audioUrl: string): Promise<string> {
  // For demo purposes, return the video URL
  // In production, use FFmpeg to merge video and audio
  return videoUrl
}

// API Routes
app.post('/api/generate', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' })
    }

    if (!MINIMAX_API_KEY) {
      return res.status(500).json({ 
        error: 'MiniMax API key not configured. Please set MINIMAX_API_KEY environment variable.' 
      })
    }

    const { theme } = req.body
    const imagePath = req.file.path

    // Step 1: Upload image
    const uploadedFile = await uploadImage(imagePath)
    const imageUrl = uploadedFile.file_url

    // Step 2: Generate lyrics
    const lyrics = await generateLyrics(theme)

    // Step 3: Generate music
    const musicResult = await generateMusic(theme, lyrics)
    const musicUrl = musicResult.audio_file

    // Step 4: Generate video
    const videoResult = await generateVideo(imageUrl, theme)
    const taskId = videoResult.task_id

    // Store task info
    tasks.set(taskId, {
      theme,
      imagePath,
      imageUrl,
      musicUrl,
      lyrics,
      status: 'processing',
      createdAt: Date.now()
    })

    res.json({
      status: 'processing',
      taskId,
      musicUrl,
      lyrics
    })
  } catch (error: any) {
    console.error('Generation error:', error)
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
  } catch (error: any) {
    console.error('Status query error:', error)
    res.status(500).json({ 
      error: error.message || 'Failed to query status' 
    })
  }
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', apiKeyConfigured: !!MINIMAX_API_KEY })
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
