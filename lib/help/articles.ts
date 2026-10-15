export type HelpLocale = 'en' | 'id';

export type HelpSection = {
  heading: string;
  paragraphs?: string[];
  steps?: string[];
  bullets?: string[];
  note?: string;
};

export type HelpArticle = {
  slug: string;
  category: string;
  title: Record<HelpLocale, string>;
  summary: Record<HelpLocale, string>;
  keywords: Record<HelpLocale, string[]>;
  action: { href: string; label: Record<HelpLocale, string> };
  sections: Record<HelpLocale, HelpSection[]>;
  related: string[];
};

export const helpCategories = [
  { id: 'buying', label: { en: 'Buying', id: 'Membeli' } },
  { id: 'orders', label: { en: 'Orders and delivery', id: 'Pesanan dan pengiriman' } },
  { id: 'offers', label: { en: 'Offers', id: 'Penawaran' } },
  { id: 'selling', label: { en: 'Selling', id: 'Menjual' } },
  { id: 'payments', label: { en: 'Payments and refunds', id: 'Pembayaran dan refund' } },
  { id: 'collection', label: { en: 'Vault and collection', id: 'Vault dan koleksi' } },
  { id: 'account', label: { en: 'Account and safety', id: 'Akun dan keamanan' } },
] as const;

