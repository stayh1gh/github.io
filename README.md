# Bruno Paradas — Portfolio

A portfolio site based on the Figma "Portfolio" design: static HTML/CSS/JS plus
one serverless function (`api/chat.js`) that powers the AI "chat with Bruno"
feature. For the static pages only, `python3 serve.py` still works; to run the
chat locally use `vercel dev` (see below).

## Structure

- `index.html` — main page: navbar, chat hero ("Talk to me" / "See my work"), **work** strip, **career**, **other works**, footer
- `chat.html` — AI chat page (conversation with an AI version of Bruno)
- `project.html` — project detail page (driven by the `?project=` URL param)
- `js/data.js` — **edit this file to add your projects, images, career, and social links**
- `js/chat.js` — chat logic shared by the hero input and the chat page
- `api/chat.js` — Vercel serverless function calling the Claude API
- `content/knowledge.md` — **edit this file to teach the AI about you** (it answers only from here)
- `css/style.css` — main styles (design tokens from Figma at the top)
- `css/chat.css` — chat hero + chat page styles
- `images/` — put your project images here (`images/logos/` holds career logos)

## AI chat

The chat is a small serverless function on Vercel that sends the conversation to
the Claude API (`claude-haiku-4-5`) with `content/knowledge.md` as its only
knowledge source (cached via `cache_control` to keep costs low). When a visitor
asks to schedule a call, the reply triggers an inline Calendly widget
(`https://calendly.com/bruno-paradas/30min`).

Running locally:

```sh
npm install
vercel dev            # serves the static site + /api/chat on localhost:3000
```

Requirements:

- `ANTHROPIC_API_KEY` set as an environment variable — locally via
  `vercel env pull` or an `.env.local` file, in production as a Vercel project
  environment variable. Create a key at https://console.anthropic.com and set a
  spend limit (actual usage for a portfolio's traffic is a few dollars/month at
  most, thanks to prompt caching).
- Deploys on **Vercel** (GitHub Pages can't run the function). The
  `vercel.json` config bundles `content/knowledge.md` with the function.

To change what the AI knows, just edit `content/knowledge.md` and redeploy.

## Adding your images

1. Drop the image file into `images/`
2. In `js/data.js`, set the project's `image` field (the card in the work strip), e.g.:

   ```js
   image: "images/my-project.jpg",
   ```

   For detail pages, fill the `detailImages` array — 7 slots laid out as:
   full-width, two halves, three thirds, full-width. The `OTHER_WORKS` array
   uses the same pattern. Any field left as `null` shows a placeholder.

## Other things to customize in `js/data.js`

- Hover card info: each project's `title`, `description`, `year`, and `tag`
- Detail page: `intro`, `body`, `disciplines`
- `CAREER` — the job history list
- `SOCIAL_LINKS` — LinkedIn / Read.cv / Behance URLs (currently `#` placeholders)

## Contact

The "Contact me" buttons open an email to `bruno.paradas1@gmail.com`
(set in the `mailto:` links in `index.html` / `project.html`).
