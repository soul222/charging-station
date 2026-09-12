# ⚡ EV Charging Station Simulator (FastAPI & WebSockets)

Sistem simulasi stasiun pengisian kendaraan listrik (EVCS / SPKLU) interaktif berbasis Python.
Dirancang **100% tanpa perangkat IoT fisik**:
- **Laptop**: Menampilkan layar fisik totem mesin SPKLU (`/kiosk`) dengan QR Code dinamis, status 3 nozzle, live telemetry gauge (W, V, A, °C), dan sensor tap kartu RFID.
- **HP (Smartphone)**: Membuka aplikasi web driver (`/driver`) via browser HP di satu jaringan Wi-Fi untuk scan stasiun, colok kabel, pilih target mAh, bayar deposit (Wallet, QRIS, E-Money), monitor pengisian live, serta tombol **"Stop & Auto-Refund"**!

---

## 🚀 Cara Menjalankan

1. **Pastikan Laptop dan HP Terhubung ke Wi-Fi / Hotspot yang Sama**.
2. **Jalankan Simulator**:
   ```bash
   python run.py
   ```
3. Terminal akan secara otomatis menampilkan:
   - Alamat Kiosk Laptop: `http://localhost:8000/kiosk`
   - Alamat Driver HP: `http://<IP_LAN_ANDA>:8000/driver`
   - **QR Code Terminal**: Anda cukup mengarahkan kamera HP ke terminal laptop untuk langsung membuka aplikasi di smartphone!
4. Buka `http://localhost:8000/kiosk` di browser Laptop (Fullscreen/F11 disarankan).
5. Buka link di HP Anda.

---

## ⚡ Fitur Utama & Pengujian

1. **3 Pilihan Nozzle Pengisian**:
   - **Nozzle 1 — AC Normal (22.000 W / Type 2)**: Rp 2.466 / 500 mAh
   - **Nozzle 2 — DC Fast (50.000 W / CHAdeMO)**: Rp 3.000 / 500 mAh
   - **Nozzle 3 — DC Ultra-Fast (150.000 W / CCS2)**: Rp 3.500 / 500 mAh
2. **Sinkronisasi Real-Time Dua Arah (WebSockets)**:
   - Ketika nozzle dicolokkan ke HP (atau via simulasi bypass), layar Laptop seketika merespons *"🔌 KABEL TERCOLOK"*.
   - Saat pengisian dimulai di HP, relay mesin laptop menyala dan jarum meter daya (W) langsung berputar secara sinkron!
3. **Metode Pembayaran Lengkap**:
   - **Saldo Dompet (In-App Wallet)**: Saldo Rp 150.000 / Rp 200.000 sudah disediakan untuk pengujian awal. Tersedia tombol `+ Top-Up`.
   - **QRIS Dinamis**: Men-generate QRIS dinamis sesuai target deposit cas.
   - **E-Money / Kartu RFID**: Pop-up interaktif simulasi tap kartu BCA Flazz dengan saldo aman, verifikasi 2 detik, dan lanjut otomatis.
4. **Penghentian di Tengah Jalan & Auto-Refund**:
   - Di tengah proses pengisian, klik tombol merah **"🛑 BERHENTI SEKARANG (STOP & REFUND)"** di HP atau cabut kabel fisik USB.
   - Sistem seketika melakukan auto-cutoff, menghitung daya mAh riil yang masuk, lalu **me-refund sisa uang deposit langsung ke saldo dompet pengguna** disertai struk pelunasan!

---

## 💻 Demo di Laptop Berbeda?
Jika Anda membawa simulator ini untuk demonstrasi di laptop lain (kantor, kampus, juri, atau klien), ikuti panduan praktis dan langkah setup cepat pada:
- [**`SETUP_DEMO_LAPTOP_LAIN.md`**](file:///C:/Users/soult/Downloads/charging-station/SETUP_DEMO_LAPTOP_LAIN.md) (Panduan lengkap multi-device)
- Script kalibrasi otomatis port USB: `python calibrate_ports.py`

---

## 🧪 Menjalankan Automated Test
```bash
python -m unittest discover tests
```
