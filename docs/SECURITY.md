# VPS xavfsizligi — juda muhim

Screenshot dagi kabi sozlama xavfsizlik nuqtai nazaridan zaif. Quyidagilarni amalga oshiring.

## 1. Root orqali SSH — xavf

**Kamchilik:** To'g'ridan-to'g'ri `root@170.168.6.11` bilan kirish.

**Tavsiya:**

- Oddiy foydalanuvchi yarating: `adduser deploy` (yoki boshqa ism).
- Bu user ga `sudo` ruxsatini bering.
- SSH ni faqat shu user orqali oching.
- `/etc/ssh/sshd_config` da: **`PermitRootLogin no`** qiling.
- `systemctl reload sshd` yoki `service sshd reload`.

Keyin faqat `deploy@170.168.6.11` (yoki o'zingizning user) orqali kiring, kerakda `sudo` ishlating.

## 2. Parol bilan kirish

**Kamchilik:** `root@...'s password:` — parol orqali kirish.

**Tavsiya:**

- Lokal mashinada: `ssh-copy-id deploy@170.168.6.11` (yoki VPS IP).
- Keyin `/etc/ssh/sshd_config` da: **`PasswordAuthentication no`** (yoki `no` ga yaqin sozlama).
- `reload sshd`. Endi faqat kalit orqali kirish ishlaydi.

## 3. Eski OS

**Kamchilik:** "New release '24.04.4 LTS' available" — eski versiya.

**Tavsiya:**

- Muntazam: `apt update && apt upgrade`.
- Yangi LTS ga o'tishni reja qiling: `do-release-upgrade` (vaqt va backup bilan).

## 4. Baza va parollar

- `.env` dagi **`DATABASE_URL`** ni hech kimga yubormang va GitHub ga commit qilmang.
- PostgreSQL foydalanuvchi parolini kuchli qiling; faqat kerakli DB lar uchun ruxsat bering.

## 5. Firewall

```bash
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable
```

Faqat kerakli portlar ochiq bo'lsin.

---

Barcha o'zgarishlardan keyin **yangi SSH session** ochib, kirish ishlashini tekshiring; keyin root va parol orqali kirishni o'chiring.
