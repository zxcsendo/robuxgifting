const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_AVATAR_PATH = path.join(__dirname, "public", "assets", "default-avatar.png");
const DEFAULT_AVATAR_BUF = fs.readFileSync(DEFAULT_AVATAR_PATH);
const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json"
};

const DEFAULT_FRIEND_NAMES = [
  "sainTpablo",
  "XeiDG",
  "chano",
  "flaminghotcheet0x",
  "Builderman",
  "Roblox",
  "Shedletsky",
  "Telamon",
  "Player1",
  "RobloFan",
  "asimo3089",
  "stickmasterluke",
  "Merely",
  "CloneTrooper1019",
  "ScriptGuider",
  "TheNexusAvenger",
  "MaximumADHD",
  "1waffle1",
  "berezaa",
  "Quenty",
  "EgoMoose",
  "ScriptOn",
  "Zeuxcg",
  "Seranok",
  "SphinxKnight",
  "ConvexRumbler"
];

const avatarCache = new Map(); // userId -> { url, at }
const avatarBinaryCache = new Map(); // userId -> { buf, contentType, at }

app.use(express.static(path.join(__dirname, "public")));

app.get("/transactions", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "transactions.html"));
});

app.get("/home", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

function formatPlayers(n) {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(v);
}

function likePercent(up, down) {
  const u = Number(up) || 0;
  const d = Number(down) || 0;
  const t = u + d;
  if (!t) return 0;
  return Math.round((u / t) * 100);
}

async function fetchGameIcons(universeIds) {
  const map = new Map();
  const ids = [...new Set(universeIds.map(String).filter(Boolean))];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url = new URL("https://thumbnails.roblox.com/v1/games/icons");
    url.searchParams.set("universeIds", chunk.join(","));
    url.searchParams.set("size", "512x512");
    url.searchParams.set("format", "Png");
    url.searchParams.set("isCircular", "false");
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) continue;
      const json = await res.json();
      for (const item of json.data || []) {
        if (item?.imageUrl) map.set(String(item.targetId), item.imageUrl);
      }
    } catch (_) {}
  }
  return map;
}

function mapExploreGames(games, iconMap, limit) {
  return (games || []).slice(0, limit).map(g => ({
    universeId: g.universeId,
    placeId: g.rootPlaceId,
    name: g.name,
    playerCount: g.playerCount || 0,
    players: formatPlayers(g.playerCount),
    likes: likePercent(g.totalUpVotes, g.totalDownVotes),
    icon: iconMap.get(String(g.universeId)) || null
  }));
}

