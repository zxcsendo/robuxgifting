const packages = [
  { amount: 24100, old: 22500, bonus: 1600, price: "₱13.6K" },
  { amount: 11100, old: 10000, bonus: 1100, price: "₱6,800.00", selected: true, forYou: true },
  { amount: 5350, old: 4500, bonus: 850, price: "₱3,400.00" },
  { amount: 3725, old: 3150, bonus: 575, price: "₱1,990.00" },
  { amount: 2100, old: 1700, bonus: 400, price: "₱1,360.00" },
  { amount: 1600, old: 1200, bonus: 400, price: "₱799.00" },
  { amount: 1100, old: 800, bonus: 300, price: "₱680.00" },
  { amount: 600, old: 400, bonus: 200, price: "₱350.00" }
];

const SEND_PRESETS = [50, 300, 500, 1000];
const PAYMENT_METHODS = [
  { id: "gcash", label: "GCash", logos: ["/assets/pay/gcash.png"], enabled: false },
  { id: "card", label: "Credit / Debit Card", logos: ["/assets/pay/visa.png", "/assets/pay/discover.png"], enabled: false },
  { id: "grabpay", label: "GrabPay", logos: ["/assets/pay/grabpay.png"], enabled: false },
  { id: "paypal", label: "PayPal", logos: ["/assets/pay/paypal.png"], enabled: true, account: "rhiv******@gmail.com" },
  { id: "redeem", label: "Redeem Roblox Card", logos: ["/assets/pay/roblox-card.png"], enabled: false },
  { id: "other", label: "Other", logos: ["/assets/pay/other-card.png"], enabled: false }
];

let balance = RblxWallet.loadBalance();
let pendingPackage = null;
let selectedUser = null;
let sendAmount = 0;
let searchTimer = null;
let searchToken = 0;
let searchAbort = null;
let loadingTimer = null;
let defaultFriends = [];
let successMode = "send"; // "send" | "buy"
let packagesBound = false;

const $ = id => document.getElementById(id);
const fmt = value => Number(value).toLocaleString("en-US");
const DEFAULT_AVATAR = "/assets/default-avatar.png";

function avatarImg(src, attrs = ""){
  const safe = escapeHtml(src || DEFAULT_AVATAR);
  return `<img src="${safe}" alt="" ${attrs} onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}'">`;
}

function syncBalance(){
  balance = RblxWallet.saveBalance(balance);
  const text = fmt(balance);
  if ($("topBalance")) $("topBalance").textContent = text;
  if ($("heroBalance")) $("heroBalance").textContent = text;
  if ($("modalBalance")) $("modalBalance").textContent = text;
  if ($("amountModalBalance")) $("amountModalBalance").textContent = text;
  if ($("confirmModalBalance")) $("confirmModalBalance").textContent = text;
  if ($("successModalBalance")) $("successModalBalance").textContent = text;
}

function robuxIcon(size = 20){
  return `<img class="rbx-icon" src="/assets/robux.svg" alt="" style="width:${size}px;height:${size}px">`;
}

function plusIcon(size = 14){
  return `<img src="/assets/roblox-plus.svg" alt="" style="width:${size}px;height:${size}px">`;
}

function tagIcon(size = 12){
  return `<svg class="tag-ico" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.35"/></svg>`;
}

function forYouIcon(size = 12){
  return `<svg class="foryou-ico" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m12 7.2 1.2 3.5H17l-2.8 2.1 1.1 3.5L12 14.4l-3.3 1.9 1.1-3.5L7 10.7h3.8L12 7.2z"/></svg>`;
}

