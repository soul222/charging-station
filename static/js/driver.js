const STATION_CODE = "CS-SDR-01";
let USER_ID = 1;
const TOTAL_PHONE_BATTERY_MAH = 5000;

let currentUser = null;
let userVehicles = [];
let userCards = [];
let stationConnectors = [];

let selectedVehicle = null;
let selectedConnector = null;
let pendingNozzleConnector = null;
let isPlugged = false;
let isSimulatedMode = false;
let currentStep = 1;
let targetMode = "FULL";
let paymentMethod = "WALLET";
let currentEstimate = null;
let activeSessionId = null;
let ws = null;
let adbBatteryState = null;

// =============================================================
// UNIVERSAL CUSTOM DIALOG SYSTEM (MODAL ALERT & CONFIRM)
// =============================================================
function showAppAlert(message, options = {}) {
  const {
    title = "Pemberitahuan",
    subtitle = "",
    type = "info", // 'info' | 'warning' | 'error' | 'success'
    confirmText = "Mengerti",
    icon = null
  } = (typeof options === "string") ? { title: options } : options;

  return new Promise((resolve) => {
    const overlay = document.getElementById("appDialogOverlay");
    const box = document.getElementById("appDialogBox");
    const titleEl = document.getElementById("appDialogTitle");
    const subtitleEl = document.getElementById("appDialogSubtitle");
    const msgEl = document.getElementById("appDialogMessage");
    const iconEl = document.getElementById("appDialogIcon");
    const confirmBtn = document.getElementById("appDialogConfirmBtn");
    const cancelBtn = document.getElementById("appDialogCancelBtn");

    if (!overlay || !box) {
      alert(message);
      resolve(true);
      return;
    }

    titleEl.innerText = title;
    msgEl.innerText = message;
    if (subtitle) {
      subtitleEl.innerText = subtitle;
      subtitleEl.style.display = "block";
    } else {
      subtitleEl.style.display = "none";
    }

    box.className = `app-dialog-box ${type}`;
    let defaultIcon = "⚡";
    if (type === "warning") defaultIcon = "⚠️";
    else if (type === "error") defaultIcon = "❌";
    else if (type === "success") defaultIcon = "✅";
    else if (type === "info") defaultIcon = "ℹ️";

    iconEl.innerText = icon || defaultIcon;
    confirmBtn.innerText = confirmText;
    confirmBtn.className = (type === "error") ? "btn btn-danger" : "btn btn-primary";
    if (cancelBtn) cancelBtn.style.display = "none";

    const onConfirm = () => {
      confirmBtn.removeEventListener("click", onConfirm);
      overlay.classList.remove("open");
      resolve(true);
    };

    confirmBtn.addEventListener("click", onConfirm);
    overlay.classList.add("open");
  });
}

function showAppConfirm(message, options = {}) {
  const {
    title = "Konfirmasi Tindakan",
    subtitle = "",
    type = "warning",
    confirmText = "Ya, Lanjutkan",
    cancelText = "Batal",
    icon = null
  } = (typeof options === "string") ? { title: options } : options;

  return new Promise((resolve) => {
    const overlay = document.getElementById("appDialogOverlay");
    const box = document.getElementById("appDialogBox");
    const titleEl = document.getElementById("appDialogTitle");
    const subtitleEl = document.getElementById("appDialogSubtitle");
    const msgEl = document.getElementById("appDialogMessage");
    const iconEl = document.getElementById("appDialogIcon");
    const confirmBtn = document.getElementById("appDialogConfirmBtn");
    const cancelBtn = document.getElementById("appDialogCancelBtn");

    if (!overlay || !box) {
      resolve(confirm(message));
      return;
    }

    titleEl.innerText = title;
    msgEl.innerText = message;
    if (subtitle) {
      subtitleEl.innerText = subtitle;
      subtitleEl.style.display = "block";
    } else {
      subtitleEl.style.display = "none";
    }

    box.className = `app-dialog-box ${type}`;
    let defaultIcon = "⚠️";
    if (type === "error") defaultIcon = "🛑";
    else if (type === "info") defaultIcon = "ℹ️";

    iconEl.innerText = icon || defaultIcon;
    confirmBtn.innerText = confirmText;
    confirmBtn.className = (type === "error" || type === "warning") ? "btn btn-danger" : "btn btn-primary";
    
    if (cancelBtn) {
      cancelBtn.innerText = cancelText;
      cancelBtn.style.display = "block";
    }

    const cleanup = () => {
      confirmBtn.removeEventListener("click", onConfirm);
      if (cancelBtn) cancelBtn.removeEventListener("click", onCancel);
      overlay.classList.remove("open");
    };

    const onConfirm = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };

    confirmBtn.addEventListener("click", onConfirm);
    if (cancelBtn) cancelBtn.addEventListener("click", onCancel);
    overlay.classList.add("open");
  });
}

// Auth Tab Switcher
function switchAuthTab(tab) {
  const tabLogin = document.getElementById("tabAuthLogin");
  const tabReg = document.getElementById("tabAuthRegister");
  const fLogin = document.getElementById("formLogin");
  const fReg = document.getElementById("formRegister");
  if (tabLogin && tabReg && fLogin && fReg) {
    tabLogin.className = `tab-btn ${tab === 'login' ? 'active' : ''}`;
    tabReg.className = `tab-btn ${tab === 'register' ? 'active' : ''}`;
    fLogin.style.display = tab === 'login' ? 'block' : 'none';
    fReg.style.display = tab === 'register' ? 'block' : 'none';
  }
}

function quickFillAccount(username, password) {
  const uInput = document.getElementById("loginUsername");
  const pInput = document.getElementById("loginPassword");
  if (uInput && pInput) {
    uInput.value = username;
    pInput.value = password;
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const u = document.getElementById("loginUsername").value.trim();
  const p = document.getElementById("loginPassword").value;
  const btn = document.getElementById("btnLoginSubmit");
  if (btn) {
    btn.innerText = "Memverifikasi...";
    btn.disabled = true;
  }

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (!res.ok) {
      await showAppAlert(data.detail || "Username atau password salah!", { title: "Gagal Masuk", type: "error" });
      if (btn) {
        btn.innerText = "Masuk ke Akun ➜";
        btn.disabled = false;
      }
      return;
    }

    localStorage.setItem("voltx_user", JSON.stringify(data));
    if (btn) {
      btn.innerText = "Masuk ke Akun ➜";
      btn.disabled = false;
    }
    await initDriverApp();
  } catch (err) {
    await showAppAlert("Gagal koneksi ke server SPKLU: " + err, { title: "Koneksi Bermasalah", type: "error" });
    if (btn) {
      btn.innerText = "Masuk ke Akun ➜";
      btn.disabled = false;
    }
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const fullName = document.getElementById("regFullName").value.trim();
  const username = document.getElementById("regUsername").value.trim();
  const phone = document.getElementById("regPhone").value.trim();
  const password = document.getElementById("regPassword").value;
  const btn = document.getElementById("btnRegSubmit");
  if (btn) {
    btn.innerText = "Mendaftarkan...";
    btn.disabled = true;
  }

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, username: username, phone: phone, password: password })
    });
    const data = await res.json();
    if (!res.ok) {
      await showAppAlert(data.detail || "Registrasi gagal!", { title: "Pendaftaran Gagal", type: "error" });
      if (btn) {
        btn.innerText = "Daftar & Dapatkan Saldo Rp 150.000 ➜";
        btn.disabled = false;
      }
      return;
    }

    await showAppAlert(`Selamat datang, ${data.full_name}!\nSaldo awal akun Anda: Rp ${data.wallet_balance.toLocaleString('id-ID')}`, { title: "Pendaftaran Berhasil", type: "success" });
    localStorage.setItem("voltx_user", JSON.stringify(data));
    if (btn) {
      btn.innerText = "Daftar & Dapatkan Saldo Rp 150.000 ➜";
      btn.disabled = false;
    }
    await initDriverApp();
  } catch (err) {
    await showAppAlert("Gagal registrasi: " + err, { title: "Error Registrasi", type: "error" });
    if (btn) {
      btn.innerText = "Daftar & Dapatkan Saldo Rp 150.000 ➜";
      btn.disabled = false;
    }
  }
}

