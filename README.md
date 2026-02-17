# MTRX Ops Dashboard

Real-time operations dashboard for MTRX Media, pulling live data from Notion.

## Sections
- **Overview** — Active deliverables, overdue count, form compliance, active editors
- **Pod Health** — 4 pods with active/overdue/editor counts and RAG status
- **Delayed People** — Team members sorted by overdue deliverable count
- **AI Branch** — AI deliverables, statuses, overdue, brands
- **Forms Breakdown** — 5 form databases, last 7 days, who submitted/missing
- **Team Accountability** — Lois Ops Task Tracker

## Setup

```bash
npm install
```

Create `.env.local`:
```
NOTION_API_KEY=your_notion_api_key
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Add `NOTION_API_KEY` as an environment variable
4. Deploy

## Tech Stack
- Next.js 14 (App Router)
- Tailwind CSS
- Notion API (@notionhq/client)