/* Static meta icons — built once, reused (no emoji / no per-open rebuild) */
const ICO_CALENDAR = `<svg class="meta-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.75" y="3.25" width="12.5" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.35"/><path d="M5 2.2v2.3M11 2.2v2.3M1.75 6.6h12.5" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/><circle cx="5" cy="9.2" r=".85" fill="currentColor"/><circle cx="8" cy="9.2" r=".85" fill="currentColor"/><circle cx="11" cy="9.2" r=".85" fill="currentColor"/><circle cx="5" cy="12" r=".85" fill="currentColor"/><circle cx="8" cy="12" r=".85" fill="currentColor"/><circle cx="11" cy="12" r=".85" fill="currentColor"/></svg>`;
const ICO_MUTUAL = `<svg class="meta-ico meta-ico-mutual" viewBox="0 0 20 16" aria-hidden="true"><circle cx="13.2" cy="4.2" r="2.85" fill="currentColor"/><path d="M8.4 14.8c.3-3.1 2.4-5.1 4.9-5.1s4.6 2 4.9 5.1" fill="currentColor"/><rect x="2.4" y="1.35" width="5.7" height="5.7" rx="1.15" fill="currentColor"/><path d="M.8 14.8c.3-3.1 2.3-5.1 4.7-5.1s4.4 2 4.7 5.1" fill="currentColor"/></svg>`;
const ICO_INFO = `<svg class="meta-ico meta-ico-info" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#d7dade"/><circle cx="8" cy="5.1" r="1.05" fill="#393b3d"/><rect x="7.15" y="7.15" width="1.7" height="5.1" rx=".85" fill="#393b3d"/></svg>`;

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function withRealAvatars(users){
  return (users || [])
    .filter(u => u && u.id)
    .map(u => ({
      ...u,
      avatar: u.avatar && String(u.avatar).startsWith("/api/avatar/")
        ? u.avatar
        : `/api/avatar/${u.id}`
    }));
}

function userAvatarSrc(u){
  return u.avatar && String(u.avatar).startsWith("/api/avatar/")
    ? u.avatar
    : `/api/avatar/${u.id}`;
}

function userRowHtml(u, { showUsername = false } = {}){
  const avatarSrc = `/api/avatar/${escapeHtml(u.id)}`;
  return `
    <div class="user-row" data-id="${escapeHtml(u.id)}" data-name="${escapeHtml(u.name)}" data-display="${escapeHtml(u.displayName || u.name)}" data-avatar="${avatarSrc}" data-plus="${u.plus ? "1" : "0"}">
      ${avatarImg(avatarSrc, 'loading="lazy" decoding="async"')}
      <div class="user-copy">
        <b>${escapeHtml(u.displayName || u.name)}${u.plus ? plusIcon(14) : ""}</b>
        ${showUsername ? `<span>@${escapeHtml(u.name)}</span>` : ""}
      </div>
    </div>
  `;
}

function getBonusDaysLeft(){
  const KEY = "rblx_bonus_start_day_v1";
  const START_DAYS = 9;
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  let startKey = localStorage.getItem(KEY);
  if (!startKey) {
    localStorage.setItem(KEY, todayKey);
    startKey = todayKey;
  }
  const [y, m, d] = startKey.split("-").map(Number);
  if (!y || !m || !d) {
    localStorage.setItem(KEY, todayKey);
    return START_DAYS;
  }
  const start = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsed = Math.floor((today - start) / 86400000);
  return Math.max(0, START_DAYS - elapsed);
}

function syncBonusDays(){
  const el = $("bonusDays");
  if (!el) return;
  const days = getBonusDaysLeft();
  el.textContent = days === 1 ? "1 day left" : `${days} days left`;
}

function renderPackages(){
  $("priceBox").innerHTML = packages.map((p, i) => `
    <div class="package">
      <div class="amount">
        ${robuxIcon(22)}
        <b>${fmt(p.amount)}</b>
        <span class="old">${robuxIcon(16)} ${fmt(p.old)}</span>
      </div>
      <div class="package-tags">
        <div class="bonus">${tagIcon(12)} ${fmt(p.bonus)} bonus</div>
        ${p.forYou ? `<div class="for-you">${forYouIcon(12)} For you</div>` : ""}
      </div>
      <button class="price ${p.selected ? "selected" : ""}" data-package="${i}" type="button">${p.price}</button>
    </div>
  `).join("");

  if (!packagesBound) {
    packagesBound = true;
    $("priceBox").addEventListener("click", e => {
      const button = e.target.closest("[data-package]");
      if (!button || !$("priceBox").contains(button)) return;
      const idx = Number(button.dataset.package);
      const pkg = packages[idx];
      if (!pkg) return;
      packages.forEach((p, i) => { p.selected = i === idx; });
      $("priceBox").querySelectorAll(".price").forEach(el => {
        el.classList.toggle("selected", Number(el.dataset.package) === idx);
      });
      openCheckout(pkg);
    });
  }
}