async function logoutUser() {
  if (activeSessionId) {
    const ok = await showAppConfirm("Anda sedang memiliki sesi pengisian aktif!\nJika Anda keluar, pengisian tetap berjalan di stasiun. Yakin ingin keluar akun?", { title: "Sesi Pengisian Aktif", type: "warning", confirmText: "Ya, Keluar", cancelText: "Batal" });
    if (!ok) return;
  }

  closeReceiptModal();
  if (selectedConnector && selectedConnector.locked_by_user_id === USER_ID) {
    releaseNozzleClaim(selectedConnector.id);
  }

  localStorage.removeItem("voltx_user");
  currentUser = null;
  activeSessionId = null;
  selectedConnector = null;
  isPlugged = false;

  // Clean DOM view states
  document.getElementById("activeChargingView").style.display = "none";
  document.getElementById("step2View").style.display = "none";
  document.getElementById("step3View").style.display = "none";
  document.getElementById("step1View").style.display = "block";
  document.getElementById("wizardStepHeader").style.display = "flex";

  document.getElementById("authView").style.display = "block";
  document.getElementById("driverAppView").style.display = "none";
}

// Check if user has active session
async function checkUserActiveSession(userId) {
  try {
    const res = await fetch(`/api/station/user-active-session/${userId}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error("Gagal periksa sesi aktif user:", err);
  }
  return { has_active_session: false };
}

function restoreActiveSessionView(sessionData) {
  activeSessionId = sessionData.session_id;
  selectedConnector = stationConnectors.find(c => c.id === sessionData.connector_id) || {
    id: sessionData.connector_id,
    name: sessionData.connector_name,
    max_power_kw: (sessionData.current_power_w / 1000) || 22.0
  };

  // Hide wizard and steps
  document.getElementById("step1View").style.display = "none";
  document.getElementById("step2View").style.display = "none";
  document.getElementById("step3View").style.display = "none";
  document.getElementById("wizardStepHeader").style.display = "none";

  // Show active view
  document.getElementById("activeChargingView").style.display = "block";

  // Populate live stats
  document.getElementById("driverLiveSoc").innerText = `${sessionData.current_soc.toFixed(1)}%`;
  const wattElem = document.getElementById("driverLiveWatt") || document.getElementById("driverLiveKw");
  if (wattElem) {
    const liveW = sessionData.current_power_w !== undefined ? sessionData.current_power_w : ((sessionData.current_power_kw || 0.033) * 1000);
    wattElem.innerText = `${liveW.toFixed(1)} W`;
  }
  const mahElem = document.getElementById("driverLiveMah") || document.getElementById("driverLiveKwh");
  if (mahElem) mahElem.innerText = `${(sessionData.energy_delivered_mah || 0).toLocaleString('id-ID')} mAh`;
  document.getElementById("driverLiveCost").innerText = `Rp ${sessionData.current_cost.toLocaleString('id-ID')}`;
  document.getElementById("driverLiveRemaining").innerText = `Rp ${sessionData.remaining_deposit.toLocaleString('id-ID')}`;
  document.getElementById("driverLiveDeposit").innerText = `Rp ${sessionData.deposit_paid.toLocaleString('id-ID')}`;
}

// -------------------------------------------------------------
// QR SCANNER & NOZZLE EXCLUSIVITY
// -------------------------------------------------------------
let html5QrScanner = null;
let isQrScannerOpen = false;

async function openQrScannerModal() {
  const modal = document.getElementById("qrScannerModal");
  if (!modal) return;
  modal.classList.add("open");
  isQrScannerOpen = true;

  const loadingElem = document.getElementById("qrCameraLoading");
  if (loadingElem) {
    loadingElem.style.display = "block";
    loadingElem.innerText = "Menginisialisasi kamera...";
  }
  const statusMsg = document.getElementById("qrScanStatusMsg");
  if (statusMsg) statusMsg.innerText = "Menginisialisasi kamera HP...";

  if (typeof Html5Qrcode !== "undefined") {
    try {
      if (!html5QrScanner) {
        html5QrScanner = new Html5Qrcode("qrCameraReader");
      }
      await html5QrScanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrboxSize = Math.floor(minEdge * 0.72);
            return { width: Math.max(160, qrboxSize), height: Math.max(160, qrboxSize) };
          }
        },
        (decodedText) => {
          handleQrCodeScanSuccess(decodedText);
        },
        () => {} // frame error ignore
      );
      if (loadingElem) loadingElem.style.display = "none";
      if (statusMsg) statusMsg.innerText = "Arahkan kamera ke QR Code Nozzle di Kiosk SPKLU";
    } catch (err) {
      console.warn("Kamera tidak dapat diakses atau diblokir:", err);
      if (loadingElem) {
        loadingElem.style.display = "block";
        loadingElem.innerHTML = "📷 Kamera tidak aktif / izin belum diberikan.<br><span style='font-size:0.75rem; color:#94A3B8;'>Pastikan Anda memberikan izin akses kamera pada browser Anda.</span>";
      }
      if (statusMsg) statusMsg.innerText = "Izin kamera diperlukan untuk memindai QR Code";
    }
  } else {
    if (loadingElem) {
      loadingElem.style.display = "block";
      loadingElem.innerHTML = "Scanner QR tidak dapat dimuat.";
    }
  }
}

async function closeQrScannerModal() {
  const modal = document.getElementById("qrScannerModal");
  if (modal) modal.classList.remove("open");
  isQrScannerOpen = false;

  if (html5QrScanner) {
    try {
      if (html5QrScanner.isScanning) {
        await html5QrScanner.stop();
      }
    } catch (e) {
      console.warn("Error stopping scanner:", e);
    }
  }
}

function handleQrCodeScanSuccess(decodedText) {
  if (!decodedText) return;

  // Extract nozzle number from text or URL (e.g. "/driver?nozzle=2", "http://.../driver?nozzle=1", or "2")
  let nozzleNum = null;
  const match = decodedText.match(/nozzle=(\d+)/i);
  if (match) {
    nozzleNum = parseInt(match[1]);
  } else {
    const directNum = parseInt(decodedText.trim());
    if (!isNaN(directNum) && directNum >= 1 && directNum <= 10) {
      nozzleNum = directNum;
    }
  }

  if (nozzleNum) {
    handleScannedNozzle(nozzleNum);
  } else {
    showAppAlert(`QR Code terdeteksi (${decodedText}), namun bukan format QR Nozzle SPKLU yang valid!`, {
      title: "QR Tidak Valid",
      type: "warning"
    });
  }
}

function showPendingNozzleUI(target) {
  if (!target) return;
  const pendingCard = document.getElementById("pendingNozzleCard");
  const pendingName = document.getElementById("pendingNozzleName");
  const pendingDesc = document.getElementById("pendingNozzleDesc");
  if (pendingName) {
    pendingName.innerText = `${target.name} (${target.connector_type} • Max ${Math.round(target.max_power_kw * 1000).toLocaleString('id-ID')} W)`;
  }
  if (pendingDesc) {
    pendingDesc.innerHTML = `🔌 Silakan ambil nozzle <b>${target.name}</b> dari totem SPKLU dan hubungkan kabel ke HP Anda.`;
  }
  if (pendingCard) {
    pendingCard.style.display = "block";
  }
  const heroCard = document.getElementById("scanHeroCard");
  if (heroCard) {
    heroCard.style.display = "none";
  }
}

function cancelPendingNozzle(resetSim = true) {
  pendingNozzleConnector = null;
  if (resetSim) isSimulatedMode = false;
  const pendingCard = document.getElementById("pendingNozzleCard");
  if (pendingCard) {
    pendingCard.style.display = "none";
  }
  const heroCard = document.getElementById("scanHeroCard");
  if (heroCard) {
    heroCard.style.display = "block";
  }
}

async function simulatePlugCable() {
  const target = pendingNozzleConnector || selectedConnector;
  if (!target) {
    await showAppAlert("Tidak ada nozzle yang sedang dipilih!", {
      title: "Peringatan",
      type: "warning"
    });
    return;
  }

  const btn = document.getElementById("btnSimulatePlug");
  const origHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>⏳</span> Menghubungkan kabel...`;
  }

  try {
    // 1. Tell backend to mark nozzle as CONNECTED (simulated)
    const plugRes = await fetch(`/api/station/connector/${target.id}/plug`, {
      method: "POST"
    });
    if (!plugRes.ok) {
      const errData = await plugRes.json().catch(() => ({}));
      throw new Error(errData.detail || "Gagal mencolokkan kabel");
    }

    isSimulatedMode = true;
    isPlugged = true;
    selectedConnector = target;

    // 2. Claim nozzle exclusively for current user
    const claimed = await claimNozzle(target.id, true);
    if (!claimed) {
      throw new Error("Gagal mengklaim nozzle");
    }

    // 3. Update battery & USB badge UI
    const badge = document.getElementById("usbDetectBadge");
    if (badge) {
      badge.className = "status-pill busy";
      badge.innerHTML = `⚡ Mode Simulasi: Kabel ${target.name} Terhubung!`;
    }

    const desktopAdbBadge = document.getElementById("desktopAdbStatus");
    if (desktopAdbBadge) {
      desktopAdbBadge.className = "status-pill busy";
      desktopAdbBadge.innerText = `⚡ Kabel Tercolok (Simulasi)`;
    }

    const carBatteryStatus = document.getElementById("carBatteryStatus");
    if (carBatteryStatus && selectedVehicle) {
      const soc = selectedVehicle.current_soc;
      const currentMah = Math.round((soc / 100) * TOTAL_PHONE_BATTERY_MAH);
      carBatteryStatus.innerText = `${soc}% (${currentMah.toLocaleString('id-ID')} / ${TOTAL_PHONE_BATTERY_MAH.toLocaleString('id-ID')} mAh) - Siap Cas`;
    }

    // 4. Hide pending card and navigate smoothly to Step 2
    cancelPendingNozzle(false);
    isSimulatedMode = true;
    goToStep(2);

    // 5. Notify user and explain next steps
    await showAppAlert(
      `Kabel ${target.name} berhasil terhubung (Mode Simulasi)!\n\nSilakan tentukan Target Cas Anda untuk melanjutkan ke Pembayaran.`,
      {
        title: "Kabel Terhubung!",
        subtitle: `🔌 ${target.name} (Simulasi)`,
        type: "success",
        confirmText: "Lanjut ke Target Cas"
      }
    );

    await loadStationData();
  } catch (err) {
    console.error("Simulation plug error:", err);
    await showAppAlert("Terjadi kendala saat simulasi colok kabel: " + (err.message || err), {
      title: "Gagal Simulasi",
      type: "error"
    });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}

async function handleScannedNozzle(nozzleNumber) {
  await closeQrScannerModal();

  // Clear query params immediately so reloads don't re-trigger unexpectedly
  if (window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Fetch fresh station state from server
  await loadStationData();

  // Find matching connector in station
  const target = stationConnectors.find(c => c.connector_number === nozzleNumber || c.id === nozzleNumber);
  if (!target) {
    await showAppAlert(`Nozzle #${nozzleNumber} tidak ditemukan di stasiun ini!`, {
      title: "Nozzle Tidak Ditemukan",
      type: "error"
    });
    return;
  }

  // Guard: if nozzle is currently in an active charging session
  if (target.status === "CHARGING") {
    await showAppAlert(`${target.name} saat ini sedang digunakan untuk pengisian daya!\nSilakan gunakan nozzle lain yang tersedia.`, {
      title: "Nozzle Sedang Mengisi",
      type: "warning"
    });
    return;
  }

  // Guard: if nozzle is locked/claimed by another driver
  if (target.locked_by_user_id && target.locked_by_user_id !== USER_ID) {
    await showAppAlert(`${target.name} sedang diklaim atau digunakan oleh pengguna lain!\nSilakan scan nozzle lain yang masih tersedia.`, {
      title: "Nozzle Sedang Diklaim",
      type: "warning"
    });
    return;
  }

  // Check physical connection status
  if (target.status === "AVAILABLE") {
    // Enter pending nozzle waiting state (regardless of whether another port is plugged or not)
    selectedConnector = null;
    pendingNozzleConnector = target;
    showPendingNozzleUI(target);
    await showAppAlert(
      `Silakan hubungkan kabel ${target.name} ke HP Anda.\n\nSistem akan otomatis melanjutkan ke Target Cas begitu kabel ${target.name} terhubung.`,
      {
        title: "Hubungkan Kabel Nozzle",
        subtitle: `🔌 ${target.name}`,
        type: "info",
        confirmText: "Mengerti"
      }
    );
    goToStep(1);
    return;
  }

  // Cable already plugged into target nozzle (CONNECTED) -> claim nozzle exclusively and jump directly to Step 2 (Target Cas)!
  cancelPendingNozzle();
  selectedConnector = target;
  const claimSuccess = await claimNozzle(target.id, true);
  if (claimSuccess) {
    goToStep(2);
  }
}

// Nozzle Claim & Exclusivity Helpers
async function claimNozzle(connectorId, isFromQr = false) {
  if (!connectorId || !USER_ID) return false;
  try {
    const res = await fetch(`/api/station/connector/${connectorId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: USER_ID })
    });
    const data = await res.json();
    if (!res.ok) {
      await showAppAlert(data.detail || "Gagal mengklaim nozzle!", {
        title: "Klaim Gagal",
        type: "error"
      });
      return false;
    }
    const updated = stationConnectors.find(c => c.id === connectorId);
    if (updated) {
      updated.locked_by_user_id = USER_ID;
      selectedConnector = updated;
    }
    isPlugged = true;
    return true;
  } catch (err) {
    await showAppAlert("Koneksi gagal saat mengklaim nozzle: " + err, {
      title: "Koneksi Bermasalah",
      type: "error"
    });
    return false;
  }
}

async function releaseNozzleClaim(connectorId) {
  if (!connectorId || !USER_ID) return;
  try {
    await fetch(`/api/station/connector/${connectorId}/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: USER_ID })
    });
    const updated = stationConnectors.find(c => c.id === connectorId);
    if (updated && updated.locked_by_user_id === USER_ID) {
      updated.locked_by_user_id = null;
    }
  } catch (err) {
    console.warn("Gagal melepas nozzle claim:", err);
  }
}

