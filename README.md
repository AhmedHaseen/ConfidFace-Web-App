# ConfidFace 🎯

> **Build Interview Confidence with AI-Powered Practice Sessions**

ConfidFace is a web-based AI-powered mock interview application designed to help students, job seekers, and fresh graduates improve their interview performance through realistic, automated interview simulations.

🎬 **[Watch Demo](https://canva.link/4qq04ozyjoox918)**

---

## Overview

Many students and job seekers struggle with interview anxiety and lack access to realistic practice environments. Traditional preparation tools focus on theory or recorded content, while human mock interviews are costly and unscalable.

ConfidFace bridges this gap by providing an automated, repeatable, and interactive interview practice platform — available anytime, without a human interviewer.

---

## Features

- 🔐 **User Authentication** — Secure registration, login, and session management via Clerk
- 📄 **Resume Upload / Job Description Input** — Parses content to generate role-specific questions
- 🤖 **AI-Based Question Generation** — Powered by Google Gemini API via n8n automation workflows
- 🎥 **AI Avatar Interviewer** — A pre-generated AI streaming avatar (via D-ID) that asks questions, pauses while the candidate responds, then resumes for the next question — developed as an alternative solution due to WebRTC limitations with real-time streaming
- 🎙️ **Voice Response Capture** — Listens and transcribes candidate answers in real time
- 📊 **AI-Generated Feedback & Ratings** — Evaluates responses and provides structured performance feedback
- 🗂️ **Interview History** — Dashboard to review past sessions and track progress over time
- 🔒 **Usage Limits (Free Tier)** — Rate-limited access with graceful error handling via ArcJet

---

## How It Works

```
User Login
  → Upload Resume or Enter Job Description
    → AI Parses Input & Generates Questions  (n8n + Gemini)
      → Avatar Video Plays — Asks Question
        → Video Pauses — Candidate Answers
          → Voice Captured & Transcribed
            → Avatar Resumes — Next Question
              → AI Analyzes All Responses
                → Feedback Report Generated & Saved
```

---

## Tech Stack

| Category             | Technology                     |
|----------------------|--------------------------------|
| Frontend             | Next.js, React, Tailwind CSS   |
| Backend              | Next.js API Routes             |
| Authentication       | Clerk                          |
| Database             | Convex                         |
| Workflow Automation  | n8n                            |
| AI Services          | Google Gemini API, OpenRouter  |
| AI Avatar            | D-ID                           |
| Security             | ArcJet                         |
| Testing              | ReqBin                         |
| Version Control      | Git, GitHub                    |
| Deployment           | Vercel                         |

---

## System Requirements

- **OS:** Windows, Linux, or macOS
- **Runtime:** Node.js (latest LTS)
- **Browser:** Google Chrome / Microsoft Edge (latest versions)
- **Internet:** Required for AI processing and workflow execution
- **Hosting:** Vercel or equivalent cloud platform

**Development Hardware:**
- Minimum 8 GB RAM, multi-core processor (Intel i5 / AMD Ryzen 5 or higher), SSD storage

---

## Avatar Implementation Note

> Real-time WebRTC-based streaming avatar was explored but could not be fully implemented due to browser WebRTC compatibility constraints. As a practical alternative, a **pre-generated AI avatar video** (via D-ID) is used. The video loops while the avatar asks a question, **pauses** when the candidate begins answering, and **resumes** for the next question — creating a natural interview flow without requiring a live stream.

---

## Future Work

- 😊 Emotion & facial expression analysis
- 🗣️ Advanced speech evaluation (tone, pace, clarity)
- 🌐 Multi-language support
- 📈 Adaptive difficulty levels based on performance
- 📊 Detailed performance analytics dashboard
- 📱 Mobile application support

---

## License

This project was developed as an academic mini project at Sabaragamuwa University of Sri Lanka, Faculty of Computing — Department of Software Engineering (SE5104). All rights reserved by the respective authors.