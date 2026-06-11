# AI SignBridge – Real-Time Sign Language Translator

AI SignBridge is a highly responsive full-stack, AI-powered Sign Language Translation Platform that uses high-performance computer vision, in-browser machine learning landmarks tracking, and the Google Gemini API to translate hand gesture sequences into natural, polite text and audible speech in real time.

---

## Key Features

1. **Real-Time Hand Tracking & Overlay**:
   * Leverages official Google MediaPipe Hands and Camera CDNs to track all 21 hand joints.
   * Renders a glowing, cyber-inspired interactive vector mesh mapped over the live webcam canvas feed.

2. **Dual-Layer Gesture Recognition Engine**:
   * **Mathematical Heuristics**: Deterministically matches joint bends and extension vectors for standard alphabets (`A`, `B`, `C`, `D`, `E`, `F`, `K`, `L`, `U`, `V`, `W`, `Y`) and numbers (`0–9`).
   * **K-Nearest Neighbors (KNN) Vector Classifier**: Enables users to capture custom landmark structures, saving the normalized 3D vectors to train personalized gestures in real-time.

3. **Smart AI Translation & Context Correction**:
   * Connects to a secure full-stack Node/Express backend that proxies requests to `gemini-3.5-flash`.
   * Reconstructs fragmented, raw sign keyframes into grammatically perfect, natural sentences.
   * Accounts for conversational context labels (e.g., Casual, Hospital, Emergency Desk).

4. **Kinetics-Based Emotion Analyzer**:
   * Measures the 3D velocity vectors of the hand wrist to classify the emotional tone (e.g., excited, expressive, calm, apprehensive, distressed) accompanying the sign.

5. **Integrated Emergency Safety Beacon**:
   * Triggers an emergency "SOS" overlay if a help sign is held for more than 1.5 seconds.
   * Sounds a high-pitched synthetic alarm using the browser’s Web Audio API.
   * Dynamically tracks GPS coordinates via the HTML5 Geolocation API, preparing coordinates for safety alerts.

6. **Accessibility Options**:
   * **Large Text Mode**: Fluidly magnifies margins, paddings, and font sizes across dashboards.
   * **Text-To-Speech (TTS) Vocalizer**: Reads corrected sentences out loud in targeted languages and custom speeds (0.8x, 1.0x, 1.3x).
   * **Multilingual Translation**: Supports conversion and correction into English, Hindi, Bengali, and Marathi scripts.

---

## Tech Stack & Architecture

* **Frontend**: React 19, TypeScript, Tailwind CSS, Recharts (visual telemetry charts), Lucide-React.
* **Backend**: Node.js, Express, tsx (for TS dev execution), esbuild (for production-ready server bundling).
* **AI/ML**: MediaPipe Hands, HTML5 Camera API, K-Nearest Neighbors Euclidean classification, Cosine Similarity calculations, Google Gemini API (`@google/genai` on server).

---

## Machine Learning & Normalization Math

To keep gesture recognition invariant to hand size, position, or camera distance, we normalize raw MediaPipe landmarks:

1. **Translation**: Shift the wrist joint (landmark 0) to coordinate `(0,0,0)`.
   $$P_{\text{translated}}[i] = P_{\text{raw}}[i] - P_{\text{raw}}[0]$$
2. **Scaling**: Compute the 3D scale index using the distance from the wrist to the middle finger MCP knuckle (landmark 9).
   $$\text{Scale} = \text{Distance}(P_{\text{translated}}[9], \{0,0,0\})$$
3. **Normalization**: Divide coordinates by the scale value.
   $$P_{\text{normalized}}[i] = \frac{P_{\text{translated}}[i]}{\text{Scale}}$$

This normalized $21 \times 3$ coordinate vector is used by our KNN algorithm to compute cosine distances against saved gesture templates to calculate precise matching confidence scores.

---

## Installation & Setup Guide

### 1. Prerequisites
Ensure you have Node.js (v18+) and npm installed.

### 2. Configure Credentials
Add a `.env` file or export your Gemini API key:
```env
GEMINI_API_KEY="YOUR_ACTUAL_GEMINI_SECRET_KEY"
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Development Server
Executes the Express backend with joint Vite dev injection on Port 3000:
```bash
npm run dev
```

### 5. Production Compilation
Bundles the React client application and compiles the Express backend TypeScript file into a single optimized `"dist/server.cjs"` file with sourcemaps:
```bash
npm run build
npm start
```

---

## Docker & Container Deployment Guide

To deploy AI SignBridge inside high-performance, stateless server environments like Cloud Run, use the following configurations:

### 1. Dockerfile
Create a `Dockerfile` in the root:
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

### 2. Formulate Image & Run Container
```bash
docker build -t ai-signbridge .
docker run -p 3000:3000 --env GEMINI_API_KEY="YOUR_API_KEY" ai-signbridge
```
