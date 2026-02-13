# Çift İkon Analizi

Sol sidebar'da her menü öğesinde iki ikon görünüyor:
1. Lucide React ikonu (solda, gri) - `<Icon className="h-4 w-4 shrink-0" />`
2. Emoji ikonu (label içinde) - örn: "🏠 Ana Sayfa", "⚡ Tüm Sporlar"

Sorun: Label'larda hem emoji hem de lucide icon var. Kullanıcı soldaki ikonların (lucide) kalmasını istiyor.

Çözüm: Label'lardan emoji'leri kaldırmak gerekiyor. Sadece lucide ikonları kalacak.