app.get("/api/home/feed", async (_req, res) => {
  try {
    const [friendsRes, exploreRes] = await Promise.all([
      (async () => {
        const resolved = await resolveUsernames(DEFAULT_FRIEND_NAMES.slice(0, 8));
        const ids = resolved.map(u => u.id).filter(Boolean);
        const avatarMap = await fetchAvatars(ids);
        return resolved.map(u => ({
          id: u.id,
          name: u.name,
          displayName: u.displayName || u.name,
          avatar: avatarMap.get(String(u.id)) || localAvatar(u.id)
        }));
      })(),
      fetch("https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=home-concept&device=computer", {
        headers: UA
      }).then(r => (r.ok ? r.json() : { sorts: [] })).catch(() => ({ sorts: [] }))
    ]);

    const sorts = exploreRes.sorts || [];
    const trending = sorts.find(s => s.id === "Top_Trending_V6") || sorts.find(s => s.contentType === "Games");
    const playing = sorts.find(s => s.id === "CCU_Based_V1") || sorts.find(s => (s.games || []).length > 10);

    const recommendedRaw = (trending?.games || []).slice(0, 10);
    const continueRaw = (playing?.games || []).slice(0, 12);
    const allIds = [...recommendedRaw, ...continueRaw].map(g => g.universeId);
    const iconMap = await fetchGameIcons(allIds);

    res.json({
      friends: friendsRes,
      recommended: mapExploreGames(recommendedRaw, iconMap, 10),
      continuePlaying: mapExploreGames(continueRaw, iconMap, 12)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load home feed" });
  }
});

function localAvatar(userId) {
  return `/api/avatar/${userId}`;
}

async function resolveThumbnailUrl(userId, attempt = 0) {
  const cached = avatarCache.get(String(userId));
  if (cached && Date.now() - cached.at < 10 * 60 * 1000 && cached.url) {
    return cached.url;
  }

  const avatarUrl = new URL("https://thumbnails.roblox.com/v1/users/avatar-headshot");
  avatarUrl.searchParams.set("userIds", String(userId));
  avatarUrl.searchParams.set("size", "150x150");
  avatarUrl.searchParams.set("format", "Png");
  avatarUrl.searchParams.set("isCircular", "true");

  const res = await fetch(avatarUrl, { headers: UA });
  if (!res.ok) throw new Error("thumbnail request failed");
  const json = await res.json();
  const item = (json.data || [])[0];

  // Privacy / moderation blocked thumbnails never get a CDN URL
  if (item?.state === "Blocked" || item?.state === "Error") {
    throw new Error("avatar blocked");
  }

  if (item?.imageUrl) {
    avatarCache.set(String(userId), { url: item.imageUrl, at: Date.now() });
    return item.imageUrl;
  }

  // Pending — retry once, then try non-circular headshot
  if (attempt < 1 && (item?.state === "Pending" || !item?.imageUrl)) {
    await new Promise(r => setTimeout(r, 350));
    return resolveThumbnailUrl(userId, attempt + 1);
  }

  const alt = new URL("https://thumbnails.roblox.com/v1/users/avatar-headshot");
  alt.searchParams.set("userIds", String(userId));
  alt.searchParams.set("size", "150x150");
  alt.searchParams.set("format", "Png");
  alt.searchParams.set("isCircular", "false");
  const altRes = await fetch(alt, { headers: UA });
  if (altRes.ok) {
    const altJson = await altRes.json();
    const altItem = (altJson.data || [])[0];
    if (altItem?.imageUrl) {
      avatarCache.set(String(userId), { url: altItem.imageUrl, at: Date.now() });
      return altItem.imageUrl;
    }
  }

  // Final fallback: avatar bust thumbnail
  const bust = new URL("https://thumbnails.roblox.com/v1/users/avatar-bust");
  bust.searchParams.set("userIds", String(userId));
  bust.searchParams.set("size", "150x150");
  bust.searchParams.set("format", "Png");
  const bustRes = await fetch(bust, { headers: UA });
  if (bustRes.ok) {
    const bustJson = await bustRes.json();
    const bustItem = (bustJson.data || [])[0];
    if (bustItem?.imageUrl) {
      avatarCache.set(String(userId), { url: bustItem.imageUrl, at: Date.now() });
      return bustItem.imageUrl;
    }
  }

  throw new Error("no avatar url");
}

async function fetchAvatars(ids) {
  if (!ids.length) return new Map();
  const unique = [...new Set(ids.map(String))];
  const map = new Map();

  // Batch primary request
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const avatarUrl = new URL("https://thumbnails.roblox.com/v1/users/avatar-headshot");
    avatarUrl.searchParams.set("userIds", chunk.join(","));
    avatarUrl.searchParams.set("size", "150x150");
    avatarUrl.searchParams.set("format", "Png");
    avatarUrl.searchParams.set("isCircular", "true");

    try {
      const avatarResponse = await fetch(avatarUrl, { headers: UA });
      if (avatarResponse.ok) {
        const avatarJson = await avatarResponse.json();
        for (const item of avatarJson.data || []) {
          const id = String(item.targetId);
          if (item.imageUrl) {
            avatarCache.set(id, { url: item.imageUrl, at: Date.now() });
            map.set(id, localAvatar(id));
          }
        }
      }
    } catch (_) {
      // continue — fill missing below
    }
  }

  // Ensure every id has a local proxy avatar URL (proxy resolves real CDN)
  for (const id of unique) {
    if (!map.has(id)) map.set(id, localAvatar(id));
  }
  return map;
}

async function resolveUsernames(usernames) {
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { ...UA, "Content-Type": "application/json" },
    body: JSON.stringify({ usernames, excludeBannedUsers: true })
  });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