// Initial Load
async function initDriverApp() {
  const storedUser = localStorage.getItem("voltx_user");
  if (!storedUser) {
    document.getElementById("authView").style.display = "block";
    document.getElementById("driverAppView").style.display = "none";
    return;
  }

  try {
    currentUser = JSON.parse(storedUser);
    USER_ID = currentUser.id;
  } catch (e) {
    localStorage.removeItem("voltx_user");
    document.getElementById("authView").style.display = "block";
    document.getElementById("driverAppView").style.display = "none";
    return;
  }

  document.getElementById("authView").style.display = "none";
  document.getElementById("driverAppView").style.display = "flex";

  await loadUserData();
  await loadStationData();
  setupWebSocket();
  fetchAdbBatteryInitial();
  loadDevPortStatus();

  // CHECK ACTIVE CHARGING SESSION (FOR STATE RECOVERY ON REFRESH)
  const active = await checkUserActiveSession(USER_ID);
  if (active && active.has_active_session) {
    restoreActiveSessionView(active);
  } else {
    document.getElementById("wizardStepHeader").style.display = "flex";

    // Cek apakah driver datang dari scan QR Nozzle khusus (?nozzle=1, ?nozzle=2, ?nozzle=3)
    const urlParams = new URLSearchParams(window.location.search);
    const nozzleNum = urlParams.get("nozzle");
    if (nozzleNum) {
      await handleScannedNozzle(parseInt(nozzleNum));
      return;
    }
    goToStep(1);
  }
}

