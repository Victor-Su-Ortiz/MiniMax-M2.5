import { useState, useCallback } from 'react'
import './App.css'

interface GenerationStep {
  id: number
  label: string
  status: 'pending' | 'processing' | 'completed' | 'error'
}

interface GenerationResult {
  videoUrl: string
  musicUrl?: string
}

function App() {
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [theme, setTheme] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState<GenerationStep[]>([
    { id: 1, label: 'Uploading Image', status: 'pending' },
    { id: 2, label: 'Generating Music', status: 'pending' },
    { id: 3, label: 'Creating Video', status: 'pending' },
    { id: 4, label: 'Merging & Finalizing', status: 'pending' },
  ])
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const updateStep = (stepId: number, status: GenerationStep['status']) => {
    setProgress(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ))
  }

  const handleImageSelect = useCallback((file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB')
      return
    }
    setImage(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
    setError(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      handleImageSelect(file)
    }
  }, [handleImageSelect])

  const handleGenerate = async () => {
    if (!image || !theme.trim()) {
      setError('Please upload an image and enter a theme')
      return
    }

    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      updateStep(1, 'processing')
      
      const formData = new FormData()
      formData.append('image', image)
      formData.append('theme', theme)

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Generation failed')
      }

      updateStep(1, 'completed')
      updateStep(2, 'processing')

      // Poll for completion
      const data = await response.json()
      
      if (data.status === 'processing') {
        updateStep(2, 'completed')
        updateStep(3, 'processing')
        
        // Poll for video generation
        let videoReady = false
        while (!videoReady) {
          await new Promise(resolve => setTimeout(resolve, 3000))
          const statusRes = await fetch(`/api/status/${data.taskId}`)
          const statusData = await statusRes.json()
          
          if (statusData.status === 'success') {
            videoReady = true
            updateStep(3, 'completed')
            updateStep(4, 'processing')
            
            setResult({
              videoUrl: statusData.videoUrl,
              musicUrl: data.musicUrl
            })
            updateStep(4, 'completed')
          } else if (statusData.status === 'failed') {
            throw new Error('Video generation failed')
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      progress.forEach(step => {
        if (step.status === 'processing') {
          updateStep(step.id, 'error')
        }
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const themeSuggestions = [
    'Epic battle scene with dramatic orchestra',
    'Peaceful slice of life in a cherry blossom garden',
    'Intense sports championship',
    'Mysterious magical girl transformation',
    'Heartwarming reunion after long separation',
    'Futuristic cyberpunk city chase',
  ]

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <h1>Anime Opener</h1>
          </div>
          <p className="tagline">Create stunning anime opening videos with AI</p>
        </div>
        <div className="header-decoration"></div>
      </header>

      <main className="main">
        <section className="input-section">
          <div className="glass-card input-card">
            <h2>Start Creating</h2>
            
            <div className="upload-area" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
              {imagePreview ? (
                <div className="image-preview">
                  <img src={imagePreview} alt="Preview" />
                  <button 
                    className="remove-image"
                    onClick={() => { setImage(null); setImagePreview(null) }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="upload-placeholder">
                  <div className="upload-icon">🎬</div>
                  <p>Drop your image here</p>
                  <span>or click to browse</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                  />
                </div>
              )}
            </div>

            <div className="theme-input">
              <label>Anime Opening Theme</label>
              <textarea
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Describe your anime opening... (e.g., 'Epic battle scene with dramatic orchestra')"
                maxLength={500}
              />
              <div className="theme-footer">
                <span className="char-count">{theme.length}/500</span>
              </div>
              <div className="suggestions">
                <span>Quick prompts:</span>
                {themeSuggestions.slice(0, 3).map((suggestion, i) => (
                  <button 
                    key={i} 
                    onClick={() => setTheme(suggestion)}
                    className="suggestion-chip"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="error-message">
                <span>⚠</span> {error}
              </div>
            )}

            <button 
              className={`generate-btn ${isGenerating ? 'loading' : ''}`}
              onClick={handleGenerate}
              disabled={isGenerating || !image || !theme.trim()}
            >
              {isGenerating ? (
                <>
                  <span className="spinner"></span>
                  Creating Your Anime Opening...
                </>
              ) : (
                <>
                  <span className="btn-icon">✨</span>
                  Generate Anime Opening
                </>
              )}
            </button>
          </div>

          {isGenerating && (
            <div className="progress-section">
              <div className="glass-card progress-card">
                <h3>Generating Your Video</h3>
                <div className="progress-steps">
                  {progress.map((step, index) => (
                    <div 
                      key={step.id} 
                      className={`progress-step ${step.status}`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="step-indicator">
                        {step.status === 'completed' && '✓'}
                        {step.status === 'processing' && <span className="step-spinner"></span>}
                        {step.status === 'error' && '✗'}
                        {step.status === 'pending' && step.id}
                      </div>
                      <span className="step-label">{step.label}</span>
                    </div>
                  ))}
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${(progress.filter(s => s.status === 'completed').length / progress.length) * 100}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {result && (
          <section className="result-section">
            <div className="glass-card result-card">
              <h2>Your Anime Opening</h2>
              <div className="video-container">
                <video 
                  src={result.videoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  className="result-video"
                />
              </div>
              <div className="result-actions">
                <a 
                  href={result.videoUrl} 
                  download="anime-opening.mp4" 
                  className="download-btn"
                >
                  <span>⬇</span> Download Video
                </a>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <p>
          Powered by <a href="https://platform.minimax.io" target="_blank" rel="noopener">MiniMax AI</a>
        </p>
        <p className="jp-text">アニメオープニングを作成</p>
      </footer>
    </div>
  )
}

export default App