/* ========== BUY FLOW ========== */
function openCheckout(pkg){
  pendingPackage = pkg;
  $("checkoutSummary").innerHTML = `
    <div class="checkout-pkg-top">
      <div class="amount">
        ${robuxIcon(28)}
        <b>${fmt(pkg.amount)}</b>
        <span class="old">${robuxIcon(16)} ${fmt(pkg.old)}</span>
      </div>
      <b class="checkout-price">${escapeHtml(pkg.price)}</b>
    </div>
    <div class="bonus">${tagIcon(12)} ${fmt(pkg.bonus)} bonus</div>
  `;

  $("checkoutMethods").innerHTML = PAYMENT_METHODS.map(m => {
    const logosHtml = `<div class="pay-row-icon ${m.logos.length > 1 ? "multi" : ""}">${
      m.logos.map(src => `<img src="${src}" alt="">`).join("")
    }</div>`;

    if (m.id === "paypal") {
      return `
        <button class="pay-row pay-row-active" type="button" data-pay="paypal">
          ${logosHtml}
          <div class="pay-row-copy">
            <b>PayPal</b>
            <span>rhiv******@gmail.com</span>
          </div>
        </button>
      `;
    }
    return `
      <div class="pay-row pay-row-disabled" title="PayPal only for this concept" tabindex="-1">
        ${logosHtml}
        <span class="pay-row-label">${escapeHtml(m.label)}</span>
      </div>
    `;
  }).join("");

  $("checkoutMethods").querySelector('[data-pay="paypal"]')?.addEventListener("click", () => {
    closeCheckout();
    showLoadingThen(() => openTopupConfirm(), 850);
  });

  $("checkoutShade").classList.remove("hidden");
}

function closeCheckout(){
  $("checkoutShade").classList.add("hidden");
}

function showLoadingThen(next, ms = 800){
  clearTimeout(loadingTimer);
  const shade = $("loadingShade");
  shade.classList.remove("hidden");
  loadingTimer = setTimeout(() => {
    shade.classList.add("hidden");
    loadingTimer = null;
    next();
  }, ms);
}

function hideLoading(){
  clearTimeout(loadingTimer);
  loadingTimer = null;
  $("loadingShade").classList.add("hidden");
}

function openTopupConfirm(){
  if (!pendingPackage) return;
  $("topupSummary").innerHTML = `
    <div class="topup-line"><span>Robux</span><b>${robuxIcon(16)} ${fmt(pendingPackage.amount)}</b></div>
    <div class="topup-line"><span>Bonus</span><b>+ ${fmt(pendingPackage.bonus)}</b></div>
    <div class="topup-line total"><span>Total</span><b>${escapeHtml(pendingPackage.price)}</b></div>
  `;
  $("topupShade").classList.remove("hidden");
}

function closeTopup(){
  $("topupShade").classList.add("hidden");
}

$("checkoutClose").addEventListener("click", closeCheckout);
$("checkoutShade").addEventListener("click", e => { if (e.target === $("checkoutShade")) closeCheckout(); });
$("topupClose").addEventListener("click", closeTopup);
$("topupShade").addEventListener("click", e => { if (e.target === $("topupShade")) closeTopup(); });

$("topupConfirm").addEventListener("click", () => {
  if (!pendingPackage) return;
  const added = pendingPackage.amount;
  const pkg = pendingPackage;
  balance += added;
  syncBalance();
  closeTopup();
  openBuySuccess(added, pkg);
});

function openBuySuccess(added, pkg){
  successMode = "buy";
  $("successHeadTitle").textContent = "Buy Robux";
  $("successMessage").textContent = `You added ${fmt(added)} Robux`;
  syncBalance();
  $("successShade").classList.remove("hidden");
  pendingPackage = null;
}