// Wizard Step Navigation
function goToStep(step) {
  currentStep = step;

  if (step >= 2) {
    cancelPendingNozzle(false);
  }

  // If returning to step 1 without active charging, release nozzle claim & lock
  if (step === 1 && !activeSessionId) {
    if (selectedConnector && selectedConnector.locked_by_user_id === USER_ID) {
      releaseNozzleClaim(selectedConnector.id);
    }
    if (isPlugged) {
      isPlugged = false;
      autoHandleUsbUnplugged();
    }
    isSimulatedMode = false;
    selectedConnector = null;
  }

  // Connected device status card only displays once connected (Step 2 & 3)
  const deviceCard = document.getElementById("connectedDeviceCard");
  if (deviceCard) {
    deviceCard.style.display = step >= 2 ? "block" : "none";
  }

  // Views
  document.getElementById("step1View").style.display = step === 1 ? "block" : "none";
  document.getElementById("step2View").style.display = step === 2 ? "block" : "none";
  document.getElementById("step3View").style.display = step === 3 ? "block" : "none";
  document.getElementById("activeChargingView").style.display = "none";

  // Step Tabs Highlighting
  document.getElementById("stepTab1").className = `step-pill ${step >= 1 ? 'active' : ''}`;
  document.getElementById("stepTab2").className = `step-pill ${step >= 2 ? 'active' : ''}`;
  document.getElementById("stepTab3").className = `step-pill ${step >= 3 ? 'active' : ''}`;

  document.getElementById("stepLine1").className = `step-line ${step >= 2 ? 'active' : ''}`;
  document.getElementById("stepLine2").className = `step-line ${step >= 3 ? 'active' : ''}`;

  if (step === 2) {
    if (selectedConnector) {
      document.getElementById("step2NozzleName").innerText = `${selectedConnector.name} (Max ${Math.round(selectedConnector.max_power_kw * 1000).toLocaleString('id-ID')} W)`;
    }
    updateCarDisplay();
    updateEstimate();
  }

  if (step === 3 && currentEstimate) {
    document.getElementById("payDepositAmountText").innerText = `Rp ${currentEstimate.estimated_cost.toLocaleString('id-ID')}`;
    setPaymentMethod(paymentMethod);
  }
}

async function loadUserData() {
  try {
    const [userRes, vehiclesRes, cardsRes] = await Promise.all([
      fetch(`/api/auth/user/${USER_ID}`),
      fetch(`/api/auth/vehicles/${USER_ID}`),
      fetch(`/api/auth/cards/${USER_ID}`)
    ]);

    currentUser = await userRes.json();
    userVehicles = await vehiclesRes.json();
    userCards = await cardsRes.json();

    document.getElementById("userBalanceText").innerText = currentUser.wallet_balance.toLocaleString("id-ID");
    document.getElementById("walletBalDesc").innerText = currentUser.wallet_balance.toLocaleString("id-ID");
    document.getElementById("driverName").innerText = currentUser.full_name;

    const headerName = document.getElementById("headerDriverName");
    if (headerName) headerName.innerText = currentUser.full_name;
    const headerRole = document.getElementById("headerRoleBadge");
    if (headerRole) {
      headerRole.innerText = currentUser.role || "DRIVER";
      headerRole.className = currentUser.role === "OPERATOR" ? "status-pill busy" : "status-pill online";
    }

    // Auto-select Smartphone Vehicle (No car dropdown)
    selectedVehicle = userVehicles.find(v => v.brand === "Smartphone") || userVehicles[0];
    if (selectedVehicle) {
      updateCarDisplay();
    }

    renderEmoneyCards();
  } catch (err) {
    console.error("Gagal load data user:", err);
  }
}

function updateCarDisplay() {
  if (!selectedVehicle) return;
  const soc = selectedVehicle.current_soc;
  const currentMah = Math.round((soc / 100) * TOTAL_PHONE_BATTERY_MAH);
  const remainingMah = Math.max(0, TOTAL_PHONE_BATTERY_MAH - currentMah);

  const labelElem = document.getElementById("batteryLabelText");
  if (labelElem) {
    labelElem.innerText = "📱 Baterai HP Fisik (ADB)";
  }

  const statusElem = document.getElementById("carBatteryStatus");
  if (statusElem) {
    statusElem.innerText = `${soc}% (${currentMah.toLocaleString('id-ID')} / ${TOTAL_PHONE_BATTERY_MAH.toLocaleString('id-ID')} mAh)`;
  }

  const barElem = document.getElementById("carBatteryBar");
  if (barElem) {
    barElem.style.width = `${soc}%`;
  }

  // Update max input attribute and hint for manual mAh input based on remaining power
  const inputElem = document.getElementById("inputManualMah") || document.getElementById("inputManualKwh");
  const hintElem = document.getElementById("maxManualMahHint");
  if (inputElem) {
    inputElem.max = remainingMah;
    const currentVal = parseInt(inputElem.value) || 0;
    if (currentVal > remainingMah || currentVal === 15 || currentVal === 0) {
      inputElem.value = Math.min(1000, remainingMah);
    }
  }
  if (hintElem) {
    hintElem.innerText = `Max: ${remainingMah.toLocaleString('id-ID')} mAh`;
  }

  // Update target summary in Step 2 if open
  const targetDesc = document.getElementById("targetModeSummary");
  if (targetDesc) {
    if (targetMode === 'FULL') {
      targetDesc.innerText = `🎯 Mengisi baterai HP dari ${soc}% menuju 100% penuh (+${remainingMah.toLocaleString('id-ID')} mAh)`;
    } else {
      const manualVal = parseInt((document.getElementById("inputManualMah") || document.getElementById("inputManualKwh"))?.value) || 1000;
      const targetSoc = Math.min(100, Math.round(soc + (manualVal / TOTAL_PHONE_BATTERY_MAH * 100)));
      targetDesc.innerText = `🎯 Target manual: +${manualVal.toLocaleString('id-ID')} mAh (Baterai akan menjadi ${targetSoc}%)`;
    }
  }

  if (currentStep === 2) updateEstimate();
}

function onManualMahChanged() {
  const soc = selectedVehicle ? selectedVehicle.current_soc : 50;
  const currentMah = Math.round((soc / 100) * TOTAL_PHONE_BATTERY_MAH);
  const remainingMah = Math.max(0, TOTAL_PHONE_BATTERY_MAH - currentMah);
  const inputElem = document.getElementById("inputManualMah") || document.getElementById("inputManualKwh");
  const warnElem = document.getElementById("manualMahWarning");

  let val = parseInt(inputElem.value) || 0;
  if (val > remainingMah) {
    val = remainingMah;
    inputElem.value = remainingMah;
    if (warnElem) warnElem.style.display = "block";
  } else {
    if (warnElem) warnElem.style.display = "none";
  }

  const targetDesc = document.getElementById("targetModeSummary");
  if (targetDesc && targetMode !== 'FULL') {
    const targetSoc = Math.min(100, Math.round(soc + (val / TOTAL_PHONE_BATTERY_MAH * 100)));
    targetDesc.innerText = `🎯 Target manual: +${val.toLocaleString('id-ID')} mAh (Baterai akan menjadi ${targetSoc}%)`;
  }

  updateEstimate();
}

