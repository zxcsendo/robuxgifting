const $ = id => document.getElementById(id);
const fmt = value => Number(value).toLocaleString("en-US");
const DEFAULT_AVATAR = "/assets/default-avatar.png";
const ME_USERNAME = "o_ren8";

let balance = RblxWallet.loadBalance();
let allTx = [];
let viewed = RblxWallet.loadViewed();
let filterType = "transfer";
let pageSize = 10;
let page = 1;

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function syncBalance(){
  const text = fmt(balance);
  if ($("topBalance")) $("topBalance").textContent = text;
  if ($("txBalance")) $("txBalance").textContent = text;
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

function formatTxDateParts(iso){
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: String(iso), time: "" };
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return { date: `${mm}/${dd}/${yy}`, time: `${h}:${m} ${ampm}` };
}

function filteredTx(){
  // History is send-only; Summary / Purchases / Transfers all draw from sent list.
  // Purchases filter intentionally empty — history only records people you sent to.
  if (filterType === "purchase") return [];
  return allTx.slice();
}

function avatarFor(tx){
  if (tx.avatar && String(tx.avatar).startsWith("/api/avatar/")) return tx.avatar;
  if (tx.sourceId) return `/api/avatar/${escapeHtml(tx.sourceId)}`;
  return DEFAULT_AVATAR;
}

function renderTable(){
  const list = filteredTx();
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize) || 1);
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;

  const start = (page - 1) * pageSize;
  const slice = list.slice(start, start + pageSize);
  const body = $("txTableBody");
  const empty = $("txEmpty");

  if (!slice.length) {
    body.innerHTML = "";
    empty.textContent = filterType === "purchase"
      ? "No purchase history in this view."
      : "No Robux transfers yet. Send Robux from the Buy Robux page — recipients show up here with their real avatar.";
    empty.classList.remove("hidden");
  } else {
    empty.classList.add("hidden");
    body.innerHTML = slice.map(tx => {
      const src = avatarFor(tx);
      const unread = !viewed.has(String(tx.id));
      const when = formatTxDateParts(tx.date);
      return `
        <tr class="tx-row${unread ? " tx-unread" : ""}" data-id="${escapeHtml(tx.id)}" tabindex="0">
          <td>
            <div class="tx-date">
              <span class="tx-date-day">${escapeHtml(when.date)}</span>
              <span class="tx-date-time">${escapeHtml(when.time)}</span>
            </div>
          </td>
          <td>
            <div class="tx-source">
              <img src="${src}" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}'" />
              <span>${escapeHtml(tx.sourceName)}</span>
            </div>
          </td>
          <td>
            <div class="tx-desc">
              <img class="tx-desc-thumb" src="${src}" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}'" />
              <span>${escapeHtml(tx.description)}</span>
            </div>
          </td>
          <td>
            <div class="tx-amount">
              <img class="rbx-icon" src="/assets/robux.svg" alt="" />
              <span>${fmt(tx.amount)}</span>
            </div>
          </td>
          <td class="tx-col-action">
            <button type="button" class="tx-more" aria-label="More actions" data-more="${escapeHtml(tx.id)}">⋯</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  $("txPageNum").textContent = String(page);
  $("txPrev").disabled = page <= 1;
  $("txNext").disabled = page >= totalPages || !list.length;
}

function markRowViewed(id){
  if (!id || viewed.has(String(id))) return;
  viewed = RblxWallet.markViewed(id);
  const row = $("txTableBody").querySelector(`tr[data-id="${CSS.escape(String(id))}"]`);
  if (row) row.classList.remove("tx-unread");
}

$("txTableBody").addEventListener("click", e => {
  const row = e.target.closest("tr[data-id]");
  if (!row || !$("txTableBody").contains(row)) return;
  markRowViewed(row.dataset.id);
});

$("txTableBody").addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const row = e.target.closest("tr[data-id]");
  if (!row) return;
  e.preventDefault();
  markRowViewed(row.dataset.id);
});

function bindCustomSelect(rootId, onChange){
  const root = $(rootId);
  if (!root) return;
  const btn = root.querySelector(".tx-select");
  const menu = root.querySelector(".tx-options");
  const valueEl = root.querySelector(".tx-select-value");

  function close(){
    menu.classList.add("hidden");
    btn.setAttribute("aria-expanded", "false");
    root.classList.remove("open");
  }

  function open(){
    document.querySelectorAll(".tx-filter.open").forEach(el => {
      if (el !== root) {
        el.classList.remove("open");
        el.querySelector(".tx-options")?.classList.add("hidden");
        el.querySelector(".tx-select")?.setAttribute("aria-expanded", "false");
      }
    });
    menu.classList.remove("hidden");
    btn.setAttribute("aria-expanded", "true");
    root.classList.add("open");
  }

  btn.addEventListener("click", e => {
    e.stopPropagation();
    if (menu.classList.contains("hidden")) open();
    else close();
  });

  menu.addEventListener("click", e => {
    const opt = e.target.closest("[data-value]");
    if (!opt || !menu.contains(opt)) return;
    menu.querySelectorAll("[role=option]").forEach(li => {
      li.classList.toggle("selected", li === opt);
      li.setAttribute("aria-selected", li === opt ? "true" : "false");
    });
    valueEl.textContent = opt.textContent.trim();
    close();
    onChange(opt.dataset.value, opt.textContent.trim());
  });

  document.addEventListener("click", e => {
    if (!root.contains(e.target)) close();
  });
}

$("txPrev").addEventListener("click", () => {
  if (page > 1) {
    page -= 1;
    renderTable();
  }
});

$("txNext").addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(filteredTx().length / pageSize) || 1);
  if (page < totalPages) {
    page += 1;
    renderTable();
  }
});

bindCustomSelect("filterType", value => {
  filterType = value;
  page = 1;
  renderTable();
});

bindCustomSelect("filterPageSize", value => {
  pageSize = Number(value) || 10;
  page = 1;
  renderTable();
});

allTx = RblxWallet.loadTransactions();
syncBalance();
RblxWallet.bindRobuxMenu();
loadMeAvatar();
renderTable();

RblxWallet.subscribe(payload => {
  if (payload.balance != null) balance = payload.balance;
  if (Array.isArray(payload.transactions)) {
    allTx = payload.transactions.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    page = 1;
  }
  if (Array.isArray(payload.viewed)) viewed = new Set(payload.viewed.map(String));
  else viewed = RblxWallet.loadViewed();
  syncBalance();
  renderTable();
});

function refreshFromStorage(){
  balance = RblxWallet.loadBalance();
  allTx = RblxWallet.loadTransactions();
  viewed = RblxWallet.loadViewed();
  syncBalance();
  renderTable();
}

window.addEventListener("focus", refreshFromStorage);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshFromStorage();
});
