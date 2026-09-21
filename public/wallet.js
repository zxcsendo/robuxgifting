/* Shared wallet + sent-Robux transaction log (localStorage + cross-tab realtime) */
(function (global) {
  const BAL_KEY = "rblx_balance_v1";
  const TX_KEY = "rblx_tx_v2";
  const VIEWED_KEY = "rblx_tx_viewed_v1";
  const LEGACY_TX_KEYS = ["rblx_tx_v1"];
  const CHANNEL_NAME = "rblx_wallet_sync_v1";
  const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  const listeners = new Set();
  let channel = null;
  let lastEmitAt = 0;
  let remoteDebounce = null;
  let emitTimer = null;
  let pendingReason = "sync";

  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch (_) {
    channel = null;
  }

  function snapshot(reason) {
    return {
      reason: reason || "sync",
      tabId: TAB_ID,
      balance: loadBalance(),
      transactions: loadTransactions(),
      viewed: [...loadViewed()],
      at: Date.now()
    };
  }

  function notifyLocal(payload) {
    listeners.forEach(fn => {
      try { fn(payload); } catch (_) {}
    });
  }

  function emit(reason) {
    pendingReason = reason || pendingReason || "sync";
    clearTimeout(emitTimer);
    // Coalesce balance + tx writes from the same send into one cross-tab ping
    emitTimer = setTimeout(() => {
      const payload = snapshot(pendingReason);
      lastEmitAt = payload.at;
      pendingReason = "sync";
      if (channel) {
        try { channel.postMessage(payload); } catch (_) {}
      }
    }, 0);
  }

  function onRemote(payload) {
    if (!payload || payload.tabId === TAB_ID) return;
    // Ignore echoes that arrive almost immediately after our own write
    if (payload.at && Math.abs(payload.at - lastEmitAt) < 30) return;
    notifyLocal({
      ...payload,
      balance: payload.balance != null ? payload.balance : loadBalance(),
      transactions: Array.isArray(payload.transactions) ? payload.transactions : loadTransactions(),
      viewed: Array.isArray(payload.viewed) ? payload.viewed : [...loadViewed()]
    });
  }

  function scheduleStorageSync(key) {
    clearTimeout(remoteDebounce);
    remoteDebounce = setTimeout(() => {
      const reason = key === TX_KEY ? "transactions" : key === BAL_KEY ? "balance" : "viewed";
      onRemote({ ...snapshot(reason), tabId: "storage" });
    }, 40);
  }

  if (channel) {
    channel.onmessage = e => onRemote(e.data);
  }

  // Fallback when BroadcastChannel is unavailable
  global.addEventListener("storage", e => {
    if (channel) return;
    if (!e.key || (e.key !== BAL_KEY && e.key !== TX_KEY && e.key !== VIEWED_KEY)) return;
    scheduleStorageSync(e.key);
  });

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function loadBalance() {
    const raw = localStorage.getItem(BAL_KEY);
    if (raw != null && raw !== "" && Number.isFinite(Number(raw))) {
      return Math.floor(Number(raw));
    }
    const bal = 20000 + Math.floor(Math.random() * 4500);
    localStorage.setItem(BAL_KEY, String(bal));
    return bal;
  }

  function saveBalance(value) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    const prevRaw = localStorage.getItem(BAL_KEY);
    const prev = prevRaw != null && prevRaw !== "" && Number.isFinite(Number(prevRaw))
      ? Math.floor(Number(prevRaw))
      : null;
    localStorage.setItem(BAL_KEY, String(n));
    if (prev !== n) emit("balance");
    return n;
  }

  function isSentTransfer(tx) {
    if (!tx || typeof tx !== "object") return false;
    if (tx.direction && tx.direction !== "out") return false;
    if (tx.type && tx.type !== "transfer") return false;
    const id = tx.sourceId ?? tx.userId;
    if (id == null || id === "") return false;
    const amount = Math.floor(Number(tx.amount) || 0);
    return amount > 0;
  }

  function normalizeTx(tx) {
    const name = tx.sourceName || tx.displayName || tx.name || "Unknown";
    const username = tx.sourceUsername || tx.username || tx.name || name;
    return {
      id: tx.id || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "transfer",
      date: tx.date || new Date().toISOString(),
      sourceId: String(tx.sourceId ?? tx.userId),
      sourceName: name,
      sourceUsername: username,
      description: tx.description || `Sent Robux to ${name}.`,
      amount: Math.floor(Number(tx.amount) || 0),
      direction: "out",
      avatar: tx.avatar && String(tx.avatar).startsWith("/api/avatar/")
        ? tx.avatar
        : `/api/avatar/${tx.sourceId ?? tx.userId}`
    };
  }

  function loadTransactionsRaw() {
    try {
      const raw = localStorage.getItem(TX_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isSentTransfer).map(normalizeTx) : [];
      }
    } catch (_) {}

    // One-time migrate: keep only real outbound sends from legacy seed dumps
    for (const key of LEGACY_TX_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) continue;
        const kept = parsed
          .filter(tx => isSentTransfer(tx) && !String(tx.id || "").startsWith("seed-"))
          .map(normalizeTx);
        localStorage.setItem(TX_KEY, JSON.stringify(kept));
        return kept;
      } catch (_) {}
    }
    localStorage.setItem(TX_KEY, "[]");
    return [];
  }

  function loadTransactions() {
    return loadTransactionsRaw().slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function saveTransactions(list) {
    localStorage.setItem(TX_KEY, JSON.stringify(list.filter(isSentTransfer).map(normalizeTx)));
  }

  function addTransaction(tx) {
    if (!isSentTransfer({ ...tx, direction: tx.direction || "out", type: tx.type || "transfer" })) {
      return loadTransactionsRaw();
    }
    const list = loadTransactionsRaw();
    list.unshift(normalizeTx({ ...tx, direction: "out", type: "transfer" }));
    saveTransactions(list);
    emit("transactions");
    return list;
  }

  function loadViewed() {
    try {
      const raw = localStorage.getItem(VIEWED_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch (_) {
      return new Set();
    }
  }

  function markViewed(id) {
    const set = loadViewed();
    set.add(String(id));
    localStorage.setItem(VIEWED_KEY, JSON.stringify([...set]));
    emit("viewed");
    return set;
  }

  function isViewed(id) {
    return loadViewed().has(String(id));
  }

  function bindRobuxMenu() {
    const menu = document.getElementById("robuxMenu");
    const btn = document.getElementById("robuxMenuBtn");
    const drop = document.getElementById("robuxDropdown");
    if (!menu || !btn || !drop) return;

    function close() {
      drop.classList.add("hidden");
      btn.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }

    function toggle(e) {
      e.preventDefault();
      e.stopPropagation();
      const open = drop.classList.contains("hidden");
      if (open) {
        drop.classList.remove("hidden");
        btn.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      } else {
        close();
      }
    }

    btn.addEventListener("click", toggle);
    document.addEventListener("click", e => {
      if (!menu.contains(e.target)) close();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") close();
    });

    const redeem = document.getElementById("redeemCodesLink");
    if (redeem) {
      redeem.addEventListener("click", e => {
        e.preventDefault();
        close();
        const toast = document.getElementById("toast");
        if (toast) {
          toast.textContent = "Redeem codes is a concept placeholder.";
          toast.classList.add("show");
          clearTimeout(window.toastTimer);
          window.toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
        }
      });
    }
  }

  function shuffle(list) {
    const a = (list || []).slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  /** Unique people you've sent Robux to (from My Transactions history). */
  function giftedRecipients() {
    const seen = new Set();
    const out = [];
    for (const tx of loadTransactions()) {
      const id = String(tx.sourceId || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        name: tx.sourceUsername || tx.sourceName,
        displayName: tx.sourceName || tx.sourceUsername || "Unknown",
        avatar: tx.avatar && String(tx.avatar).startsWith("/api/avatar/")
          ? tx.avatar
          : `/api/avatar/${id}`,
        plus: false
      });
    }
    return out;
  }

  global.RblxWallet = {
    loadBalance,
    saveBalance,
    loadTransactions,
    addTransaction,
    loadViewed,
    markViewed,
    isViewed,
    subscribe,
    shuffle,
    giftedRecipients,
    bindRobuxMenu
  };
})(window);
