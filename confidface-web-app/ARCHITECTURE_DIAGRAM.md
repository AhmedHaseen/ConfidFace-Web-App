# D-ID Streaming Avatar - Architecture Diagram

## Before (Unnecessary Components)

```
❌ REMOVED ENDPOINTS:
├── /api/d-id-ice         → Handled ICE for old interview flow
├── /api/d-id-sdp         → Handled SDP for old interview flow  
├── /api/d-id-session     → Created sessions (still exists for interview flow)
└── /api/d-id-knowledge-base → Prepared knowledge base (unused)
```

## After (Streamlined Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                         │
│  CreateInterviewDialog: Resume + Job Description            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│        UNIFIED ENDPOINT                                     │
│  POST /api/generate-interview-questions-with-avatar         │
├─────────────────────────────────────────────────────────────┤
│  1. Upload Resume (ImageKit)                               │
│  2. Generate Questions (Gemini Webhook)                    │
│  3. Create Avatar Stream (D-ID API)                        │
│  4. Return Questions + Avatar Data                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
         ▼                                   ▼
    ┌─────────────┐               ┌──────────────────┐
    │  Questions  │               │  Avatar Stream   │
    │  Array      │               │  Data            │
    │             │               │  {streamId, ..}  │
    │  Saved to   │               │                  │
    │  Database   │               │  WebRTC Setup    │
    └─────────────┘               └────────┬─────────┘
                                           │
                                           ▼
                              ┌────────────────────────┐
                              │  D_IDStreamingAvatar   │
                              │  Component             │
                              ├────────────────────────┤
                              │ Creates RTCPeerConn    │
                              │ Handles ICE Candidates │
                              │ Sends SDP Answer       │
                              │ Displays Video/Audio   │
                              └────────────┬───────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
        ┌────────────────────┐  ┌─────────────────┐  ┌──────────────────┐
        │ /api/d-id-stream   │  │ /api/d-id-stream│  │ /api/d-id-stream │
        │ (POST-ICE)         │  │ -ice (POST)     │  │ -sdp (POST)      │
        │                    │  │                 │  │                  │
        │ Creates Stream     │  │ Sends ICE       │  │ Sends Answer     │
        │ Returns Offer      │  │ Candidates      │  │ Finalizes RTC    │
        └────────────────────┘  └─────────────────┘  └──────────────────┘
                                           │
                                           ▼
                              ┌────────────────────────┐
                              │   D-ID API (Cloud)     │
                              ├────────────────────────┤
                              │ • Avatar Video/Audio   │
                              │ • WebRTC Streaming     │
                              │ • Professional Voice   │
                              │ • Real-time Response   │
                              └────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: USER SUBMITS FORM                                  │