function renderEmoneyCards() {
  const select = document.getElementById("emoneyCardSelect");
  const modalSelect = document.getElementById("modalEmoneyCardSelect");
  if (select) select.innerHTML = "";
  if (modalSelect) modalSelect.innerHTML = "";

  userCards.forEach(card => {
    const opt = document.createElement("option");
    opt.value = card.card_uid;
    opt.innerText = `${card.card_name} (${card.card_uid}) - Saldo: Rp ${card.balance.toLocaleString('id-ID')}`;
    if (select) select.appendChild(opt);

    if (modalSelect) {
      const optModal = document.createElement("option");
      optModal.value = card.card_uid;
      optModal.innerText = `${card.card_name} - Saldo: Rp ${card.balance.toLocaleString('id-ID')}`;
      modalSelect.appendChild(optModal);
    }
  });
}

// Station & Connectors
async function loadStationData() {
  try {
    const res = await fetch(`/api/station/${STATION_CODE}`);
    const data = await res.json();
    stationConnectors = data.connectors;

    if (currentStep >= 2 && selectedConnector) {
      const updated = stationConnectors.find(c => c.id === selectedConnector.id);
      if (updated) selectedConnector = updated;
    }
  } catch (err) {
    console.error("Gagal load station:", err);
  }
}

// -------------------------------------------------------------
// SENSOR OTOMATIS BATERAI HP ASLI (VIA ADB MONITOR)
// -------------------------------------------------------------
async function fetchAdbBatteryInitial() {
  try {
    const res = await fetch("/api/station/adb-battery");
    const data = await res.json();
    if (data && data.connected) {
      handleAdbBatteryUpdate(data);
    } else {
      handleAdbBatteryDisconnected();
    }
  } catch (err) {
    console.log("Initial ADB fetch skipped:", err);
    handleAdbBatteryDisconnected();
  }
}

function handleAdbBatteryDisconnected() {
  if (isSimulatedMode) {
    return;
  }
  adbBatteryState = { connected: false };
  isPlugged = false;

  const badge = document.getElementById("usbDetectBadge");
  if (badge) {
    badge.className = "status-pill warning";
    badge.innerHTML = "📱 Kabel USB Belum Tercolok (Standby)";
  }

  const phoneBatteryElem = document.getElementById("phoneStatusBarBattery");
  if (phoneBatteryElem) {
    const soc = selectedVehicle ? selectedVehicle.current_soc : 45;
    phoneBatteryElem.innerText = `🔋 ${soc}%`;
  }

  const desktopAdbBadge = document.getElementById("desktopAdbStatus");
  if (desktopAdbBadge) {
    desktopAdbBadge.className = "status-pill warning";
    desktopAdbBadge.innerText = "📱 Status Kabel: Belum Tercolok";
  }

  const carBatteryStatus = document.getElementById("carBatteryStatus");
  if (carBatteryStatus) {
    const soc = selectedVehicle ? selectedVehicle.current_soc : 45;
    carBatteryStatus.innerText = `${soc}% (Standby / Belum Colok)`;
  }

  // If user had moved to Step 2 or 3 without starting charging, return to Step 1 and ask to plug again
  if ((currentStep === 2 || currentStep === 3) && !activeSessionId) {
    if (selectedConnector) {
      pendingNozzleConnector = selectedConnector;
    }
    selectedConnector = null;
    goToStep(1);
    if (pendingNozzleConnector) {
      showPendingNozzleUI(pendingNozzleConnector);
    }
  }

  loadStationData();
}

function handleAdbBatteryUpdate(data) {
  adbBatteryState = data;
  const level = data.level;
  const isPluggedIn = data.usb_powered || data.ac_powered || data.is_charging;

  // Update vehicle SoC from real phone battery level
  if (selectedVehicle) {
    selectedVehicle.current_soc = level;
    updateCarDisplay();

    // Sync to backend DB
    fetch(`/api/station/vehicle/${selectedVehicle.id}/soc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soc: level })
    }).catch(() => {});

    // If active charging session, sync live session
    if (activeSessionId) {
      fetch(`/api/station/session/${activeSessionId}/sync-battery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soc: level })
      }).catch(() => {});
    }
  }

  const badge = document.getElementById("usbDetectBadge");
  if (badge) {
    badge.style.display = "flex";
    const tempC = data.temperature ? (data.temperature / 10).toFixed(1) : "32.0";
    const volt = data.voltage ? `${data.voltage} mV` : "";
    if (isPluggedIn) {
      badge.className = "status-pill busy";
      badge.innerHTML = `⚡ USB TERHUBUNG! Baterai HP: ${level}% • Suhu: ${tempC}°C • ${volt}`;
    } else {
      badge.className = "status-pill warning";
      badge.innerHTML = `📱 Baterai HP: ${level}% • USB Belum Tercolok`;
    }
  }

  // Sync to phone frame status bar and desktop presenter board
  const phoneBatteryElem = document.getElementById("phoneStatusBarBattery");
  if (phoneBatteryElem) {
    phoneBatteryElem.innerText = `${isPluggedIn ? '⚡' : '🔋'} ${level}%`;
  }
  const desktopAdbBadge = document.getElementById("desktopAdbStatus");
  if (desktopAdbBadge) {
    if (isPluggedIn) {
      desktopAdbBadge.className = "status-pill busy";
      desktopAdbBadge.innerText = `⚡ ADB USB Connected (${level}%)`;
    } else {
      desktopAdbBadge.className = "status-pill online";
      desktopAdbBadge.innerText = `📱 ADB Standby (${level}%)`;
    }
  }
}

async function autoHandleUsbUnplugged() {
  if (!selectedConnector) return;
  try {
    if (USER_ID && selectedConnector.locked_by_user_id === USER_ID) {
      await releaseNozzleClaim(selectedConnector.id);
    }
    await fetch(`/api/station/connector/${selectedConnector.id}/unplug`, { method: "POST" });
    isPlugged = false;
    isSimulatedMode = false;
    loadStationData();
  } catch (err) {
    console.error("Gagal auto unplug:", err);
  }
}


// Target Mode & Estimate
function selectTargetMode(mode) {
  targetMode = (mode === 'MANUAL_MAH' || mode === 'MANUAL_KWH') ? 'MANUAL_MAH' : 'FULL';
  document.getElementById("tabFull").className = `tab-btn ${targetMode === 'FULL' ? 'active' : ''}`;
  document.getElementById("tabManual").className = `tab-btn ${targetMode === 'MANUAL_MAH' ? 'active' : ''}`;
  const box = document.getElementById("manualMahBox") || document.getElementById("manualKwhBox");
  if (box) box.style.display = targetMode === 'MANUAL_MAH' ? 'block' : 'none';
  updateCarDisplay();
  updateEstimate();
}