/* ========== SEND FLOW ========== */
const ME_USERNAME = "o_ren8";

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

async function loadDefaultFriends(){
  const gifted = RblxWallet.giftedRecipients();
  if (gifted.length) {
    defaultFriends = withRealAvatars(RblxWallet.shuffle(gifted));
    return;
  }

  try {
    const res = await fetch("/api/friends/default");
    if (!res.ok) throw new Error("friends failed");
    const data = await res.json();
    defaultFriends = withRealAvatars(data.users);
  } catch (err) {
    defaultFriends = [];
  }
}

function refreshFriendsFromHistory(){
  const gifted = RblxWallet.giftedRecipients();
  if (!gifted.length) return false;
  defaultFriends = withRealAvatars(RblxWallet.shuffle(gifted));
  return true;
}

function openSendModal(){
  refreshFriendsFromHistory();
  $("modalShade").classList.remove("hidden");
  $("userSearch").value = "";
  renderUsers(defaultFriends, "friends");
}

function closeSendModal(){
  $("modalShade").classList.add("hidden");
}

$("sendButton").addEventListener("click", () => {
  sendAmount = 0;
  openSendModal();
});
$("closeModal").addEventListener("click", closeSendModal);
$("modalShade").addEventListener("click", e => {
  if (e.target === $("modalShade")) closeSendModal();
});

$("userResults").addEventListener("click", e => {
  const row = e.target.closest(".user-row");
  if (!row || !$("userResults").contains(row)) return;
  selectedUser = {
    id: row.dataset.id,
    name: row.dataset.name,
    displayName: row.dataset.display,
    avatar: row.dataset.avatar,
    plus: row.dataset.plus === "1"
  };
  openAmountSelect();
});

function renderUsers(users, mode){
  const list = withRealAvatars(users);
  const showUsername = mode === "people" || mode === "results";

  if (mode === "friends") $("peopleTitle").textContent = `My friends (${list.length})`;
  else if (mode === "people") $("peopleTitle").textContent = `People (${list.length})`;
  else $("peopleTitle").textContent = `Results (${list.length})`;

  if (!list.length) {
    $("userResults").innerHTML = '<div class="empty-state">No users found.</div>';
    return;
  }

  $("userResults").innerHTML = list.map(u => userRowHtml(u, { showUsername })).join("");
}

function renderSearchSections(friends, people){
  const friendList = withRealAvatars(friends);
  const peopleList = withRealAvatars(people);
  $("peopleTitle").textContent = "";

  if (!friendList.length && !peopleList.length) {
    $("userResults").innerHTML = '<div class="empty-state">No users found.</div>';
    return;
  }

  let html = "";
  if (friendList.length) {
    html += `<h4 class="result-section-title">My friends (${friendList.length})</h4>`;
    html += friendList.map(u => userRowHtml(u, { showUsername: false })).join("");
  }
  if (peopleList.length) {
    html += `<h4 class="result-section-title">People (${peopleList.length})</h4>`;
    html += peopleList.map(u => userRowHtml(u, { showUsername: true })).join("");
  }

  $("userResults").innerHTML = html;
}

function filterFriends(query){
  const q = query.trim().toLowerCase();
  if (!q) return defaultFriends;
  return defaultFriends.filter(u =>
    u.name.toLowerCase().includes(q) ||
    (u.displayName || "").toLowerCase().includes(q)
  );
}

function renderLoading(){
  $("peopleTitle").textContent = "Searching";
  $("userResults").innerHTML = '<div class="empty-state">Searching users…</div>';
}

