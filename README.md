# Winner Bingo — Web App (`bingo-webapp-next`)

Next.js 15 player app: phone login, bingo games, wallet, profile, leaderboard.

## Quick start

```bash
npm install
# Ensure BACKEND_URL / NEXT_PUBLIC_API_URL point at the API (default localhost:3001)
npm run dev
```

Open `http://localhost:3000`.

Backend must be running (`bingo-tg-bot` on port `3001`).

## Environment

```env
BACKEND_URL=https://real-bingoweb-backend.onrender.com
NEXT_PUBLIC_API_URL=https://real-bingoweb-backend.onrender.com
```

**Auth:** Login = phone + password. Signup = phone → OTP → set password.

OTP in local dev: check the **backend console** for `[auth] OTP issued...` when `SMS_PROVIDER=console`.

## How the app talks to the API

- Browser calls **same-origin** `/api/...` (cookies stay on `:3000`).
- Next route handlers proxy to Express (`src/app/api/auth/[...all]`, `src/app/api/[...path]`).
- Socket.IO connects to the backend URL for live games.

## Main routes

| Path | Screen |
|------|--------|
| `/login` | Login (phone + password) / Signup (OTP then password) |
| `/` | Play / rooms |
| `/cards` | Pick cartela |
| `/game` | Live bingo |
| `/wallet` | Deposit / withdraw |
| `/profile` | Name, stats, history |
| `/leaderboard` | Rankings |

## Onboarding

1. First verify → **+10 ETB** welcome bonus (once per phone).
2. Celebration modal, then **required display name**.
3. Wallet balance comes from `GET /api/me` (server repairs bonus if needed).

## Scripts

```bash
npm run dev
npm run build
npm start
```
