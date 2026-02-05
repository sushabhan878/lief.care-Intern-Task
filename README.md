# Lief Notes MVP

Doctor case notes MVP built with Next.js App Router, NextAuth credentials, MongoDB, and OCR for scans and PDFs.

## Features

- Doctor sign up and sign in (credentials)
- Rich text manual notes (TipTap)
- Scan uploads with OCR (images + PDFs)
- Notes stored per doctor in MongoDB
- Protected notes API with NextAuth session

## Tech Stack

- Next.js 16 (App Router)
- React 19
- NextAuth v4 (credentials provider)
- MongoDB
- TipTap editor
- Tesseract.js OCR + pdfjs-dist
- Tailwind CSS v4

## Requirements

- Node.js 20+
- MongoDB connection string

## Environment Variables

Create a .env.local file in the project root:

```
MONGODB_URI=your_mongodb_connection_string
NEXTAUTH_SECRET=your_random_secret
NEXTAUTH_URL=http://localhost:3000
```

## Install

```
npm install
```

## Run

```
npm run dev
```

Open http://localhost:3000

## Build

```
npm run build
npm run start
```

## API Routes

- POST /api/auth/register
  - Body: { name, position, email, password }
  - Creates a doctor account (hashed password)
- GET /api/notes
  - Returns the authenticated doctor’s notes
- POST /api/notes
  - Body: { title, source, contentHtml?, ocrText?, fileData?, fileName?, fileType? }
  - Saves a manual or scanned note

## Notes

- OCR runs in the browser using Tesseract.js. Large PDFs may take longer to process.
- Notes are stored in the lief_mvp database in MongoDB.

## Project Structure

- app/page.tsx: UI + OCR + note creation
- app/api/auth/register/route.ts: signup endpoint
- app/api/auth/[...nextauth]/route.ts: NextAuth handler
- app/api/notes/route.ts: notes CRUD endpoints
- lib/auth.ts: NextAuth config
- lib/mongodb.ts: MongoDB client
