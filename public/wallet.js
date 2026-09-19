/* Shared wallet + sent-Robux transaction log (localStorage) */
(function (global) {
  const BAL_KEY = "rblx_balance_v1";
  const TX_KEY = "rblx_tx_v2";
  const VIEWED_KEY = "rblx_tx_viewed_v1";
  const LEGACY_TX_KEYS = ["rblx_tx_v1"];

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
    localStorage.setItem(BAL_KEY, String(n));
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
    return {
      id: tx.id || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "transfer",
      date: tx.date || new Date().toISOString(),
      sourceId: String(tx.sourceId ?? tx.userId),
      sourceName: name,
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

  global.RblxWallet = {
    loadBalance,
    saveBalance,
    loadTransactions,
    addTransaction,
    loadViewed,
    markViewed,
    isViewed,
    bindRobuxMenu
  };
})(window);
