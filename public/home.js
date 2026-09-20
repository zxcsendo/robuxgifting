const $ = id => document.getElementById(id);
const fmt = value => Number(value).toLocaleString("en-US");
const DEFAULT_AVATAR = "/assets/default-avatar.png";
const ME_USERNAME = "o_ren8";

let balance = RblxWallet.loadBalance();

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function syncBalance(){
  if ($("topBalance")) $("topBalance").textContent = fmt(balance);
}

function setProfileAvatars(src){
  const url = src || DEFAULT_AVATAR;
  for (const el of [$("headerAvatar"), $("sideAvatar")]) {
    if (!el) continue;
    el.onerror = () => { el.onerror = null; el.src = DEFAULT_AVATAR; };
    el.src = url;
  }
}

async function loadMeAvatar(){
  try {
    const res = await fetch(`/api/user/${encodeURIComponent(ME_USERNAME)}`);
    if (!res.ok) throw new Error("profile failed");
    const data = await res.json();
    setProfileAvatars(data.avatar || `/api/avatar/${data.id}`);
  } catch (_) {
    setProfileAvatars(DEFAULT_AVATAR);
  }
}

const ICO_LIKE = `<svg class="stat-ico" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8.2 13.6 3.4 8.7A2.7 2.7 0 0 1 7.3 5l.9 1 .9-1a2.7 2.7 0 0 1 3.9 3.7l-4.8 4.9Z"/></svg>`;
const ICO_USERS = `<svg class="stat-ico" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 8a2.6 2.6 0 1 0 0-5.2A2.6 2.6 0 0 0 8 8Zm-4.8 6.2c.4-2.2 2.1-3.4 4.8-3.4s4.4 1.2 4.8 3.4H3.2Z"/></svg>`;

function friendCard(u){
  const name = u.displayName || u.name;
  const src = u.avatar || `/api/avatar/${u.id}`;
  return `
    <a class="friend-card" href="#" title="${escapeHtml(name)}">
      <img class="friend-avatar" src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async"
        onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}'" />
      <span class="friend-name">${escapeHtml(name)}</span>
    </a>
  `;
}

function gameCard(g, { compact = false } = {}){
  const icon = g.icon
    ? `<img src="${escapeHtml(g.icon)}" alt="" loading="lazy" decoding="async" />`
    : `<div class="game-thumb-fallback"></div>`;
  if (compact) {
    return `
      <a class="continue-card" href="https://www.roblox.com/games/${escapeHtml(g.placeId)}" target="_blank" rel="noopener">
        <div class="continue-thumb">${icon}</div>
        <b class="game-title">${escapeHtml(g.name)}</b>
      </a>
    `;
  }
  return `
    <a class="game-card" href="https://www.roblox.com/games/${escapeHtml(g.placeId)}" target="_blank" rel="noopener">
      <div class="game-thumb">${icon}</div>
      <b class="game-title">${escapeHtml(g.name)}</b>
      <div class="game-stats">
        <span>${ICO_LIKE} ${escapeHtml(g.likes)}%</span>
        <span>${ICO_USERS} ${escapeHtml(g.players)}</span>
      </div>
    </a>
  `;
}

function renderFeed(data){
  const friends = data.friends || [];
  $("friendsHeading").textContent = `Friends (${friends.length})`;
  $("friendsRow").innerHTML = `
    <button type="button" class="friend-card add-friend" aria-label="Add Friends">
      <span class="add-friend-circle">+</span>
      <span class="friend-name">Add Friends</span>
    </button>
    ${friends.map(friendCard).join("")}
  `;

  const recommended = data.recommended || [];
  $("recommendedGrid").innerHTML = recommended.length
    ? recommended.map(g => gameCard(g)).join("")
    : `<p class="home-empty">Could not load recommended experiences right now.</p>`;

  const cont = data.continuePlaying || [];
  $("continueRow").innerHTML = cont.length
    ? cont.map(g => gameCard(g, { compact: true })).join("")
    : `<p class="home-empty">No continue list available.</p>`;
}

async function loadFeed(){
  try {
    const res = await fetch("/api/home/feed");
    if (!res.ok) throw new Error("feed failed");
    renderFeed(await res.json());
  } catch (_) {
    $("friendsRow").innerHTML = `<p class="home-empty">Could not load friends.</p>`;
    $("recommendedGrid").innerHTML = `<p class="home-empty">Could not load recommended experiences.</p>`;
  }
}

syncBalance();
RblxWallet.bindRobuxMenu();
loadMeAvatar();
loadFeed();

RblxWallet.subscribe(payload => {
  if (payload.balance == null) return;
  balance = payload.balance;
  syncBalance();
});
