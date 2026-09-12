# ⚡ Cara Menjalankan Cloudflare Public Tunnel (1-Klik & 100% Gratis)

Skrip ini memungkinkan siapa saja (dosen, penguji, teman) membuka aplikasi **VOLTX EV Charging Station** langsung dari smartphone mereka di mana saja di seluruh dunia **tanpa perlu kartu kredit, tanpa daftar akun cloud, dan 100% GRATIS**.

---

## 🚀 Cara Menjalankan (Paling Mudah)

### Cara 1: Double-Click File (Paling Cepat)
Cukup **klik dua kali** (double-click) file:
👉 **`run_tunnel.bat`** di dalam folder project Anda.

---

### Cara 2: Lewat Terminal PowerShell / CMD
Buka terminal di folder project Anda, lalu ketik:
```powershell
python run_tunnel.py
```

---

## 📱 Apa yang Akan Muncul di Layar Anda?

Dalam 3–5 detik, terminal akan menampilkan banner lengkap beserta **QR Code ASCII**:

```text
======================================================================
      ⚡ VOLTX EV CHARGING STATION (CLOUDFLARE PUBLIC TUNNEL) ⚡
======================================================================
 [💻] LAPTOP KIOSK (LOKAL)   : http://localhost:8000/kiosk
 [🌐] LAPTOP KIOSK (PUBLIK)  : https://[random-subdomain].trycloudflare.com/kiosk
 [📱] SMARTPHONE DRIVER APP  : https://[random-subdomain].trycloudflare.com/driver
======================================================================
📲 SCAN QR CODE INI MENGGUNAKAN HP ANDA / PENGUJI / DOSEN:
   (Bisa dibuka dari mana saja: Paket Data Seluler 4G/5G atau Wi-Fi)

   [ QR CODE BESAR SIAP SCAN ]

----------------------------------------------------------------------
 [✓] WebSockets (WSS)  : AKTIF (Sinkronisasi Real-Time Dua Arah)
 [✓] Hardware USB & ADB: AKTIF (Deteksi colokan HP laptop tetap berfungsi)
 [✓] Biaya Hosting     : GRATIS ($0 / Tanpa Kartu Kredit)
----------------------------------------------------------------------
 Tekan Ctrl + C untuk menghentikan server dan menutup tunnel.
======================================================================
```

---

## 🎯 Cara Menguji Bersama Orang Lain / Dosen:

1. **Di Laptop Anda**:
   Buka browser ke alamat: **`http://localhost:8000/kiosk`** (Layar Kios SPKLU).
2. **Di HP Orang Lain / Penguji**:
   Arahkan kamera HP mereka ke QR Code yang muncul di terminal Anda, ATAU kirimkan link **`https://...trycloudflare.com/driver`** via WhatsApp.
3. **Mulai Pengujian**:
   - HP penguji tidak perlu berada di Wi-Fi yang sama (bisa pakai Telkomsel, Indosat, XL, dll).
   - Penguji login / daftar akun di HP mereka.
   - Klik nozzle dan pilih bayar deposit.
   - Pergerakan daya dan persentase baterai akan bergerak detik-demi-detik secara sinkron antara layar laptop Anda dan HP penguji via WebSockets!

---

## 🛑 Cara Mematikan Server
Jika pengujian sudah selesai, cukup tekan **`Ctrl + C`** di terminal Anda. Server dan tunnel akan otomatis tertutup dengan bersih dan aman.
