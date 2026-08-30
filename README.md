# Staffora Bot

Full Discord staff system (Tickets, Büros, Admin Calls, XP, Clock, Häuser, Fraktion, …).

## New modules (additive)
- **Dienstnummern** – `/dienstnummer zeigen|bewerben|anfragen` + Dashboard tab
- **Ausweise** – `/ausweis zeigen|panel` + Dashboard tab

## Dashboard
Served by the bot:
`https://staffora.apps.bot-hosting.cloud/dashboard`

OAuth callback:
`https://staffora.apps.bot-hosting.cloud/auth/callback`

## Deploy
1. Upload the zip to bot-hosting
2. npm install (prisma generate)
3. Start the bot

## Enable new modules
Dashboard → **Dienstnummern** / **Ausweise** → Aktiv einschalten.