export const helpArticles: HelpArticle[] = [
  {
    slug: 'buying-on-market', category: 'buying',
    title: { en: 'Buy cards on Market', id: 'Membeli kartu di Market' },
    summary: { en: 'Compare a listing, check its cards and delivery details, then pay through checkout.', id: 'Bandingkan listing, periksa kartu dan detail pengiriman, lalu bayar melalui checkout.' },
    keywords: { en: ['buy', 'checkout', 'listing', 'shipping', 'delivery fee', 'purchase'], id: ['beli', 'checkout', 'listing', 'ongkir', 'pengiriman', 'pembelian'] },
    action: { href: '/market', label: { en: 'Browse Market', id: 'Jelajahi Market' } },
    related: ['track-a-market-order', 'payment-and-refund-help', 'make-or-answer-an-offer'],
    sections: {
      en: [
        { heading: 'Before you buy', paragraphs: ['Open the listing and check the exact printing, language, condition, quantity, and total price. Bundle listings can contain several cards, with a quantity and condition shown for each one. Read the seller’s notes and review the delivery options shown for your address.'] },
        { heading: 'Place an order', steps: ['Choose Buy on the listing. If it contains more than one card, set the quantity you want for each card. A single-card listing goes straight to checkout.', 'Confirm your delivery address and choose an available courier. Check the full total, including delivery, before continuing.', 'Complete payment using the method shown at checkout. Keep the order page or payment confirmation until the order is finished.'] },
        { heading: 'After payment', paragraphs: ['The order appears in Market under My Market → Orders. The seller can prepare it after payment is confirmed. Follow the shipment status there and check the package when it arrives.'] },
        { heading: 'If something goes wrong', paragraphs: ['Use the order page to contact the other party or report a delivery problem. If the order is marked delivered but something is missing or damaged, follow the reporting steps in the order-problem guide.'] },
      ],
      id: [
        { heading: 'Sebelum membeli', paragraphs: ['Buka listing dan periksa cetakan, bahasa, kondisi, jumlah, serta harga total. Listing bundle dapat memuat beberapa kartu, dengan jumlah dan kondisi masing-masing. Baca catatan penjual dan periksa opsi pengiriman yang tersedia untuk alamat Anda.'] },
        { heading: 'Buat pesanan', steps: ['Pilih Beli pada listing. Jika listing berisi beberapa kartu, tentukan jumlah tiap kartu. Listing satu kartu langsung menuju checkout.', 'Konfirmasi alamat pengiriman dan pilih kurir yang tersedia. Periksa total biaya termasuk ongkir sebelum melanjutkan.', 'Selesaikan pembayaran dengan metode yang tampil di checkout. Simpan halaman pesanan atau konfirmasi pembayaran sampai pesanan selesai.'] },
        { heading: 'Setelah membayar', paragraphs: ['Pesanan muncul di Market melalui Market saya → Pesanan. Penjual dapat menyiapkan kartu setelah pembayaran dikonfirmasi. Pantau status pengiriman di sana dan periksa paket saat tiba.'] },
        { heading: 'Jika ada masalah', paragraphs: ['Gunakan halaman pesanan untuk menghubungi pihak terkait atau melaporkan masalah pengiriman. Jika pesanan ditandai terkirim tetapi ada kartu yang kurang atau rusak, ikuti panduan pelaporan masalah pesanan.'] },
      ],
    },
  },
  {
    slug: 'track-a-market-order', category: 'orders',
    title: { en: 'Track an order and confirm delivery', id: 'Lacak pesanan dan konfirmasi penerimaan' },
    summary: { en: 'Find your order, follow shipment updates, and know when to confirm that it arrived.', id: 'Temukan pesanan, pantau pembaruan pengiriman, dan ketahui kapan harus mengonfirmasi penerimaan.' },
    keywords: { en: ['track', 'tracking', 'shipment', 'courier', 'delivered', 'received'], id: ['lacak', 'resi', 'pengiriman', 'kurir', 'terkirim', 'diterima'] },
    action: { href: '/market', label: { en: 'Open Market orders', id: 'Buka pesanan Market' } },
    related: ['report-a-market-order-problem', 'buying-on-market', 'payment-and-refund-help'],
    sections: {
      en: [
        { heading: 'Find the order', steps: ['Sign in with the account used at checkout.', 'Open Market and choose My Market → Orders from the account menu.', 'Select the order to see payment, seller, courier, and delivery updates.'] },
        { heading: 'When the package arrives', paragraphs: ['Check the card names, printings, quantities, and condition against the listing. Keep the package and shipping label while you inspect everything. Confirm receipt only after you have checked the order.'] },
        { heading: 'The tracking has not moved', paragraphs: ['Check the latest courier update on the order page. If the displayed delivery window has passed or the tracking status conflicts with what happened, contact the seller through the order and include the order number. You can also contact VivrePlay support if you cannot resolve it with the seller.'] },
      ],
      id: [
        { heading: 'Temukan pesanan', steps: ['Masuk dengan akun yang digunakan saat checkout.', 'Buka Market, lalu pilih Market saya → Pesanan dari menu akun.', 'Pilih pesanan untuk melihat status pembayaran, penjual, kurir, dan pengiriman.'] },
        { heading: 'Saat paket tiba', paragraphs: ['Cocokkan nama kartu, cetakan, jumlah, dan kondisi dengan listing. Simpan kemasan serta label pengiriman selama memeriksa pesanan. Konfirmasi penerimaan setelah Anda selesai memeriksanya.'] },
        { heading: 'Status pengiriman tidak berubah', paragraphs: ['Periksa pembaruan kurir terbaru di halaman pesanan. Jika estimasi yang ditampilkan sudah lewat atau status resi berbeda dari kondisi sebenarnya, hubungi penjual melalui pesanan dan sertakan nomor pesanan. Hubungi dukungan VivrePlay jika masalah belum terselesaikan dengan penjual.'] },
      ],
    },
  },
  {
    slug: 'report-a-market-order-problem', category: 'orders',
    title: { en: 'Report a problem with a Market order', id: 'Laporkan masalah pada pesanan Market' },
    summary: { en: 'What to check, what evidence to keep, and how to send a report from the order page.', id: 'Hal yang perlu diperiksa, bukti yang perlu disimpan, dan cara mengirim laporan dari halaman pesanan.' },
    keywords: { en: ['complaint', 'dispute', 'missing', 'wrong card', 'damaged', 'counterfeit', 'refund', 'reship', 'unboxing'], id: ['komplain', 'sengketa', 'kurang', 'kartu salah', 'rusak', 'palsu', 'refund', 'kirim ulang', 'unboxing'] },
    action: { href: '/market', label: { en: 'Open My Market', id: 'Buka Market saya' } },
    related: ['track-a-market-order', 'payment-and-refund-help', 'buying-on-market'],
    sections: {
      en: [
        { heading: 'Check the order as soon as it arrives', paragraphs: ['Compare every card with the listing: printing, language, condition, and quantity. Keep the shipping package and label. Record a video while opening the parcel, and take clear photos of any issue.'] },
        { heading: 'Send a report', steps: ['Sign in and open Market → My Market → Orders. Select the delivered order.', 'Use Report a problem on the order page. The report option is available for 48 hours after the carrier marks the order delivered.', 'Describe what is wrong and select the affected cards and quantities.', 'Choose the resolution you are requesting, refund for affected cards or a replacement shipment. Attach an unboxing video and relevant photos, then send the report.'] },
        { heading: 'What happens next', paragraphs: ['The seller can respond through the order report. VivrePlay staff review the report and evidence from both sides, then record the decision on the order. Keep communication and evidence on the order so the review has the full context.'] },
        { heading: 'If the report option is unavailable', paragraphs: ['The order may not yet be marked delivered, the 48-hour reporting window may have ended, or a report may already exist. Contact support@vivreplay.com or WhatsApp support with the order number and a short description. The Refund Policy explains what can be reviewed and how approved refunds are handled.'] },
        { heading: 'Evidence checklist', bullets: ['An unboxing video showing the parcel being opened and its contents.', 'Clear photos of affected cards and the shipping packaging or label, when relevant.', 'The card names and quantities affected.', 'A concise description that matches the evidence.'], note: 'Do not send payment card numbers, passwords, PINs, or one-time codes in a report.' },
      ],
      id: [
        { heading: 'Periksa pesanan saat tiba', paragraphs: ['Cocokkan setiap kartu dengan listing: cetakan, bahasa, kondisi, dan jumlah. Simpan paket serta label pengiriman. Rekam video saat membuka paket, lalu ambil foto yang jelas jika ada masalah.'] },
        { heading: 'Kirim laporan', steps: ['Masuk, lalu buka Market → Market saya → Pesanan. Pilih pesanan yang sudah diterima.', 'Gunakan Laporkan masalah di halaman pesanan. Opsi laporan tersedia selama 48 jam setelah kurir menandai pesanan terkirim.', 'Jelaskan masalah dan pilih kartu serta jumlah yang terdampak.', 'Pilih solusi yang diminta, refund untuk kartu terdampak atau pengiriman pengganti. Lampirkan video unboxing dan foto terkait, lalu kirim laporan.'] },
        { heading: 'Setelah laporan dikirim', paragraphs: ['Penjual dapat menanggapi melalui laporan pesanan. Tim VivrePlay meninjau laporan dan bukti dari kedua pihak, lalu mencatat keputusan pada pesanan. Simpan komunikasi dan bukti di halaman pesanan agar seluruh konteks dapat diperiksa.'] },
        { heading: 'Jika opsi laporan tidak tersedia', paragraphs: ['Pesanan mungkin belum ditandai terkirim, batas laporan 48 jam mungkin sudah lewat, atau laporan sudah pernah dibuat. Hubungi support@vivreplay.com atau WhatsApp dukungan dengan nomor pesanan dan penjelasan singkat. Kebijakan Pengembalian Dana menjelaskan hal yang dapat ditinjau dan cara refund yang disetujui diproses.'] },
        { heading: 'Bukti yang perlu disiapkan', bullets: ['Video unboxing yang memperlihatkan paket dibuka dan isinya.', 'Foto jelas kartu yang bermasalah serta kemasan atau label pengiriman jika relevan.', 'Nama dan jumlah kartu yang terdampak.', 'Penjelasan singkat yang sesuai dengan bukti.'], note: 'Jangan kirim nomor kartu pembayaran, kata sandi, PIN, atau kode sekali pakai dalam laporan.' },
      ],
    },
  },
  {
    slug: 'make-or-answer-an-offer', category: 'offers',
    title: { en: 'Make, counter, or answer an offer', id: 'Kirim, tawar balik, atau jawab penawaran' },
    summary: { en: 'Use the listing conversation to negotiate a price and keep the agreement attached to the cards.', id: 'Gunakan percakapan listing untuk menegosiasikan harga dan menyimpan kesepakatan bersama detail kartu.' },
    keywords: { en: ['offer', 'counteroffer', 'negotiate', 'accept', 'decline', 'seller'], id: ['penawaran', 'tawar balik', 'negosiasi', 'terima', 'tolak', 'penjual'] },
    action: { href: '/market', label: { en: 'Find a listing', id: 'Cari listing' } },
    related: ['request-listing-photos', 'buying-on-market', 'sell-cards-on-market'],
    sections: {
      en: [
        { heading: 'Send an offer', steps: ['Open the listing and choose Make an offer.', 'Enter the amount you want to offer for the listing and send it.', 'Check My Market → Offers for the seller’s response.'] },
        { heading: 'Reply to an offer', paragraphs: ['Open the offer from the Market account menu. Accept, decline, or send a counteroffer when those actions are available. A counteroffer needs a response from the other person before it becomes an agreement.'] },
        { heading: 'After an offer is accepted', paragraphs: ['Follow the checkout link shown in the offer conversation and check the final amount and delivery details before paying. An accepted offer does not replace checkout or payment confirmation.'] },
        { heading: 'Keep the conversation clear', bullets: ['Use the offer conversation for price and bundle changes.', 'Confirm the exact cards and quantities before agreeing.', 'Do not share passwords, PINs, or one-time codes.'] },
      ],
      id: [
        { heading: 'Kirim penawaran', steps: ['Buka listing dan pilih Buat penawaran.', 'Masukkan jumlah yang ingin Anda tawarkan untuk listing tersebut, lalu kirim.', 'Periksa Market saya → Penawaran untuk melihat jawaban penjual.'] },
        { heading: 'Jawab penawaran', paragraphs: ['Buka penawaran dari menu akun Market. Terima, tolak, atau kirim tawaran balik jika opsinya tersedia. Tawaran balik perlu dijawab pihak lain sebelum menjadi kesepakatan.'] },
        { heading: 'Setelah penawaran diterima', paragraphs: ['Ikuti tautan checkout yang muncul di percakapan penawaran, lalu periksa jumlah akhir dan detail pengiriman sebelum membayar. Penawaran yang diterima tetap perlu melalui checkout dan konfirmasi pembayaran.'] },
        { heading: 'Jaga percakapan tetap jelas', bullets: ['Gunakan percakapan penawaran untuk membahas harga dan perubahan bundle.', 'Pastikan kartu dan jumlahnya tepat sebelum menyetujui.', 'Jangan bagikan kata sandi, PIN, atau kode sekali pakai.'] },
      ],
    },
  },
  {
    slug: 'request-listing-photos', category: 'offers',
    title: { en: 'Ask a seller for more card photos', id: 'Minta foto kartu tambahan dari penjual' },
    summary: { en: 'Ask for specific views of a card and keep the photos with the listing conversation.', id: 'Minta sudut foto tertentu dan simpan foto bersama percakapan listing.' },
    keywords: { en: ['photo', 'photos', 'condition', 'back', 'seller', 'front'], id: ['foto', 'kondisi', 'belakang', 'penjual', 'depan'] },
    action: { href: '/market', label: { en: 'Open Market', id: 'Buka Market' } },
    related: ['make-or-answer-an-offer', 'buying-on-market', 'report-a-market-order-problem'],
    sections: {
      en: [
        { heading: 'Ask before you buy', paragraphs: ['Open the listing conversation and request the views you need. Be specific: front and back, corners, surface, or a close-up of a mark. For a bundle, name the exact card and quantity.'] },
        { heading: 'Review the reply', paragraphs: ['Check that the photos show the same printing and condition as the listing. If a photo changes your decision, ask the seller to update the listing details or clarify the offer before checkout.'] },
        { heading: 'Keep communication on VivrePlay', paragraphs: ['Use the listing or offer conversation so the request stays connected to the item. Do not move payment off-platform or share account verification codes.'] },
      ],
      id: [
        { heading: 'Tanyakan sebelum membeli', paragraphs: ['Buka percakapan listing dan minta sudut foto yang Anda perlukan. Sebutkan dengan jelas: depan dan belakang, sudut, permukaan, atau close-up bagian tertentu. Untuk bundle, sebut nama dan jumlah kartu yang dimaksud.'] },
        { heading: 'Periksa balasan', paragraphs: ['Pastikan foto menunjukkan cetakan dan kondisi yang sama dengan listing. Jika foto mengubah keputusan Anda, minta penjual memperbarui detail listing atau menjelaskan penawaran sebelum checkout.'] },
        { heading: 'Simpan komunikasi di VivrePlay', paragraphs: ['Gunakan percakapan listing atau penawaran agar permintaan tetap terhubung dengan barangnya. Jangan pindahkan pembayaran ke luar platform atau membagikan kode verifikasi akun.'] },
      ],
    },
  },
  {
    slug: 'sell-cards-on-market', category: 'selling',
    title: { en: 'List cards for sale', id: 'Pasang kartu untuk dijual' },
    summary: { en: 'Build one listing for a card or a bundle, with quantities and conditions set per card.', id: 'Buat satu listing untuk satu kartu atau bundle, dengan jumlah dan kondisi tiap kartu.' },
    keywords: { en: ['sell', 'listing', 'bundle', 'quantity', 'condition', 'price'], id: ['jual', 'listing', 'bundle', 'jumlah', 'kondisi', 'harga'] },
    action: { href: '/market', label: { en: 'Start a listing', id: 'Mulai membuat listing' } },
    related: ['ship-a-sold-order', 'make-or-answer-an-offer', 'manage-your-vault'],
    sections: {
      en: [
        { heading: 'Prepare the cards', paragraphs: ['Add the exact printings you own to your Vault first. For raw cards, choose the condition for each printing. For graded cards, record the slab and certification details in your collection.'] },
        { heading: 'Create the listing', steps: ['Open Market and choose Sell. Select cards from your Vault.', 'Group cards that you want to sell together into one bundle listing. Set the quantity, condition, and unit price for each card.', 'Add a clear title and notes, choose the delivery methods you support, and check the displayed total before publishing.'] },
        { heading: 'Manage the listing', paragraphs: ['Use My Market → My listings to edit, pause, renew, or close listings. Free and Pro listing limits and durations follow the current Market policy shown in the app.'] },
        { heading: 'Keep the listing accurate', bullets: ['Use photos that show the actual card when a buyer asks for them.', 'Update quantity as your available cards change.', 'Do not list cards you cannot ship or claim a condition you have not checked.'] },
      ],
      id: [
        { heading: 'Siapkan kartu', paragraphs: ['Tambahkan cetakan yang benar ke Vault terlebih dahulu. Untuk kartu raw, pilih kondisi tiap cetakan. Untuk kartu grading, catat slab dan detail sertifikasi di koleksi.'] },
        { heading: 'Buat listing', steps: ['Buka Market dan pilih Jual. Pilih kartu dari Vault.', 'Gabungkan kartu yang ingin dijual bersama ke dalam satu listing bundle. Atur jumlah, kondisi, dan harga satuan tiap kartu.', 'Isi judul dan catatan yang jelas, pilih metode pengiriman yang tersedia, lalu periksa total sebelum menerbitkan listing.'] },
        { heading: 'Kelola listing', paragraphs: ['Gunakan Market saya → Listing saya untuk mengedit, menjeda, memperpanjang, atau menutup listing. Batas dan durasi listing Free serta Pro mengikuti kebijakan Market yang tampil di aplikasi.'] },
        { heading: 'Pastikan listing akurat', bullets: ['Gunakan foto yang memperlihatkan kartu sebenarnya saat pembeli memintanya.', 'Perbarui jumlah saat stok kartu berubah.', 'Jangan pasang kartu yang tidak dapat dikirim atau mengklaim kondisi yang belum diperiksa.'] },
      ],
    },
  },
  {
    slug: 'ship-a-sold-order', category: 'selling',
    title: { en: 'Pack and ship a sold order', id: 'Kemas dan kirim pesanan terjual' },
    summary: { en: 'Check the paid order, pack the cards safely, and keep shipment details on the order.', id: 'Periksa pesanan yang sudah dibayar, kemas kartu dengan aman, dan simpan detail pengiriman pada pesanan.' },
    keywords: { en: ['seller', 'pack', 'shipping', 'courier', 'label', 'payout'], id: ['penjual', 'kemas', 'pengiriman', 'kurir', 'label', 'pencairan'] },
    action: { href: '/market', label: { en: 'Open seller orders', id: 'Buka pesanan penjual' } },
    related: ['sell-cards-on-market', 'track-a-market-order', 'report-a-market-order-problem'],
    sections: {
      en: [
        { heading: 'Before packing', steps: ['Open Market → My Market → Orders and confirm the order is paid.', 'Check the listed printings, quantities, and conditions against the cards you are preparing.', 'Protect each card with a sleeve and rigid support, then package the bundle so it cannot move or bend in transit.'] },
        { heading: 'Send the parcel', paragraphs: ['Use the courier and delivery method selected for the order. Add or confirm shipment details on the order page when the app requests them. Keep the drop-off receipt and tracking reference until the buyer confirms receipt.'] },
        { heading: 'If you cannot ship', paragraphs: ['Contact the buyer through the order as soon as possible. Do not mark an order as shipped before handing the parcel to the courier. Contact VivrePlay support if you need help with a cancelled or stuck order.'] },
      ],
      id: [
        { heading: 'Sebelum mengemas', steps: ['Buka Market → Market saya → Pesanan dan pastikan pesanan sudah dibayar.', 'Cocokkan cetakan, jumlah, dan kondisi pada pesanan dengan kartu yang akan dikirim.', 'Lindungi tiap kartu dengan sleeve dan pelindung kaku, lalu kemas bundle agar tidak bergeser atau tertekuk saat perjalanan.'] },
        { heading: 'Kirim paket', paragraphs: ['Gunakan kurir dan metode pengiriman yang dipilih pada pesanan. Tambahkan atau konfirmasi detail pengiriman di halaman pesanan saat diminta aplikasi. Simpan bukti serah terima dan nomor resi sampai pembeli mengonfirmasi penerimaan.'] },
        { heading: 'Jika tidak dapat mengirim', paragraphs: ['Hubungi pembeli melalui pesanan secepatnya. Jangan tandai pesanan terkirim sebelum paket diserahkan ke kurir. Hubungi dukungan VivrePlay jika Anda perlu bantuan untuk pesanan yang batal atau tertahan.'] },
      ],
    },
  },
  {
    slug: 'payment-and-refund-help', category: 'payments',
    title: { en: 'Payment problems and refunds', id: 'Masalah pembayaran dan refund' },
    summary: { en: 'What to do when a payment fails, appears twice, or does not match the order.', id: 'Langkah saat pembayaran gagal, tercatat dua kali, atau tidak sesuai dengan pesanan.' },
    keywords: { en: ['payment', 'failed', 'pending', 'duplicate', 'refund', 'pro', 'checkout'], id: ['pembayaran', 'gagal', 'tertunda', 'ganda', 'refund', 'pro', 'checkout'] },
    action: { href: '/legal/refund', label: { en: 'Read the Refund Policy', id: 'Baca Kebijakan Pengembalian Dana' } },
    related: ['buying-on-market', 'report-a-market-order-problem', 'track-a-market-order'],
    sections: {
      en: [
        { heading: 'A payment is pending or failed', paragraphs: ['Check the payment status and deadline on the order page before trying again. If your bank or wallet shows a debit but the order still says unpaid, do not create a second payment. Contact support with the order number, amount, payment time, and proof with sensitive details covered.'] },
        { heading: 'You see a duplicate or incorrect charge', steps: ['Keep the order number and a screenshot or receipt showing the amount and time.', 'Email support@vivreplay.com or message WhatsApp support with those details.', 'Never include a full card number, PIN, password, or one-time code.'] },
        { heading: 'Refund eligibility', paragraphs: ['Refund requests are reviewed under the Refund Policy. It covers duplicate or incorrect charges, cancelled orders, delivered-order reports, and Market Pro payment issues. A refund is not automatic when a buyer changes their mind after shipment.'] },
        { heading: 'Approved refunds', paragraphs: ['Approved refunds are sent manually to the original payment method. The time for funds to appear depends on the bank or e-wallet. The policy explains which card, service, and delivery amounts can be refunded in each case.'] },
      ],
      id: [
        { heading: 'Pembayaran tertunda atau gagal', paragraphs: ['Periksa status pembayaran dan batas waktu di halaman pesanan sebelum mencoba lagi. Jika bank atau dompet digital menunjukkan saldo terpotong tetapi pesanan masih belum dibayar, jangan membuat pembayaran kedua. Hubungi dukungan dengan nomor pesanan, jumlah, waktu pembayaran, serta bukti yang sudah menutupi detail sensitif.'] },
        { heading: 'Tagihan ganda atau jumlah tidak sesuai', steps: ['Simpan nomor pesanan dan tangkapan layar atau bukti yang menunjukkan jumlah serta waktunya.', 'Email support@vivreplay.com atau kirim pesan ke WhatsApp dukungan dengan detail tersebut.', 'Jangan sertakan nomor kartu lengkap, PIN, kata sandi, atau kode sekali pakai.'] },
        { heading: 'Ketentuan refund', paragraphs: ['Permintaan refund ditinjau berdasarkan Kebijakan Pengembalian Dana. Kebijakan tersebut mencakup tagihan ganda atau keliru, pesanan yang dibatalkan, laporan pesanan terkirim, serta masalah pembayaran Market Pro. Perubahan pikiran setelah pesanan dikirim tidak otomatis memenuhi syarat refund.'] },
        { heading: 'Refund yang disetujui', paragraphs: ['Refund yang disetujui dikirim secara manual ke metode pembayaran asal. Waktu dana masuk bergantung pada bank atau dompet digital. Kebijakan menjelaskan jumlah kartu, layanan, dan ongkir yang dapat dikembalikan pada tiap kasus.'] },
      ],
    },
  },
  {
    slug: 'manage-your-vault', category: 'collection',
    title: { en: 'Add cards and printings to your Vault', id: 'Tambahkan kartu dan cetakan ke Vault' },
    summary: { en: 'Record the exact printing you own, then use it in decks or Market listings.', id: 'Catat cetakan yang Anda miliki, lalu gunakan untuk deck atau listing Market.' },
    keywords: { en: ['vault', 'collection', 'printing', 'raw', 'slab', 'graded', 'quantity'], id: ['vault', 'koleksi', 'cetakan', 'raw', 'slab', 'grading', 'jumlah'] },
    action: { href: '/vault', label: { en: 'Open your Vault', id: 'Buka Vault' } },
    related: ['sell-cards-on-market', 'buying-on-market', 'account-access-and-security'],
    sections: {
      en: [
        { heading: 'Add a printing', steps: ['Sign in and open your Vault.', 'Find the card and choose the exact printing, language, and version you own.', 'Set the quantity and condition. Save the entry, then check that it appears in your collection.'] },
        { heading: 'Raw cards and slabs', paragraphs: ['Record raw cards with their printing, quantity, and condition. Use the slab entry flow for graded cards so the grading company, grade, and certification details stay with that item.'] },
        { heading: 'Use Vault cards elsewhere', paragraphs: ['The deck builder can use your collection to track owned copies. When creating a Market listing, choose cards from your Vault so the listing refers to the copies you have recorded.'] },
        { heading: 'A printing is missing', paragraphs: ['Open Feedback & reports and include the card code, set, language, and printing details. If the image is wrong, explain which version appears and which one should appear.'] },
      ],
      id: [
        { heading: 'Tambahkan cetakan', steps: ['Masuk dan buka Vault.', 'Cari kartu, lalu pilih cetakan, bahasa, dan versi yang benar.', 'Atur jumlah dan kondisi. Simpan, lalu pastikan entri muncul di koleksi.'] },
        { heading: 'Kartu raw dan slab', paragraphs: ['Catat kartu raw beserta cetakan, jumlah, dan kondisinya. Gunakan alur slab untuk kartu grading agar perusahaan grading, nilai, dan detail sertifikasi tersimpan pada item tersebut.'] },
        { heading: 'Gunakan kartu Vault di fitur lain', paragraphs: ['Pembuat deck dapat memakai koleksi untuk melacak salinan yang dimiliki. Saat membuat listing Market, pilih kartu dari Vault agar listing merujuk ke salinan yang Anda catat.'] },
        { heading: 'Cetakan belum tersedia', paragraphs: ['Buka Masukan & laporan dan sertakan kode kartu, set, bahasa, serta detail cetakan. Jika gambarnya salah, jelaskan versi yang tampil dan versi yang seharusnya.'] },
      ],
    },
  },
  {
    slug: 'account-access-and-security', category: 'account',
    title: { en: 'Account access and marketplace safety', id: 'Akses akun dan keamanan transaksi' },
    summary: { en: 'Recover access, protect sign-in details, and keep Market communication on-platform.', id: 'Pulihkan akses, lindungi detail login, dan simpan komunikasi Market di platform.' },
    keywords: { en: ['account', 'sign in', 'password', 'security', 'scam', 'report seller', 'report buyer'], id: ['akun', 'masuk', 'kata sandi', 'keamanan', 'penipuan', 'laporkan penjual', 'laporkan pembeli'] },
    action: { href: '/profile', label: { en: 'Open your profile', id: 'Buka profil' } },
    related: ['make-or-answer-an-offer', 'request-listing-photos', 'manage-your-vault'],
    sections: {
      en: [
        { heading: 'You cannot sign in', paragraphs: ['Use Forgot password on the sign-in page if you still control the account email. If you use Google sign-in, return to the same Google account you used to register. Contact support if you no longer have access to the email address.'] },
        { heading: 'Keep your account safe', bullets: ['Never share your password, PIN, or one-time verification code.', 'Keep offers, photo requests, and order conversations on VivrePlay.', 'Do not pay a seller outside the checkout for a Market order.', 'Check the listing and seller details before paying.'] },
        { heading: 'Report suspicious activity', paragraphs: ['Use Feedback & reports to describe the account, listing, or message and include a link or screenshot. For a paid order, use the order page so the report stays attached to the transaction.'] },
        { heading: 'Change your profile details', paragraphs: ['Open Profile to update your account information and delivery address. Confirm your address before checkout because shipping options and fees depend on the saved destination.'] },
      ],
      id: [
        { heading: 'Tidak bisa masuk', paragraphs: ['Gunakan Lupa kata sandi di halaman masuk jika Anda masih dapat membuka email akun. Jika memakai Google, kembali dengan akun Google yang sama seperti saat mendaftar. Hubungi dukungan jika Anda tidak lagi memiliki akses ke email tersebut.'] },
        { heading: 'Jaga keamanan akun', bullets: ['Jangan pernah membagikan kata sandi, PIN, atau kode verifikasi sekali pakai.', 'Simpan percakapan penawaran, permintaan foto, dan pesanan di VivrePlay.', 'Jangan membayar penjual di luar checkout untuk pesanan Market.', 'Periksa detail listing dan penjual sebelum membayar.'] },
        { heading: 'Laporkan aktivitas mencurigakan', paragraphs: ['Gunakan Masukan & laporan untuk menjelaskan akun, listing, atau pesan, lalu sertakan tautan atau tangkapan layar. Untuk pesanan yang sudah dibayar, gunakan halaman pesanan agar laporan terhubung ke transaksi.'] },
        { heading: 'Ubah detail profil', paragraphs: ['Buka Profil untuk memperbarui informasi akun dan alamat pengiriman. Pastikan alamat benar sebelum checkout karena opsi dan biaya pengiriman bergantung pada alamat tersimpan.'] },
      ],
    },
  },
  {
    slug: 'report-card-data-or-a-bug', category: 'account',
    title: { en: 'Report a missing card, printing, or site problem', id: 'Laporkan kartu, cetakan, atau masalah situs' },
    summary: { en: 'Send the card code and version details, or tell us how to reproduce a site issue.', id: 'Kirim kode kartu dan detail versinya, atau jelaskan langkah untuk menemukan masalah situs.' },
    keywords: { en: ['missing card', 'alt art', 'printing', 'image', 'bug', 'feedback', 'wrong data'], id: ['kartu hilang', 'alt art', 'cetakan', 'gambar', 'bug', 'masukan', 'data salah'] },
    action: { href: '/feedback', label: { en: 'Open feedback and reports', id: 'Buka masukan dan laporan' } },
    related: ['manage-your-vault', 'account-access-and-security'],
    sections: {
      en: [
        { heading: 'For card data or images', paragraphs: ['Include the card code, set, language, and printing or parallel number. For an image correction, tell us which image is shown and what the correct version should be. A source link helps us verify the printing.'] },
        { heading: 'For a site bug', steps: ['Open Feedback & reports.', 'Describe what you were trying to do and what happened instead.', 'List the steps that reproduce it, the page URL, and your device or browser if relevant. Add a screenshot when it helps show the problem.'] },
        { heading: 'For a Market order', paragraphs: ['Use the report control on the order page for a delivery or item problem. General feedback does not create an order dispute or pause a transaction review.'] },
      ],
      id: [
        { heading: 'Untuk data atau gambar kartu', paragraphs: ['Sertakan kode kartu, set, bahasa, serta nomor cetakan atau parallel. Untuk koreksi gambar, beri tahu gambar yang tampil dan versi yang seharusnya. Tautan sumber membantu kami memverifikasi cetakan.'] },
        { heading: 'Untuk bug situs', steps: ['Buka Masukan & laporan.', 'Jelaskan tindakan yang Anda lakukan dan hasil yang muncul.', 'Sertakan langkah untuk mengulanginya, URL halaman, serta perangkat atau browser jika relevan. Tambahkan tangkapan layar jika membantu menjelaskan masalah.'] },
        { heading: 'Untuk pesanan Market', paragraphs: ['Gunakan kontrol laporan di halaman pesanan untuk masalah barang atau pengiriman. Masukan umum tidak membuat sengketa pesanan atau menghentikan peninjauan transaksi.'] },
      ],
    },
  },
];

export function findHelpArticle(slug: string) {
  return helpArticles.find((article) => article.slug === slug);
}

export function helpArticleText(article: HelpArticle, locale: HelpLocale) {
  return {
    title: article.title[locale],
    summary: article.summary[locale],
    sections: article.sections[locale],
  };
}
