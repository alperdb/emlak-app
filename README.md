# Emlak Ofisi Yönetim Uygulaması

Tek kullanıcılı, lokal çalışan emlak ofisi yönetim uygulaması.

## Gereksinimler

- **Node.js** v18 veya üzeri → https://nodejs.org
- İnternet bağlantısı (ilk açılışta Tailwind CSS CDN yüklenir, sonra önbelleklenir)

## Kurulum ve Çalıştırma

```bash
# 1. Proje klasörüne gir
cd emlak-app

# 2. Bağımlılıkları yükle (tek seferlik)
npm install

# 3. Uygulamayı başlat
npm start

# 4. Tarayıcıda aç
#    http://localhost:3000
```

## Geliştirme Modu (otomatik yeniden başlatma)

```bash
npm run dev
```

## Ekranlar

| Ekran | URL |
|-------|-----|
| Dashboard | http://localhost:3000/#/ |
| Portföy | http://localhost:3000/#/portfoy |
| Müşteriler | http://localhost:3000/#/musteriler |
| Görevler | http://localhost:3000/#/gorevler |
| Ayarlar | http://localhost:3000/#/ayarlar |

## Veri Dosyası

Tüm veriler `emlak.db` (SQLite) dosyasında saklanır.
Yedek almak için bu dosyayı kopyalayın.

## Port Değiştirme

```bash
PORT=8080 npm start
```