async function liveSearch(keyword){
  const q = keyword.trim();
  const token = ++searchToken;
  const localMatches = withRealAvatars(filterFriends(q));

  if (searchAbort) {
    searchAbort.abort();
    searchAbort = null;
  }

  if (!q) {
    renderUsers(defaultFriends, "friends");
    return;
  }

  if (q.length < 2) {
    renderSearchSections(localMatches, []);
    return;
  }

  if (localMatches.length) renderSearchSections(localMatches, []);
  else renderLoading();

  const controller = new AbortController();
  searchAbort = controller;

  try {
    const res = await fetch(`/api/users/search?keyword=${encodeURIComponent(q)}`, {
      signal: controller.signal
    });
    if (!res.ok) throw new Error("Search request failed");
    const data = await res.json();
    if (token !== searchToken) return;

    const apiUsers = withRealAvatars(data.users);
    const friendIds = new Set(localMatches.map(u => String(u.id)));
    const friendNames = new Set(localMatches.map(u => String(u.name).toLowerCase()));
    const people = apiUsers.filter(u =>
      !friendIds.has(String(u.id)) &&
      !friendNames.has(String(u.name).toLowerCase())
    );

    renderSearchSections(localMatches, people);
  } catch (error) {
    if (error.name === "AbortError" || token !== searchToken) return;
    if (localMatches.length) {
      renderSearchSections(localMatches, []);
    } else if (defaultFriends.length) {
      renderUsers(defaultFriends, "friends");
      showToast("Search is slow right now — showing friends with real avatars.");
    } else {
      $("peopleTitle").textContent = "Search unavailable";
      $("userResults").innerHTML = '<div class="empty-state">Could not reach the Roblox public user API. Try again.</div>';
    }
  } finally {
    if (searchAbort === controller) searchAbort = null;
  }
}

$("userSearch").addEventListener("input", e => {
  clearTimeout(searchTimer);
  const value = e.target.value;

  if (!value.trim()) {
    searchToken += 1;
    if (searchAbort) {
      searchAbort.abort();
      searchAbort = null;
    }
    renderUsers(defaultFriends, "friends");
    return;
  }

  searchTimer = setTimeout(() => liveSearch(value), 280);
});

function syncAmountInputWidth(){
  const el = $("amountInput");
  if (!el) return;
  el.style.width = `${Math.max(2, String(el.value || "").length || 1)}ch`;
}

function updateAmountValidity(){
  const err = $("amountError");
  const next = $("amountNext");
  const amount = Math.floor(Number($("amountInput").value));
  sendAmount = Number.isFinite(amount) ? amount : 0;

  const insufficient = sendAmount > 0 && sendAmount > balance;
  err.classList.toggle("hidden", !insufficient);
  next.disabled = insufficient;
}

function setAmountValue(value){
  sendAmount = Number(value) || 0;
  $("amountInput").value = sendAmount ? String(sendAmount) : "";
  syncAmountInputWidth();
  $("amountPresets").querySelectorAll(".preset").forEach(el => {
    el.classList.toggle("on", Number(el.dataset.amt) === sendAmount);
  });
  updateAmountValidity();
}

function openAmountSelect(){
  closeSendModal();
  if (!sendAmount) sendAmount = SEND_PRESETS[0];
  const src = userAvatarSrc(selectedUser);
  $("amountUser").innerHTML = `
    ${avatarImg(src, 'class="amount-avatar" loading="lazy" decoding="async"')}
    <b>${escapeHtml(selectedUser.displayName || selectedUser.name)}</b>
  `;
  $("amountPresets").innerHTML = SEND_PRESETS.map(v => `
    <button type="button" class="preset ${v === sendAmount ? "on" : ""}" data-amt="${v}">
      ${robuxIcon(14)} ${fmt(v)}
    </button>
  `).join("");
  setAmountValue(sendAmount);
  syncBalance();
  $("amountShade").classList.remove("hidden");
}

function closeAmountSelect(){
  $("amountShade").classList.add("hidden");
}

$("amountClose").addEventListener("click", closeAmountSelect);
$("amountShade").addEventListener("click", e => {
  if (e.target === $("amountShade")) closeAmountSelect();
});

$("amountPresets").addEventListener("click", e => {
  const btn = e.target.closest("[data-amt]");
  if (!btn || !$("amountPresets").contains(btn)) return;
  setAmountValue(Number(btn.dataset.amt));
});