async function updateEstimate() {
  if (!selectedVehicle || !selectedConnector) return;

  const manualMah = parseInt((document.getElementById("inputManualMah") || document.getElementById("inputManualKwh"))?.value) || 1000;
  const manualKwh = (manualMah / TOTAL_PHONE_BATTERY_MAH) * 0.02;

  try {
    const res = await fetch("/api/station/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicle_id: selectedVehicle.id,
        connector_id: selectedConnector.id,
        target_type: targetMode === 'MANUAL_MAH' ? 'MANUAL_KWH' : targetMode,
        manual_kwh: manualKwh,
        manual_mah: manualMah,
        custom_target_soc: 100.0
      })
    });

    currentEstimate = await res.json();

    const neededMah = currentEstimate.energy_needed_mah || Math.round((currentEstimate.energy_needed_kwh / 0.02) * TOTAL_PHONE_BATTERY_MAH);
    document.getElementById("estEnergy").innerText = `${neededMah.toLocaleString('id-ID')} mAh`;
    document.getElementById("estTariff").innerText = `Rp ${currentEstimate.tariff_per_kwh.toLocaleString('id-ID')} / 500 mAh`;
    document.getElementById("estDuration").innerText = `${currentEstimate.estimated_duration_minutes} Menit`;
    document.getElementById("estTotalDeposit").innerText = `Rp ${currentEstimate.estimated_cost.toLocaleString('id-ID')}`;
    document.getElementById("qrisAmountText").innerText = `Rp ${currentEstimate.estimated_cost.toLocaleString('id-ID')}`;
  } catch (err) {
    console.error("Gagal kalkulasi estimasi:", err);
  }
}

// Payment Method Selection
function setPaymentMethod(method) {
  paymentMethod = method;
  document.getElementById("payTabWallet").className = `tab-btn ${method === 'WALLET' ? 'active' : ''}`;
  document.getElementById("payTabQris").className = `tab-btn ${method === 'QRIS' ? 'active' : ''}`;
  document.getElementById("payTabEmoney").className = `tab-btn ${method === 'EMONEY' ? 'active' : ''}`;

  document.getElementById("payContentWallet").style.display = method === 'WALLET' ? 'block' : 'none';
  document.getElementById("payContentQris").style.display = method === 'QRIS' ? 'block' : 'none';
  document.getElementById("payContentEmoney").style.display = method === 'EMONEY' ? 'block' : 'none';

  const btnStart = document.getElementById("btnStartCharging");
  if (btnStart) {
    if (method === "EMONEY") {
      btnStart.innerHTML = "💳 TAP KARTU & CAS SEKARANG";
    } else {
      btnStart.innerHTML = "⚡ MULAI CAS SEKARANG";
    }
  }

  if (method === 'QRIS' && currentEstimate) {
    renderQrisCode(currentEstimate.estimated_cost);
  }
}

function renderQrisCode(amount) {
  const container = document.getElementById("driverQrisCode");
  container.innerHTML = "";
  if (typeof QRCode !== "undefined") {
    new QRCode(container, {
      text: `00020101021226600016ID.CO.VOLTX.WWW0118936009110000000001520458125303360540${amount}5802ID5914VOLTX CHARGING6007JAKARTA`,
      width: 140,
      height: 140,
      colorDark: "#0B0F19",
      colorLight: "#FFFFFF",
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    container.innerHTML = `<div style="padding:16px; color:#080C14; font-weight:800; font-size:1rem;">QRIS SIMULASI<br>Rp ${amount.toLocaleString('id-ID')}</div>`;
  }
}

// -------------------------------------------------------------
// E-MONEY RFID MODAL & TAP SIMULATION (DRIVER DEMO)
// -------------------------------------------------------------
let emoneyTapTimeout = null;

function openEmoneyTapModal() {
  if (!currentEstimate || currentEstimate.estimated_cost <= 0) {
    showAppAlert("Baterai HP sudah penuh sesuai target pengisian!", {
      title: "Baterai Penuh",
      type: "info"
    });
    return;
  }

  if (emoneyTapTimeout) {
    clearTimeout(emoneyTapTimeout);
    emoneyTapTimeout = null;
  }

  // Reset to initial tap prompt
  const promptSec = document.getElementById("emoneyTapPromptSection");
  const detectedSec = document.getElementById("emoneyCardDetectedSection");
  if (promptSec) promptSec.style.display = "block";
  if (detectedSec) detectedSec.style.display = "none";

  const modal = document.getElementById("emoneyTapModal");
  if (modal) modal.classList.add("open");
}

function closeEmoneyTapModal() {
  if (emoneyTapTimeout) {
    clearTimeout(emoneyTapTimeout);
    emoneyTapTimeout = null;
  }
  const modal = document.getElementById("emoneyTapModal");
  if (modal) modal.classList.remove("open");
}

async function triggerEmoneyCardTap() {
  const promptSec = document.getElementById("emoneyTapPromptSection");
  const detectedSec = document.getElementById("emoneyCardDetectedSection");
  if (promptSec) promptSec.style.display = "none";
  if (detectedSec) detectedSec.style.display = "block";

  // Reference card matching user screenshot
  const demoCardUid = "BCA-6656";
  const demoCardHolder = "BCA Flazz (Demo #6656)";
  const demoCardBalance = 149790;
  const demoCardType = "BCA FLAZZ";

  const cardUidText = document.getElementById("emoneyCardUidText");
  const cardHolder = document.getElementById("emoneyCardHolderText");
  const cardBalance = document.getElementById("emoneyCardBalanceText");
  const cardBadge = document.getElementById("emoneyCardTypeBadge");

  if (cardUidText) cardUidText.innerText = "BCA - 6656";
  if (cardHolder) cardHolder.innerText = demoCardHolder;
  if (cardBalance) cardBalance.innerText = `Rp ${demoCardBalance.toLocaleString('id-ID')}`;
  if (cardBadge) cardBadge.innerText = demoCardType;

  // After 2-second delay: show transaction success alert and proceed automatically to charging!
  emoneyTapTimeout = setTimeout(async () => {
    closeEmoneyTapModal();

    await showAppAlert(
      `Transaksi Berhasil!\n\nPembayaran E-Money telah diverifikasi dengan kartu ${demoCardType} (${demoCardUid}).\nSistem otomatis melanjutkan ke pengisian daya...`,
      {
        title: "Transaksi Berhasil",
        subtitle: `💳 ${demoCardType} - ${demoCardUid}`,
        type: "success",
        confirmText: "Lanjutkan"
      }
    );

    await executeStartCharging(demoCardUid);
  }, 2000);
}

// START CHARGING
async function startChargingProcess() {
  if (!currentEstimate || currentEstimate.estimated_cost <= 0) {
    await showAppAlert("Baterai HP sudah penuh sesuai target pengisian!", {
      title: "Baterai Penuh",
      type: "info"
    });
    return;
  }

  if (paymentMethod === "EMONEY") {
    openEmoneyTapModal();
    return;
  }

  await executeStartCharging(null);
}

async function executeStartCharging(cardUid) {
  const manualMah = parseInt((document.getElementById("inputManualMah") || document.getElementById("inputManualKwh"))?.value) || 1000;
  const manualKwh = (manualMah / TOTAL_PHONE_BATTERY_MAH) * 0.02;

  const payload = {
    user_id: USER_ID,
    station_code: STATION_CODE,
    connector_id: selectedConnector.id,
    vehicle_id: selectedVehicle.id,
    target_type: targetMode === 'MANUAL_MAH' ? 'MANUAL_KWH' : targetMode,
    manual_kwh: manualKwh,
    manual_mah: manualMah,
    target_soc: 100.0,
    payment_method: paymentMethod,
    card_uid: cardUid
  };

  try {
    const res = await fetch("/api/station/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!res.ok) {
      await showAppAlert(result.detail || "Terjadi kesalahan sistem saat memulai pengisian.", {
        title: "Gagal Memulai Pengisian",
        type: "error"
      });
      return;
    }

    activeSessionId = result.session_id;

    // Switch to active charging screen
    document.getElementById("step1View").style.display = "none";
    document.getElementById("step2View").style.display = "none";
    document.getElementById("step3View").style.display = "none";
    document.getElementById("wizardStepHeader").style.display = "none";
    document.getElementById("activeChargingView").style.display = "block";

    document.getElementById("driverLiveDeposit").innerText = `Rp ${result.deposit_paid.toLocaleString('id-ID')}`;

    await loadUserData();
  } catch (err) {
    await showAppAlert("Terjadi kesalahan saat memulai pengisian: " + err, {
      title: "Kesalahan Sistem",
      type: "error"
    });
  }
}

// STOP CHARGING & REFUND
async function stopChargingProcess() {
  if (!activeSessionId) return;

  const ok = await showAppConfirm("Hentikan pengisian sekarang?\nSisa saldo deposit yang tidak terpakai akan otomatis dikembalikan ke akun Anda.", {
    title: "Konfirmasi Stop Pengisian",
    type: "warning",
    confirmText: "Ya, Hentikan",
    cancelText: "Batal"
  });
  if (!ok) return;

  try {
    const res = await fetch("/api/station/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: activeSessionId,
        user_id: USER_ID
      })
    });

    const data = await res.json();
    activeSessionId = null;

    const totalMah = Math.round((data.energy_delivered_kwh / 0.02) * TOTAL_PHONE_BATTERY_MAH);

    // Show Receipt Modal
    document.getElementById("receiptSessionCode").innerText = `#CS-${Date.now().toString().slice(-6)}`;
    const receiptElem = document.getElementById("receiptMah") || document.getElementById("receiptKwh");
    if (receiptElem) receiptElem.innerText = `${totalMah.toLocaleString('id-ID')} mAh`;
    document.getElementById("receiptActualCost").innerText = `Rp ${data.actual_cost.toLocaleString('id-ID')}`;
    document.getElementById("receiptDepositPaid").innerText = document.getElementById("driverLiveDeposit").innerText;
    document.getElementById("receiptRefundAmount").innerText = `Rp ${data.refund_amount.toLocaleString('id-ID')}`;

    document.getElementById("receiptModal").classList.add("open");

    // Reset view
    document.getElementById("wizardStepHeader").style.display = "flex";
    goToStep(1);

    await loadUserData();
    await loadStationData();
  } catch (err) {
    await showAppAlert("Gagal menghentikan pengisian: " + err, {
      title: "Gagal Stop",
      type: "error"
    });
  }
}

