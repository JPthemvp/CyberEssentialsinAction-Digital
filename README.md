# Cyber Essentials in Action — Digital 🛡️

A Kahoot-style multiplayer cybersecurity awareness game for CSA Singapore Cyber Health Clinics.

## Game Modes

### ⚡ Cyber Attack (Quick-Fire)
24 MCQ questions · 1-min timer · Speed scoring (up to 1,500 pts/question)

### 🎭 Cyber Quest (Scenario Role-Play)
9 real-world scenarios · Facilitator picks which to run · 3-min timer · Role-based discussion

**Scenarios:** Ransomware · Social Engineering · Deepfake · Supply Chain Attack · Cloud Misconfiguration · Shadow AI · AI & Data Leakage · AI Manipulation · Access Keys for Cloud AI

## Setup

### 1. Supabase
Run `supabase/game_schema.sql` in your Supabase SQL Editor.

### 2. Environment Variables
Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Run locally
```bash
npm install
npm run dev
```
Open [http://localhost:3000/game](http://localhost:3000/game)

### 4. Deploy to Vercel
Add the two env vars in Vercel → Settings → Environment Variables, then deploy.

## How to Run a Session

**Facilitator:** Go to `/game` → Host Game → select sector/clinic → share room code  
**Players:** Go to `/game` → Join Game → enter name + room code

## Sectors Supported
MinLaw Clinic · HIA Clinic · Finance · Retail & F&B · Tech · Education · General Business
