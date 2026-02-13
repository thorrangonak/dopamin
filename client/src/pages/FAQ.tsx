import { useState } from "react";
import { ChevronDown, HelpCircle, Search } from "lucide-react";

type FAQItem = { q: string; a: string; category: string };

const FAQ_DATA: FAQItem[] = [
  { category: "Genel", q: "Dopamin nedir?", a: "Dopamin, spor bahisleri ve casino oyunları sunan kapsamlı bir online bahis platformudur. 70'ten fazla spor dalında canlı oranlar, yüzlerce casino oyunu ve yapay zeka destekli bahis asistanı ile kullanıcılarına üstün bir deneyim sunar." },
  { category: "Genel", q: "Dopamin'e nasıl üye olabilirim?", a: "Sağ üst köşedeki 'Giriş Yap' butonuna tıklayarak hesap oluşturabilirsiniz. Kayıt işlemi birkaç dakika içinde tamamlanır." },
  { category: "Genel", q: "Dopamin güvenli mi?", a: "Evet, Dopamin en son güvenlik teknolojilerini kullanarak kullanıcı verilerini korur. Tüm işlemler şifreli bağlantı üzerinden gerçekleştirilir." },
  { category: "Bahis", q: "Nasıl bahis yapabilirim?", a: "Sporlar sayfasından istediğiniz maçı seçin, orana tıklayın ve kupon sepetinize ekleyin. Bahis tutarınızı girin ve 'Kupon Oluştur' butonuna tıklayın. Tekli veya kombine kupon oluşturabilirsiniz." },
  { category: "Bahis", q: "Kombine kupon nedir?", a: "Kombine kupon, birden fazla maçtan seçim yaparak oluşturduğunuz kupondur. Tüm seçimlerinizin doğru çıkması gerekir. Oranlar çarpılarak toplam oran hesaplanır, bu da daha yüksek kazanç potansiyeli sağlar." },
  { category: "Bahis", q: "Kuponlarım nasıl sonuçlanır?", a: "Kuponlarınız maçlar tamamlandıktan sonra otomatik olarak sonuçlandırılır. Sistem, The Odds API üzerinden maç sonuçlarını kontrol eder ve kuponunuzu kazanan veya kaybeden olarak işaretler." },
  { category: "Bahis", q: "Canlı bahis yapabilir miyim?", a: "Evet, Canlı sayfasından devam eden maçlara bahis yapabilirsiniz. Canlı skor takibi ile maçları anlık olarak izleyebilirsiniz." },
  { category: "Bahis", q: "Hangi spor dallarına bahis yapabilirim?", a: "Futbol, basketbol, tenis, Amerikan futbolu, buz hokeyi, beyzbol, MMA, boks, kriket, e-spor ve daha birçok spor dalına bahis yapabilirsiniz. Toplamda 70'ten fazla spor dalı mevcuttur." },
  { category: "Casino", q: "Casino oyunları gerçek para ile mi oynanır?", a: "Casino bölümü şu anda demo modundadır. Oyunlar yakında gerçek para ile oynanabilir hale gelecektir." },
  { category: "Casino", q: "Hangi casino oyunları mevcut?", a: "Slots, blackjack, rulet, poker, baccarat, zar oyunları ve canlı casino oyunları dahil yüzlerce oyun mevcuttur." },
  { category: "Casino", q: "Canlı casino nedir?", a: "Canlı casino, gerçek krupiyeler eşliğinde oynanan masa oyunlarıdır. Evolution Gaming gibi önde gelen sağlayıcıların oyunları mevcuttur." },
  { category: "Ödeme", q: "Nasıl para yatırabilirim?", a: "Cüzdan sayfasından 'Para Yatır' bölümüne giderek istediğiniz tutarı hesabınıza ekleyebilirsiniz." },
  { category: "Ödeme", q: "Para çekme işlemi ne kadar sürer?", a: "Para çekme talepleri genellikle 24 saat içinde işleme alınır. İşlem süreleri ödeme yöntemine göre değişiklik gösterebilir." },
  { category: "Ödeme", q: "Minimum yatırım tutarı nedir?", a: "Minimum yatırım tutarı 10 TL'dir." },
  { category: "AI Asistan", q: "AI Asistan ne işe yarar?", a: "AI Asistan, yapay zeka destekli bahis önerileri sunar. Maç analizleri, istatistikler ve bahis stratejileri hakkında sorular sorabilirsiniz." },
  { category: "AI Asistan", q: "AI Asistan'ın önerileri güvenilir mi?", a: "AI Asistan, geçmiş verilere ve istatistiklere dayalı analizler sunar. Ancak bahis her zaman risk içerir ve AI önerileri garanti sonuç vermez. Sorumlu bahis yapmanızı öneririz." },
];

export default function FAQ() {
  const [search, setSearch] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Tümü");

  const categories = ["Tümü", ...Array.from(new Set(FAQ_DATA.map(f => f.category)))];

  const filtered = FAQ_DATA.filter(f => {
    const matchSearch = !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase());
    const matchCategory = selectedCategory === "Tümü" || f.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <HelpCircle className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold text-foreground">❓ Sıkça Sorulan Sorular</h1>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Soru ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* FAQ List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Sonuç bulunamadı.</p>
        ) : (
          filtered.map((faq, i) => {
            const globalIndex = FAQ_DATA.indexOf(faq);
            const isOpen = openIndex === globalIndex;
            return (
              <div key={globalIndex} className="border border-border rounded-lg bg-card overflow-hidden">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : globalIndex)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-accent/20 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium">{faq.category}</span>
                    <span className="text-sm font-medium text-foreground">{faq.q}</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-0">
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
