# ⚡ Panduan Lengkap Deploy Cloud 24 Jam Nonstop ke Hugging Face Spaces (Docker)

Panduan ini memandu Anda mempublikasikan aplikasi **VOLTX EV Charging Station Simulator** ke **[Hugging Face Spaces](https://huggingface.co/spaces)** secara **100% GRATIS**, **TANPA KARTU KREDIT**, dan **AKTIF 24 JAM NONSTOP**.

---

## 🌟 Mengapa Hugging Face Spaces Paling Unggul?

| Fitur | Spesifikasi di Hugging Face Spaces |
| :--- | :--- |
| **Biaya** | **100% Gratis Selamanya ($0)** |
| **Kartu Kredit** | **Sama sekali TIDAK PERLU (0% Credit Card)** |
| **Spesifikasi Server** | **2 vCPU + 16 GB RAM + 50 GB Disk** (Sangat bertenaga!) |
| **WebSockets** | **Didukung penuh secara native (`wss://`)** |
| **Ketersediaan** | Aktif 24 jam nonstop di cloud (Laptop Anda mati tidak berpengaruh) |
| **Direct URL Publik** | `https://[username]-[space-name].hf.space` (Bersih tanpa banner) |

---

## 🛠️ Langkah-Langkah Deployment (5 Menit)

```mermaid
flowchart LR
    A["1. Buat Space Baru<br/>Pilih SDK Docker"] --> B["2. Buat Access Token<br/>Role: Write"]
    B --> C["3. Push dari Terminal<br/>git push space main"]
    C --> D["4. Tunggu Build Docker<br/>~2 Menit"]
    D --> E["5. Live 24 Jam!<br/>Siap Dites Dosen/Penguji"]
```

---

### Langkah 1: Buat Space Baru di Hugging Face

1. Buka dan login ke: **[https://huggingface.co/new-space](https://huggingface.co/new-space)**
   *(Jika belum punya akun, daftar gratis hanya butuh email di [huggingface.co/join](https://huggingface.co/join))*.
2. Isi formulir pembuatan Space:
   - **Space name**: `charging-station` *(atau nama pilihan Anda)*
   - **License**: `mit` *(atau bebas)*
   - **Select the Space SDK**: Pilih **Docker** (Blank)
   - **Space hardware**: Pilih **CPU basic • 2 vCPU • 16 GB • Free**
   - **Visibility**: **Public**
3. Klik tombol **"Create Space"**.

---

### Langkah 2: Buat Access Token (Untuk Izin Push)

1. Klik foto profil Anda di pojok kanan atas > pilih **Settings**.
2. Di menu sebelah kiri, klik **Access Tokens** (atau buka [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)).
3. Klik **"Create new token"**:
   - Token type: Pilih **Write**
   - Name: `deploy-token`
4. Klik **Create token**, lalu **Copy token** tersebut (simpan sebentar di Notepad).

---

### Langkah 3: Push Project dari Terminal Laptop Anda

Buka terminal di folder project Anda (`C:\Users\soult\Downloads\charging-station`), lalu jalankan 3 baris perintah berikut:

```powershell
# 1. Simpan perubahan terbaru ke git lokal
git add .
git commit -m "feat: setup Hugging Face Spaces docker and cloud database"

# 2. Hubungkan terminal ke repository Space Anda
# GANTI [username] dan [nama-space] sesuai akun Anda:
git remote add space https://huggingface.co/spaces/[username]/[nama-space]

# 3. Unggah (push) ke Hugging Face
git push space main -f
```

Saat muncul prompt login:
- **Username**: Masukkan username Hugging Face Anda.
- **Password**: Tempelkan (*Paste*) **Access Token (Write)** yang tadi Anda copy di Langkah 2.

---

### Langkah 4: Tunggu Proses Build Selesai

1. Buka kembali halaman Space Anda di browser:
   `https://huggingface.co/spaces/[username]/[nama-space]`
2. Di bagian atas Anda akan melihat status:
   `Building` ➔ `Running` (berwarna hijau).
3. Proses build Docker membutuhkan waktu sekitar **1–2 menit**.

---

### Langkah 5: Bagikan Link Web ke Penguji / Dosen! 🎉

Hugging Face menyediakan **Direct Link** resmi yang bersih tanpa bingkai/banner:

👉 **Format Direct URL:**
**`https://[username]-[nama-space].hf.space`**

*(Contoh jika username Anda `soul222` dan nama space `charging-station`, linknya adalah: `https://soul222-charging-station.hf.space`)*

#### Cara Pengujian:
1. **Layar Kios Laptop / Tablet**:
   Buka link: **`https://[username]-[nama-space].hf.space/kiosk`**
   Layar Kios akan otomatis menampilkan QR Code dinamis stasiun.
2. **Aplikasi Driver HP Penguji**:
   Buka link atau scan QR: **`https://[username]-[nama-space].hf.space/driver`**
3. **Mulai Simulasi**:
   - Login / buat akun di HP penguji.
   - Klik **"⚡ Colok Simulasi"**.
   - Bayar deposit (Saldo / QRIS / E-Money).
   - Speedometer daya dan persentase baterai bergerak sinkron di HP dan Kios via WebSockets!

---

## 🗄️ (Opsional) Menggunakan Database Supabase

Secara default, aplikasi sudah otomatis menggunakan database SQLite yang tersimpan di dalam container.

Jika Anda ingin data pengguna dan riwayat transaksi tersimpan **permanen di cloud Supabase**:
1. Buat project gratis di **[Supabase.com](https://supabase.com/)**.
2. Masuk ke **Project Settings** > **Database** > Copy **Connection String (URI)**.
   *(Contoh: `postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres`)*.
3. Di halaman Space Hugging Face Anda, klik **Settings** > scroll ke bagian **Variables and secrets**.
4. Klik **New secret**:
   - Name: `DATABASE_URL`
   - Value: Paste connection string Supabase Anda.
5. Klik **Save**. Aplikasi akan otomatis restart dan terhubung ke database Supabase!