├─────────────────────────────────────────────────────────────┤
│  Input: Resume (PDF), Job Title, Job Description            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: GENERATE INTERVIEW QUESTIONS                       │
├─────────────────────────────────────────────────────────────┤
│  • Upload Resume to ImageKit                                │
│  • Call Gemini Webhook                                      │
│  • Parse Questions from Response                            │
│  Output: Array of {question, answer}                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: CREATE AVATAR STREAM                               │
├─────────────────────────────────────────────────────────────┤
│  Script: "Welcome to interview preparation..."              │
│  • Call D-ID Talks API                                      │
│  • Generate WebRTC Offer                                    │
│  Output: {streamId, offer, ice_servers, session_id}         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: SAVE INTERVIEW & RETURN DATA                       │
├─────────────────────────────────────────────────────────────┤
│  • Save questions to Convex database                        │
│  • Return both questions and avatar data                    │
│  Response: {questions[], avatar{...}}                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: FRONTEND RENDERS AVATAR                            │
├─────────────────────────────────────────────────────────────┤
│  • Show avatar component                                    │
│  • Initialize WebRTC peer connection                        │
│  • Set remote description (offer)                           │
│  • Add transceivers (audio/video)                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 6: EXCHANGE ICE CANDIDATES                            │
├─────────────────────────────────────────────────────────────┤
│  • Browser generates ICE candidates                         │
│  • POST to /api/d-id-stream-ice                             │
│  • D-ID processes and connects                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 7: SEND SDP ANSWER                                    │
├─────────────────────────────────────────────────────────────┤
│  • Browser creates answer                                   │
│  • POST to /api/d-id-stream-sdp                             │
│  • WebRTC connection established                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 8: RECEIVE AVATAR STREAM                              │
├─────────────────────────────────────────────────────────────┤
│  • ontrack event fired                                      │
│  • Video: rendered in <video> element                       │
│  • Audio: played through <audio> element                    │
│  Avatar speaks greeting message while user watches          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 9: REDIRECT TO INTERVIEW                              │
├─────────────────────────────────────────────────────────────┤
│  • 3-second delay (let avatar finish speaking)              │
│  • Redirect to /interview/[interviewId]                     │
│  • Start actual interview session                           │
└─────────────────────────────────────────────────────────────┘
```

## Component Interaction Diagram

```
                    CreateInterviewDialog
                    ├── State: loading, showAvatar, avatarData
                    ├── onSubmit()
                    │   └─► axios.post(/api/generate-interview-questions-with-avatar)
                    │       └─► setShowAvatar(true)
                    │       └─► setAvatarData(response.avatar)
                    │       └─► saveInterviewQuestion()
                    │       └─► setTimeout(router.push(), 3000)
                    │
                    └─► Conditional Render
                        ├── if (showAvatar && avatarData)
                        │   └── <D_IDStreamingAvatar
                        │       ├── streamId
                        │       ├── offer
                        │       ├── iceServers
                        │       ├── sessionId
                        │       ├── onStreamReady
                        │       └── onError
                        │       └── WebRTC initialization
                        │           ├── new RTCPeerConnection()
                        │           ├── addTransceiver(video, recvonly)
                        │           ├── addTransceiver(audio, recvonly)
                        │           ├── setRemoteDescription(offer)
                        │           ├── createAnswer()
                        │           ├── setLocalDescription(answer)
                        │           ├── ontrack → attach to <video>/<audio>
                        │           ├── onicecandidate → POST /api/d-id-stream-ice
                        │           └── POST /api/d-id-stream-sdp
                        │
                        └── else
                            └── <Tabs>
                                ├── Resume Upload
                                └── Job Description
```

## WebRTC Connection Sequence

```
Browser                          D-ID Server
  │                                  │
  │  1. POST /api/d-id-stream        │
  ├─────────────────────────────────►│
  │                                  │
  │◄─────── Response: Offer ─────────│
  │  {streamId, offer, ...}          │
  │                                  │
  │  2. Set Remote Description       │
  │     (offer)                      │
  │                                  │
  │  3. Create Answer                │
  │  4. Set Local Description        │
  │                                  │
  │  5. ICE Candidate Generated      │
  ├─ POST /api/d-id-stream-ice ─────►│
  │  {streamId, sessionId, cand...}  │
  │                                  │
  │  6. Send SDP Answer              │
  ├─ POST /api/d-id-stream-sdp ─────►│
  │  {streamId, sessionId, answer}   │
  │                                  │
  │◄────── Media Tracks Arrive ──────│
  │  ontrack: video                  │
  │  ontrack: audio                  │
  │                                  │
  │  7. Render Video/Play Audio      │
  │     in UI                        │
  │                                  │
  │  8. Avatar Speaks Greeting       │
  │     (via audio stream)           │
  │                                  │
```

## File Structure

```
confidface-web-app/
├── app/
│   └── api/
│       ├── d-id-session/
│       │   └── route.ts              ← Existing (for interview sessions)
│       ├── d-id-stream/
│       │   └── route.ts              ✨ NEW - Create avatar streams
│       ├── d-id-stream-ice/
│       │   └── route.ts              ✨ NEW - Handle ICE candidates
│       ├── d-id-stream-sdp/
│       │   └── route.ts              ✨ NEW - Handle SDP answers
│       ├── generate-interview-questions/
│       │   └── route.ts              ← Existing (original endpoint)
│       ├── generate-interview-questions-with-avatar/
│       │   └── route.ts              ✨ NEW - Combined endpoint
│       └── ... (other routes)
├── (routes)/
│   ├── _components/
│   │   └── CreateInterviewDialog.tsx ✏️ UPDATED - Uses new endpoint
│   └── ... (other routes)
├── components/
│   ├── D_IDStreamingAvatar.tsx       ✨ NEW - Avatar display component
│   └── ... (other components)
└── ... (other files)

Legend:
✨ NEW   = Created
✏️ UPDATED = Modified
❌ DELETED = Removed
← Existing = Unchanged
```

---

**Key Improvements**:
1. ✅ Cleaner API surface (removed ice, sdp, knowledge-base)
2. ✅ Unified question generation + avatar streaming
3. ✅ Professional avatar greeting in dialog
4. ✅ Reusable avatar component
5. ✅ Better separation of concerns