function closeReceiptModal() {
  document.getElementById("receiptModal").classList.remove("open");
}

// TOP UP SALDO
function openTopUpModal() {
  document.getElementById("topUpModal").classList.add("open");
}

function closeTopUpModal() {
  document.getElementById("topUpModal").classList.remove("open");
}

async function executeTopUp(amount) {
  try {
    const res = await fetch(`/api/auth/topup/${USER_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amount, method: "QRIS" })
    });
    const data = await res.json();
    await showAppAlert(data.message, {
      title: "Top-Up Berhasil",
      type: "success"
    });
    closeTopUpModal();
    await loadUserData();
  } catch (err) {
    await showAppAlert("Gagal topup: " + err, {
      title: "Top-Up Gagal",
      type: "error"
    });
  }
}

// WebSocket Setup
function setupWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws/station/${STATION_CODE}`;

  ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.event === "PORT_NOZZLE_CONNECTED") {
      isPlugged = true;
      if (!activeSessionId) {
        const target = stationConnectors.find(c => c.id === data.connector_id);

        // CASE A: User is on Step 1 waiting for this pending nozzle!
        if (currentStep === 1 && pendingNozzleConnector) {
          if (pendingNozzleConnector.id === data.connector_id) {
            // MATCH! The expected nozzle was plugged in!
            const matched = target || pendingNozzleConnector;
            cancelPendingNozzle();
            selectedConnector = matched;
            claimNozzle(matched.id, true).then(success => {
              if (success) {
                goToStep(2);
                showAppAlert(`Kabel ${matched.name} berhasil terhubung!\nMelanjutkan ke Target Cas...`, {
                  title: "Kabel Terhubung!",
                  subtitle: `🔌 ${matched.name}`,
                  type: "success"
                });
              }
            });
            loadStationData();
            return;
          } else {
            // MISMATCH in real-time: Driver is waiting for pendingNozzleConnector, but another port was plugged!
            // STRICT ANTI-DISTRACTION: Stay on Step 1, DO NOT advance to Step 2!
            // Keep UI completely clean and calm: stay in the pending waiting state without noisy warning text!
            loadStationData();
            return;
          }
        }

        // Only sync if selectedConnector was ALREADY set to this nozzle (prevents hijacking)
        if (target && selectedConnector && selectedConnector.id === target.id) {
          selectedConnector = target;
        }
        const badge = document.getElementById("usbDetectBadge");
        if (badge) {
          badge.className = "status-pill busy";
          badge.innerHTML = `⚡ Terdeteksi di ${data.port_key || 'Port USB'} ➜ ${data.connector_name} Tercolok!`;
        }
      }
      loadStationData();
    } else if (data.event === "PORT_NOZZLE_RECONFIGURED") {
      updateDevPortButtons(data.connector_id);
      loadStationData();
    } else if (data.event === "ADB_BATTERY_UPDATE") {
      handleAdbBatteryUpdate(data);
    } else if (data.event === "ADB_BATTERY_DISCONNECTED") {
      handleAdbBatteryDisconnected();
    } else if (data.event === "ADB_BATTERY_UNAUTHORIZED") {
      adbBatteryState = { connected: true, unauthorized: true };
      const badge = document.getElementById("usbDetectBadge");
      if (badge) {
        badge.className = "status-pill warning";
        badge.innerHTML = "⚠️ HP tercolok tapi belum diizinkan. Cek notifikasi 'Izinkan Debugging USB' di layar HP!";
      }
      const desktopAdbBadge = document.getElementById("desktopAdbStatus");
      if (desktopAdbBadge) {
        desktopAdbBadge.className = "status-pill warning";
        desktopAdbBadge.innerText = "⚠️ HP Tercolok (Perlu Izin USB)";
      }
    } else if (data.event === "NOZZLE_PLUGGED") {
      loadStationData();
    } else if (data.event === "NOZZLE_UNPLUGGED") {
      loadStationData();
      if (!isSimulatedMode && selectedConnector && selectedConnector.id === data.connector_id) {
        handleAdbBatteryDisconnected();
      }
    } else if (data.event === "TELEMETRY_UPDATE" && activeSessionId === data.session_id) {
      document.getElementById("driverLiveSoc").innerText = `${data.current_soc.toFixed(1)}%`;
      const watts = data.current_power_w ? data.current_power_w.toFixed(1) : (data.current_power_kw ? (data.current_power_kw * 1000).toFixed(1) : "33.0");
      const wattElem = document.getElementById("driverLiveWatt") || document.getElementById("driverLiveKw");
      if (wattElem) wattElem.innerText = `${watts} W`;
      const deliveredMah = data.energy_delivered_mah || Math.round((data.energy_delivered_kwh / 0.02) * TOTAL_PHONE_BATTERY_MAH);
      const mahElem = document.getElementById("driverLiveMah") || document.getElementById("driverLiveKwh");
      if (mahElem) mahElem.innerText = `${deliveredMah.toLocaleString('id-ID')} mAh`;
      document.getElementById("driverLiveCost").innerText = `Rp ${data.current_cost.toLocaleString('id-ID')}`;
      document.getElementById("driverLiveRemaining").innerText = `Rp ${data.remaining_deposit.toLocaleString('id-ID')}`;
    } else if (data.event === "SESSION_COMPLETED") {
      loadStationData();
      if (activeSessionId === data.session_id) {
        activeSessionId = null;
        isSimulatedMode = false;
        isPlugged = false;
        const totalMah = data.total_energy_mah || Math.round((data.total_energy_kwh / 0.02) * TOTAL_PHONE_BATTERY_MAH);
        document.getElementById("receiptSessionCode").innerText = `#${data.session_code}`;
        const receiptElem = document.getElementById("receiptMah") || document.getElementById("receiptKwh");
        if (receiptElem) receiptElem.innerText = `${totalMah.toLocaleString('id-ID')} mAh`;
        document.getElementById("receiptActualCost").innerText = `Rp ${data.actual_cost.toLocaleString('id-ID')}`;
        document.getElementById("receiptDepositPaid").innerText = `Rp ${data.deposit_paid.toLocaleString('id-ID')}`;
        document.getElementById("receiptRefundAmount").innerText = `Rp ${data.refund_amount.toLocaleString('id-ID')}`;
        document.getElementById("receiptModal").classList.add("open");

        document.getElementById("activeChargingView").style.display = "none";
        document.getElementById("wizardStepHeader").style.display = "flex";
        goToStep(1);
        loadUserData();
      }
    } else if (data.event === "NOZZLE_CLAIMED" || data.event === "NOZZLE_RELEASED") {
      loadStationData();
      if (data.event === "NOZZLE_CLAIMED" && data.locked_by_user_id !== USER_ID) {
        if (selectedConnector && selectedConnector.id === data.connector_id && currentStep === 1) {
          selectedConnector = stationConnectors.find(c => c.status === "AVAILABLE" && !c.locked_by_user_id) || null;
        }
      }
    } else if (data.event === "STATION_RESET") {
      activeSessionId = null;
      document.getElementById("activeChargingView").style.display = "none";
      document.getElementById("wizardStepHeader").style.display = "flex";
      goToStep(1);
      if (currentUser) loadUserData();
      loadStationData();
    }
  };

  ws.onclose = () => {
    setTimeout(setupWebSocket, 2000);
  };
}

