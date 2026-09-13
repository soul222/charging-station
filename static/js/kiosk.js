const STATION_CODE = "CS-SDR-01";
const TOTAL_PHONE_BATTERY_MAH = 5000;
let activeSessionId = null;
let ws = null;

// =============================================================
// UNIVERSAL CUSTOM DIALOG SYSTEM (MODAL ALERT & CONFIRM)
// =============================================================
function showAppAlert(message, options = {}) {
  const {
    title = "Pemberitahuan",
    subtitle = "",
    type = "info",
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

// Clock
setInterval(() => {
  const now = new Date();
  document.getElementById("liveClock").innerText = now.toLocaleTimeString("id-ID") + " WIB";
}, 1000);

// Generate QR Code for HP Driver
function initQrCode() {
  const driverUrl = window.location.origin + "/driver";
  document.getElementById("kioskUrlText").innerText = driverUrl;
  const qrContainer = document.getElementById("kioskQrCode");
  if (typeof QRCode !== "undefined") {
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
      text: driverUrl,
      width: 160,
      height: 160,
      colorDark: "#0B0F19",
      colorLight: "#FFFFFF",
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    qrContainer.innerHTML = `<div style="padding:10px; color:#333; font-size:0.8rem; font-weight:600;">Scan URL:<br>${driverUrl}</div>`;
  }
}


// Fetch Station & Connectors
async function loadStationData() {
  try {
    const res = await fetch(`/api/station/${STATION_CODE}`);
    const data = await res.json();
    renderConnectors(data.connectors);
  } catch (err) {
    console.error("Gagal load station:", err);
  }
}

function renderConnectors(connectors) {
  const container = document.getElementById("connectorsContainer");
  container.innerHTML = "";

  connectors.forEach(c => {
    const isCharging = c.status === "CHARGING";
    const isConnected = c.status === "CONNECTED";
    const isClaimed = !!c.locked_by_user_id;

    let statusBadge = `<span class="status-pill online">STANDBY</span>`;
    let cardClass = "nozzle-card";

    if (isCharging) {
      statusBadge = `<span class="status-pill busy">⚡ CHARGING</span>`;
      cardClass += " active-charging";
    } else if (isClaimed) {
      statusBadge = `<span class="status-pill warning" style="background:rgba(239,68,68,0.2); color:#F87171; border:1px solid #EF4444;">🔒 DIKLAIM DRIVER</span>`;
      cardClass += " claimed";
    } else if (isConnected) {
      statusBadge = `<span class="status-pill warning" style="background:rgba(16,185,129,0.2); color:#34D399; border:1px solid #10B981;">🔌 KABEL TERCOLOK</span>`;
      cardClass += " connected";
    }

    const typeBadge = c.type_category === "DC" 
      ? `<span style="background:rgba(0,240,255,0.2); color:#00F0FF; padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.75rem;">DC FAST</span>`
      : `<span style="background:rgba(168,85,247,0.2); color:#A855F7; padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.75rem;">AC NORMAL</span>`;

    const qrId = `nozzleQr-${c.id}`;

    let qrSection = "";
    if (isCharging) {
      qrSection = `
        <div style="margin-top:14px; padding:12px; background:rgba(0,240,255,0.05); border:1px solid rgba(0,240,255,0.2); border-radius:12px; text-align:center;">
          <div style="font-size:0.82rem; font-weight:700; color:#00F0FF;">⚡ Pengisian Berlangsung</div>
          <div style="font-size:0.72rem; color:#94A3B8; margin-top:2px;">Nozzle ini sedang aktif digunakan</div>
        </div>
      `;
    } else if (isClaimed) {
      qrSection = `
        <div style="margin-top:14px; padding:12px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); border-radius:12px; text-align:center;">
          <div style="font-size:0.82rem; font-weight:700; color:#F59E0B;">🔒 Terkunci oleh Pengguna Lain</div>
          <div style="font-size:0.72rem; color:#94A3B8; margin-top:2px;">Driver sedang menyiapkan target pengisian</div>
        </div>
      `;
    } else {
      qrSection = `
        <div style="margin-top:14px; padding-top:12px; border-top:1px dashed #1E293B; text-align:center;">
          <div style="font-size:0.75rem; color:${isConnected ? '#34D399' : '#94A3B8'}; font-weight:700; margin-bottom:8px;">
            ${isConnected ? "📲 Scan QR untuk Klaim & Cas" : "📲 Scan QR Nozzle Ini"}
          </div>
          <div style="display:inline-block; background:#fff; padding:6px; border-radius:10px; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
            <div id="${qrId}"></div>
          </div>
          <div style="font-size:0.68rem; color:#38BDF8; margin-top:6px; font-family:monospace; font-weight:600;">
            /driver?nozzle=${c.connector_number}
          </div>
        </div>
      `;
    }

    const html = `
      <div class="${cardClass}" id="nozzleCard-${c.id}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
          <div style="font-size:1.4rem;">${c.type_category === 'DC' ? '⚡' : '🔌'}</div>
          <div>${statusBadge}</div>
        </div>
        <div style="font-weight:700; font-size:1rem; margin-bottom:4px; color:#fff;">${c.name}</div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
          ${typeBadge}
          <span style="font-size:0.8rem; color:#94A3B8;">${c.connector_type} • Max ${Math.round(c.max_power_kw * 1000).toLocaleString('id-ID')} W</span>
        </div>
        <div style="font-size:0.85rem; color:#38BDF8; font-weight:600; border-top:1px solid #1E293B; padding-top:10px;">
          Tarif: Rp ${c.tariff_per_kwh.toLocaleString("id-ID")} / kWh
        </div>
        ${qrSection}
        ${(!isCharging && !isClaimed) ? `
          <button type="button" class="btn btn-secondary btn-block" onclick="triggerKioskSimulatePlug(${c.id})" style="margin-top:10px; font-size:0.75rem; padding:7px 10px; border-color: rgba(56,189,248,0.4); color: #38BDF8; border-radius: 8px;">
            🔌 Simulasi Colok Mobil
          </button>
        ` : ''}
      </div>
    `;
    container.innerHTML += html;
  });

  // Render QR Codes into the newly injected elements
  connectors.forEach(c => {
    if (c.status !== "CHARGING" && !c.locked_by_user_id) {
      const qrElem = document.getElementById(`nozzleQr-${c.id}`);
      if (qrElem && typeof QRCode !== "undefined") {
        qrElem.innerHTML = "";
        const nozzleUrl = `${window.location.origin}/driver?nozzle=${c.connector_number}`;
        new QRCode(qrElem, {
          text: nozzleUrl,
          width: 90,
          height: 90,
          colorDark: "#0B0F19",
          colorLight: "#FFFFFF",
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    }
  });
}

async function triggerKioskSimulatePlug(connectorId) {
  try {
    const res = await fetch(`/api/station/connector/${connectorId}/plug`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: 1 })
    });
    if (!res.ok) {
      const err = await res.json();
      await showAppAlert(err.detail || "Gagal inisialisasi nozzle!", { title: "Error Nozzle", type: "error" });
    } else {
      await showAppAlert(`Nozzle terhubung ke kendaraan!\nHandshake ISO 15118 & auto-detect mobil sedang berlangsung... Buka halaman Driver untuk melanjutkan sesi.`, {
        title: "Handshake Dimulai",
        type: "success"
      });
    }
  } catch (err) {
    await showAppAlert("Gagal simulasi colok nozzle: " + err, { title: "Koneksi Error", type: "error" });
  }
}

// WebSocket Setup
function setupWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws/station/${STATION_CODE}`;
  
  ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWsEvent(data);
  };

  ws.onclose = () => {
    setTimeout(setupWebSocket, 2000);
  };
}

function handleWsEvent(data) {
  if (
    data.event === "PORT_NOZZLE_CONNECTED" ||
    data.event === "HANDSHAKE_COMPLETE" ||
    data.event === "NOZZLE_PLUGGED" || 
    data.event === "NOZZLE_UNPLUGGED" || 
    data.event === "NOZZLE_CLAIMED" ||
    data.event === "NOZZLE_RELEASED" ||
    data.event === "ADB_BATTERY_DISCONNECTED" ||
    data.event === "STATION_RESET"
  ) {
    if (data.event === "STATION_RESET") {
      document.getElementById("liveTelemetryCard").style.display = "none";
      activeSessionId = null;
    }
    loadStationData();
  } else if (data.event === "SESSION_STARTED") {
    activeSessionId = data.session_id;
    document.getElementById("liveTelemetryCard").style.display = "block";
    document.getElementById("activeSessionCode").innerText = `#${data.session_code}`;
    if (data.car_model) {
      const carElem = document.getElementById("kioskCarModel");
      if (carElem) carElem.innerText = data.car_model;
    }
    loadStationData();
  } else if (data.event === "TELEMETRY_UPDATE") {
    document.getElementById("liveTelemetryCard").style.display = "block";
    const kw = data.current_power_kw ? data.current_power_kw.toFixed(1) : (data.current_power_w ? (data.current_power_w / 1000).toFixed(1) : "0.0");
    const wattElem = document.getElementById("kioskWattVal");
    if (wattElem) wattElem.innerText = kw;

    const carElem = document.getElementById("kioskCarModel");
    if (carElem && data.car_model) carElem.innerText = data.car_model;

    document.getElementById("kioskSocVal").innerText = data.current_soc.toFixed(1) + "%";
    document.getElementById("kioskSocBar").style.width = data.current_soc + "%";

    const kwhElem = document.getElementById("kioskKwhVal") || document.getElementById("kioskMahVal");
    if (kwhElem) kwhElem.innerText = `${(data.energy_delivered_kwh || 0).toFixed(2)} kWh`;

    const kmElem = document.getElementById("kioskKmVal");
    if (kmElem) kmElem.innerText = `+${data.km_added || 0} KM`;

    const speedElem = document.getElementById("kioskSpeedVal");
    if (speedElem) speedElem.innerText = `+${(data.charging_speed_km_per_min || 0).toFixed(1)} km/m`;

    const savingsElem = document.getElementById("kioskSavingsVal");
    if (savingsElem) savingsElem.innerText = `Hemat Rp ${Math.round(data.money_saved_petrol || 0).toLocaleString('id-ID')}`;

    const volt = Math.round(data.voltage_v || data.voltage || 400);
    const amps = (data.current_a || data.current_amps || 0).toFixed(1);
    document.getElementById("kioskVoltAmpVal").innerText = `${volt} V / ${amps} A`;
    document.getElementById("kioskCostVal").innerText = `Rp ${Math.round(data.current_cost || 0).toLocaleString("id-ID")}`;
  } else if (data.event === "SESSION_COMPLETED") {
    document.getElementById("liveTelemetryCard").style.display = "none";
    activeSessionId = null;
    loadStationData();
    const totalKwh = (data.total_energy_kwh || 0).toFixed(2);
    showAppAlert(`Mobil: ${data.car_model || 'Real EV'}\nEnergi Terisi: ${totalKwh} kWh (+${data.km_added || 0} KM)\nBiaya Aktual: Rp ${Math.round(data.actual_cost || 0).toLocaleString('id-ID')}\nHemat vs Bensin: Rp ${(data.money_saved_petrol || 0).toLocaleString('id-ID')} (${data.savings_percentage || 60}%)\nRefund Saldo: Rp ${Math.round(data.refund_amount || 0).toLocaleString('id-ID')}`, {
      title: "Pengisian Selesai",
      type: "success"
    });
  }
}

async function emergencyStopKiosk() {
  if (!activeSessionId) return;
  const ok = await showAppConfirm("Hentikan pengisian darurat sekarang?", {
    title: "Emergency Stop",
    type: "error",
    confirmText: "Ya, Hentikan Darurat",
    cancelText: "Batal"
  });
  if (!ok) return;

  try {
    const res = await fetch("/api/station/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: activeSessionId, user_id: 1 })
    });
    const result = await res.json();
    await showAppAlert(result.message, {
      title: "Status Pengisian",
      type: "info"
    });
  } catch (err) {
    await showAppAlert("Gagal stop: " + err, {
      title: "Gagal Stop",
      type: "error"
    });
  }
}

// Init
initQrCode();
loadStationData();
setupWebSocket();
