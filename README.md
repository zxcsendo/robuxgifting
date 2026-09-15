# RBLX Gifting Concept v2

A UI concept based on the provided screenshot, with a fixed-size Send Robux modal and real public Roblox user/avatar search.

## What changed
- Fixed Send Robux modal size so the bottom doesn't collapse when results are short.
- Removed repeated "demo user/profile" labels from the user rows.
- Added live global user search using Roblox's public user search endpoint.
- Added real avatar headshots using Roblox's public thumbnail endpoint.
- Clicking any Limited-time bonus package now opens the Send Robux recipient modal.
- Clicking the top Send button also opens the same recipient modal.
- Package amount is carried into the next gifting step.
- Display balance is 40,000,000.

## Transparency / safety
The app keeps a small "CONCEPT UI · NOT ROBLOX" badge. It does not implement Roblox authentication, payments, or real Robux transfers.

## Run
1. Install Node.js 18 or newer.
2. Open this folder in a terminal.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

## Public Roblox APIs used
- User search: `users.roblox.com/v1/users/search`
- Avatar headshot: `thumbnails.roblox.com/v1/users/avatar-headshot`

No Roblox password, cookie, or API key is required by this project.