// Reliable avatar proxy — every user image goes through here
app.get("/api/avatar/:userId", async (req, res) => {
  const userId = String(req.params.userId || "").replace(/[^\d]/g, "");
  if (!userId) return res.status(400).end();

  const sendDefault = () => {
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(DEFAULT_AVATAR_BUF);
  };

  const cachedBin = avatarBinaryCache.get(userId);
  if (cachedBin && Date.now() - cachedBin.at < 60 * 60 * 1000) {
    res.setHeader("Content-Type", cachedBin.contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(cachedBin.buf);
  }

  try {
    const imageUrl = await resolveThumbnailUrl(userId);
    const imgRes = await fetch(imageUrl, {
      headers: {
        "User-Agent": UA["User-Agent"],
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
      }
    });
    if (!imgRes.ok) throw new Error("image fetch failed");

    const contentType = imgRes.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (!buf.length) throw new Error("empty image");

    avatarBinaryCache.set(userId, { buf, contentType, at: Date.now() });
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(buf);
  } catch (err) {
    // Blocked / missing Roblox thumbnails → default avatar (never broken img)
    sendDefault();
  }
});

app.get("/api/friends/default", async (_req, res) => {
  try {
    const resolved = await resolveUsernames(DEFAULT_FRIEND_NAMES);
    const ids = resolved.map(u => u.id).filter(Boolean);
    const avatarMap = await fetchAvatars(ids);

    const users = resolved.map((u, index) => ({
      id: u.id,
      name: u.name,
      displayName: u.displayName || u.name,
      avatar: avatarMap.get(String(u.id)) || localAvatar(u.id),
      plus: index === 1 || index === 5 || index === 11
    }));

    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load default friends" });
  }
});

app.get("/api/user/:username", async (req, res) => {
  const username = String(req.params.username || "").trim();
  if (!username || username.length > 40) {
    return res.status(400).json({ error: "Invalid username" });
  }

  try {
    const resolved = await resolveUsernames([username]);
    const user = resolved[0];
    if (!user?.id) return res.status(404).json({ error: "User not found" });

    res.json({
      id: user.id,
      name: user.name,
      displayName: user.displayName || user.name,
      avatar: localAvatar(user.id)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not resolve user" });
  }
});

app.get("/api/users/search", async (req, res) => {
  const keyword = String(req.query.keyword || "").trim();
  if (keyword.length < 2) return res.json({ users: [] });

  try {
    let exact = [];
    try {
      exact = await resolveUsernames([keyword]);
    } catch (_) {
      exact = [];
    }

    let searched = [];
    try {
      const searchUrl = new URL("https://users.roblox.com/v1/users/search");
      searchUrl.searchParams.set("keyword", keyword);
      searchUrl.searchParams.set("limit", "25");
      const userResponse = await fetch(searchUrl, { headers: UA });
      if (userResponse.ok) {
        const userJson = await userResponse.json();
        searched = Array.isArray(userJson.data) ? userJson.data : [];
      }
    } catch (_) {
      searched = [];
    }

    const byId = new Map();
    for (const u of [...exact, ...searched]) {
      if (!u || !u.id) continue;
      if (!byId.has(String(u.id))) byId.set(String(u.id), u);
    }
    const users = [...byId.values()];
    if (!users.length) return res.json({ users: [] });

    const ids = users.map(u => u.id).filter(Boolean);
    const avatarMap = await fetchAvatars(ids);

    const normalized = users.map(u => ({
      id: u.id,
      name: u.name,
      displayName: u.displayName || u.name,
      avatar: avatarMap.get(String(u.id)) || localAvatar(u.id),
      plus: false
    }));

    res.json({ users: normalized });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search service error" });
  }
});

// Local: `node server.js` / Vercel: imports this module as a serverless handler
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`RBLX gifting concept running on http://localhost:${PORT}`);
  });
}
