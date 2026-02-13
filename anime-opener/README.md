# Anime Opening Generator

Create stunning anime opening videos using MiniMax AI APIs.

## Prerequisites

- Node.js 18+
- MiniMax API Key (get one at https://platform.minimax.io)

## Installation

```bash
cd anime-opener
npm install
```

## Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Add your MiniMax API key to `.env`:
```
MINIMAX_API_KEY=your_api_key_here
```

## Running

### Development (both frontend and backend)
```bash
npm start
```

This will start:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Separate runs
```bash
# Frontend only
npm run dev

# Backend only  
npm run server
```

## Features

- **Image Upload**: Upload any image to use as the base for your anime opening
- **AI Music Generation**: Create original anime-style music based on your theme
- **AI Video Generation**: Transform your image into a dynamic anime video
- **Preview & Download**: Watch your creation and download the final video

## MiniMax APIs Used

- **Lyrics Generation**: Creates original song lyrics based on your theme
- **Music Generation**: Produces anime-style music with the generated lyrics
- **Video Generation**: Creates video from your uploaded image
- **File Upload**: Handles image uploads for video generation

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express
- **APIs**: MiniMax AI (Video, Music, Lyrics)

## License

MIT