// -------------------------------------------------------------
// OPERATIONAL CONTROLS & RESET
// -------------------------------------------------------------
async function emergencyResetStation() {
  const ok = await showAppConfirm("Reset semua sesi pengisian dan kembalikan stasiun ke kondisi awal?\nSeluruh deposit yang belum dipakai akan dikembalikan ke dompet driver.", {
    title: "Reset Operasional",
    type: "warning",
    confirmText: "Ya, Reset Stasiun",
    cancelText: "Batal"
  });
  if (!ok) return;

  try {
    const res = await fetch("/api/station/emergency-reset", { method: "POST" });
    const data = await res.json();
    activeSessionId = null;
    document.getElementById("activeChargingView").style.display = "none";
    document.getElementById("wizardStepHeader").style.display = "flex";
    goToStep(1);
    if (currentUser) {
      await loadUserData();
    }
    await loadStationData();
    await showAppAlert(data.message, {
      title: "Reset Stasiun Berhasil",
      type: "success"
    });
  } catch (err) {
    await showAppAlert("Gagal reset stasiun: " + err, {
      title: "Reset Gagal",
      type: "error"
    });
  }
}

async function switchDemoUser(username, password) {
  if (activeSessionId) {
    const ok = await showAppConfirm("Sesi aktif sedang berjalan. Yakin ingin berganti akun?\nSesi pengisian akan tetap berjalan di stasiun.", {
      title: "Konfirmasi Ganti Akun",
      type: "warning",
      confirmText: "Ya, Ganti Akun",
      cancelText: "Batal"
    });
    if (!ok) return;
  }
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username, password: password })
    });
    const data = await res.json();
    if (!res.ok) {
      await showAppAlert(data.detail || "Error login", {
        title: "Gagal Masuk",
        type: "error"
      });
      return;
    }
    localStorage.setItem("voltx_user", JSON.stringify(data));
    activeSessionId = null;
    document.getElementById("activeChargingView").style.display = "none";
    document.getElementById("wizardStepHeader").style.display = "flex";
    await initDriverApp();
  } catch (err) {
    await showAppAlert("Gagal switch akun: " + err, {
      title: "Error Switch Akun",
      type: "error"
    });
  }
}

function setDisplayMode(mode) {
  const pres = document.getElementById("presContainer");
  const btnMockup = document.getElementById("btnModeMockup");
  const btnFluid = document.getElementById("btnModeFluid");
  if (!pres) return;

  if (mode === "fluid") {
    pres.classList.add("fluid-mode");
    if (btnMockup) btnMockup.classList.remove("active");
    if (btnFluid) btnFluid.classList.add("active");
  } else {
    pres.classList.remove("fluid-mode");
    if (btnMockup) btnMockup.classList.add("active");
    if (btnFluid) btnFluid.classList.remove("active");
  }
}

function updatePhoneClock() {
  const clockElem = document.getElementById("phoneClock");
  if (clockElem) {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    clockElem.innerText = `${h}:${m}`;
  }
}
setInterval(updatePhoneClock, 1000);
updatePhoneClock();
// -------------------------------------------------------------
// DEV TESTING: DYNAMIC USB PORT REMAPPER
// -------------------------------------------------------------
async function loadDevPortStatus() {
  try {
    const res = await fetch("/api/station/ports/config");
    if (res.ok) {
      const data = await res.json();
      const curCid = data.current_device?.connector_id || data.mappings?.["Port_#0002"]?.connector_id || 1;
      updateDevPortButtons(curCid);
    }
  } catch (e) {
    console.warn("Dev port config load error:", e);
  }
}

async function devSwitchUsbPort(connectorId) {
  try {
    const res = await fetch("/api/station/dev/remap-active-port", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connector_id: connectorId })
    });
    const data = await res.json();
    if (!res.ok) {
      await showAppAlert(data.detail || "Gagal memetakan port USB", { title: "Error Port Mapping", type: "error" });
      return;
    }
    updateDevPortButtons(connectorId);
    await loadStationData();
    await showAppAlert(`Port hardware USB laptop berhasil dipetakan ke Nozzle ${connectorId}!\nSistem kini mengenali kabel fisik Anda sebagai Nozzle ${connectorId}.`, {
      title: "Port Berhasil Dipetakan",
      type: "success"
    });
  } catch (err) {
    await showAppAlert("Gagal koneksi ke server: " + err, { title: "Error", type: "error" });
  }
}

function updateDevPortButtons(activeId) {
  [1, 2, 3].forEach(id => {
    const btn = document.getElementById(`btnDevPort${id}`);
    if (btn) {
      if (id === activeId) {
        btn.classList.add("active");
        btn.style.borderColor = "var(--cyan-neon)";
        btn.style.background = "rgba(0, 240, 255, 0.25)";
        btn.style.color = "#00F0FF";
        btn.style.fontWeight = "700";
      } else {
        btn.classList.remove("active");
        btn.style.borderColor = "#1E293B";
        btn.style.background = "transparent";
        btn.style.color = "var(--text-muted)";
        btn.style.fontWeight = "400";
      }
    }
  });
}

window.addEventListener("DOMContentLoaded", initDriverApp);

window.addEventListener("beforeunload", () => {
  if (selectedConnector && !activeSessionId && USER_ID) {
    if (selectedConnector.locked_by_user_id === USER_ID) {
      try {
        navigator.sendBeacon(
          `/api/station/connector/${selectedConnector.id}/release`,
          new Blob([JSON.stringify({ user_id: USER_ID })], { type: "application/json" })
        );
      } catch (e) {}
    }
    if (isPlugged) {
      try {
        navigator.sendBeacon(`/api/station/connector/${selectedConnector.id}/unplug`);
      } catch (e) {}
    }
  }
});

