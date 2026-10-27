# Teknokent Avı

Türkiye genelindeki teknokent ve teknoparklarda faaliyet gösteren teknoloji ve Ar-Ge firmalarını tek çatı altında toplayan, tarayıcı üzerinde istemci taraflı çalışan arama ve keşif platformu.

## Kapsam

* 78 teknokent ve teknoloji geliştirme bölgesi
* 48 şehir
* 5.718 doğrulanmış ve aktif teknoloji firması
* 12 ana sektör ve 188 dikey uzmanlık alanı

## Mimari ve Çalışma Mantığı

1. **Veri Toplama:** Teknokentlerin firma dizinleri taranarak firma web sitelerine ulaşılmış, site içeriklerinden kurumsal faaliyet özetleri çıkarılmıştır.
2. **LLM ile Taksonomi ve Sınıflandırma:** Çıkarılan özet metinler, büyük dil modeli kullanılarak incelenmiştir. Firmalar faaliyet alanlarına göre 12 standart ana sektör ve ilgili alt uzmanlık kategorilerine etiketlenmiştir. Oyun, medikal bilişim, savunma, eğitim ve tarım gibi dikey alanların genel yazılım kategorisine yığılması engellenmiştir.
3. **Sunucusuz İstemci Mimarisi:** Platform, herhangi bir arka uç sunucusu veya API maliyeti olmadan çalışır. Veri seti istemci tarafına optimize edilmiş JSON formatında yüklenir ve tüm arama/filtreleme işlemleri doğrudan tarayıcı belleğinde gerçekleştirilir.

## Dosya Yapısı

* `index.html`: Ana kullanıcı arayüzü ve tanıtım ekranı.
* `style.css`: Arayüz tasarım sistemi ve responsive stiller.
* `app.js`: İstemci taraflı filtreleme, tam metin arama ve sayfalama motoru.
* `data/firmalar.json`: Optimize edilmiş firma veritabanı (2.69 MB).
* `data/meta.json`: Filtre listeleri, sektörler, şehirler ve teknokent sayıları.

## Kullanılan Teknolojiler

### Yapay Zeka ve Sınıflandırma
* **Dil Modeli:** Qwen3-32B-AWQ
* **Inference Motoru:** vLLM (Prefix Caching ve Chunked Prefill etkinleştirilmiş)
* **Hesaplama Ortamı:** Google Colab (GPU ortamı)

### Veri Tarama ve Bot Koruması Aşma (WAF Bypass)
* **Tarayıcı Motoru:** Crawl4AI, Playwright (Chromium altyapısı)
* **TLS & JA3/JA4 Parmak İzi Taklidi:** `curl_cffi` (`impersonate="chrome124"` ile Cloudflare, Akamai ve Datadome bypass)
* **Otomasyon İzi Gizleme:** `--disable-blink-features=AutomationControlled`, `override_navigator`, `simulate_user`
* **Modern İstemci Başlıkları:** Chromium Client Hints (`Sec-Ch-Ua`, `Sec-Fetch-*` tam set)
* **Dinamik DOM ve Çerez Aşma:** JS enjeksiyonu ile KVKK/çerez buton tıklama ve overlay kaldırma
* **SPA Hidrasyon Gecikmesi:** React/Vue/Angular siteleri için `delay_before_return_html` desteği
* **HTML Ayrıştırma:** BeautifulSoup4

### Veri Tabanı ve Yerel İndeksleme
* **Yerel Depolama ve Testler:** Python 3, SQLite (FTS5 tam metin arama motoru)

### Ön Yüz ve Dağıtım
* **Ön Yüz:** Vanilla JavaScript (ES6+), HTML5, CSS3 (Harici kütüphane veya framework kullanılmamıştır)
* **Barındırma:** GitHub Pages (Static Hosting)