$("amountNext").addEventListener("click", () => {
  sendAmount = Math.floor(Number($("amountInput").value));
  if (!selectedUser || !Number.isFinite(sendAmount) || sendAmount <= 0) {
    showToast("Enter a valid Robux amount.");
    return;
  }
  if (sendAmount > balance) {
    updateAmountValidity();
    return;
  }
  closeAmountSelect();
  openSendConfirm();
});

$("amountInput").addEventListener("input", e => {
  const el = e.target;
  const raw = el.value.replace(/[^\d]/g, "").slice(0, 7);
  if (el.value !== raw) el.value = raw;
  const n = raw ? (raw | 0) : 0;
  sendAmount = n;
  el.style.width = `${Math.max(2, raw.length || 1)}ch`;
  const presets = $("amountPresets").children;
  for (let i = 0; i < presets.length; i++) {
    const btn = presets[i];
    btn.classList.toggle("on", (btn.dataset.amt | 0) === n);
  }
  const insufficient = n > 0 && n > balance;
  $("amountError").classList.toggle("hidden", !insufficient);
  $("amountNext").disabled = insufficient;
});

function openSendConfirm(){
  const src = userAvatarSrc(selectedUser);
  $("confirmProfile").innerHTML = `
    ${avatarImg(src, 'class="confirm-avatar" loading="lazy" decoding="async"')}
    <b>${escapeHtml(selectedUser.displayName || selectedUser.name)}</b>
    <span>@${escapeHtml(selectedUser.name)}</span>
    <div class="confirm-meta">
      <span>${ICO_CALENDAR} New Connection</span>
      <span>${ICO_MUTUAL} 0 mutual Connections</span>
    </div>
    <div class="confirm-joined">${ICO_INFO} Joined in 2025</div>
  `;
  $("confirmAmountValue").textContent = fmt(sendAmount);
  syncBalance();
  $("sendConfirmShade").classList.remove("hidden");
}

function closeSendConfirm(){
  $("sendConfirmShade").classList.add("hidden");
}

$("sendConfirmClose").addEventListener("click", closeSendConfirm);
$("sendConfirmShade").addEventListener("click", e => {
  if (e.target === $("sendConfirmShade")) closeSendConfirm();
});

$("confirmEditBtn").addEventListener("click", () => {
  closeSendConfirm();
  openAmountSelect();
});

$("confirmSendBtn").addEventListener("click", () => {
  if (!selectedUser || !sendAmount) return;
  if (sendAmount > balance) {
    showToast("Not enough Robux in your wallet.");
    return;
  }
  const name = selectedUser.displayName || selectedUser.name;
  balance -= sendAmount;
  RblxWallet.addTransaction({
    type: "transfer",
    sourceId: selectedUser.id,
    sourceName: name,
    sourceUsername: selectedUser.name,
    description: `Sent Robux to ${name}.`,
    amount: sendAmount,
    direction: "out",
    avatar: `/api/avatar/${selectedUser.id}`
  });
  refreshFriendsFromHistory();
  syncBalance();
  closeSendConfirm();
  openSendSuccess(sendAmount);
});

function openSendSuccess(amount){
  successMode = "send";
  $("successHeadTitle").textContent = "Send Robux";
  $("successMessage").textContent = `You sent ${fmt(amount)} Robux`;
  syncBalance();
  $("successShade").classList.remove("hidden");
}

function closeSuccessModal(){
  $("successShade").classList.add("hidden");
}

$("successDone").addEventListener("click", closeSuccessModal);
$("successClose").addEventListener("click", closeSuccessModal);
$("successShade").addEventListener("click", e => {
  if (e.target === $("successShade")) closeSuccessModal();
});

function showToast(message){
  const t = $("toast");
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => t.classList.remove("show"), 2300);
}

renderPackages();
syncBonusDays();
syncBalance();
RblxWallet.bindRobuxMenu();
loadMeAvatar();
loadDefaultFriends();

RblxWallet.subscribe(payload => {
  if (payload.balance != null) {
    balance = payload.balance;
    syncBalance();
  }
  if (Array.isArray(payload.transactions)) refreshFriendsFromHistory();
});
