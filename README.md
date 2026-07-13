# Local Visibility Audit Engine

An AI-powered audit engine that scores a local business's online visibility —
Google Business Profile strength, citations, website technical health,
local SEO signals, and competitive positioning — and produces an LLM-written
streaming report explaining the findings in plain English.

Business data is normalized from Outscraper exports, run through a rules
engine covering GBP, citations, technical, trust, and local-relevance
categories, weighted by industry profile, then scored and summarized.

## Tech stack

- Node.js + TypeScript
- Express (API server, streaming responses)
- OpenRouter/OpenAI-compatible LLM for the written report
- Deploy target: Railway (see `railway.json`)

## Setup

```bash
npm install
cp .env.example .env   # fill in your API keys
npm run dev
```

## Scripts

- `npm run dev` — run the API server with live reload
- `npm run build` — compile TypeScript to `dist/`
- `npm start` — run the server directly with ts-node
- `npm run serve` — run the compiled build from `dist/`
