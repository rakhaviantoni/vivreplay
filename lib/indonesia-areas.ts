export interface IndonesianSubdistrict {
  name: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
}

export interface IndonesianDistrict {
  name: string;
  subdistricts: IndonesianSubdistrict[];
  latitude?: number;
  longitude?: number;
}

export interface IndonesianCity {
  name: string;
  type: 'Kota' | 'Kabupaten';
  districts: IndonesianDistrict[];
  latitude: number;
  longitude: number;
}

export interface IndonesianProvince {
  name: string;
  cities: IndonesianCity[];
  latitude: number;
  longitude: number;
}

export interface AreaSearchResult {
  id: string;
  name: string;
  province: string;
  city: string;
  district: string;
  subdistrict: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  source?: 'biteship'|'local';
}

export const INDONESIAN_REGIONS: IndonesianProvince[] = [
  {
    name: 'DKI Jakarta',
    latitude: -6.2088,
    longitude: 106.8456,
    cities: [
      {
        name: 'Jakarta Selatan',
        type: 'Kota',
        latitude: -6.2615,
        longitude: 106.8106,
        districts: [
          {
            name: 'Kebayoran Baru',
            latitude: -6.2444,
            longitude: 106.7997,
            subdistricts: [
              { name: 'Senayan', postalCode: '12190', latitude: -6.2241, longitude: 106.8032 },
              { name: 'Melawai', postalCode: '12160', latitude: -6.2442, longitude: 106.7983 },
              { name: 'Selong', postalCode: '12110', latitude: -6.2346, longitude: 106.8055 },
              { name: 'Gunung', postalCode: '12120', latitude: -6.2359, longitude: 106.7925 },
              { name: 'Kramat Pela', postalCode: '12130', latitude: -6.2448, longitude: 106.7909 },
              { name: 'Gandaria Utara', postalCode: '12140', latitude: -6.2558, longitude: 106.7904 },
              { name: 'Cipete Utara', postalCode: '12150', latitude: -6.2621, longitude: 106.8021 },
              { name: 'Pulo', postalCode: '12160', latitude: -6.2589, longitude: 106.8094 },
              { name: 'Petogogan', postalCode: '12170', latitude: -6.2458, longitude: 106.8078 },
              { name: 'Rawa Barat', postalCode: '12180', latitude: -6.2384, longitude: 106.8198 },
            ],
          },
          {
            name: 'Setiabudi',
            latitude: -6.2163,
            longitude: 106.8294,
            subdistricts: [
              { name: 'Setiabudi', postalCode: '12910', latitude: -6.2119, longitude: 106.8286 },
              { name: 'Karet', postalCode: '12920', latitude: -6.2165, longitude: 106.8211 },
              { name: 'Karet Semanggi', postalCode: '12930', latitude: -6.2244, longitude: 106.8184 },
              { name: 'Kuningan Timur', postalCode: '12950', latitude: -6.2347, longitude: 106.8281 },
              { name: 'Menteng Atas', postalCode: '12960', latitude: -6.2198, longitude: 106.8406 },
              { name: 'Pasar Manggis', postalCode: '12970', latitude: -6.2084, longitude: 106.8447 },
              { name: 'Guntur', postalCode: '12980', latitude: -6.2082, longitude: 106.8335 },
            ],
          },
          {
            name: 'Tebet',
            latitude: -6.2338,
            longitude: 106.8532,
            subdistricts: [
              { name: 'Tebet Barat', postalCode: '12810', latitude: -6.2378, longitude: 106.8475 },
              { name: 'Tebet Timur', postalCode: '12820', latitude: -6.2369, longitude: 106.8582 },
              { name: 'Kebon Baru', postalCode: '12830', latitude: -6.2334, longitude: 106.8647 },
              { name: 'Bukit Duri', postalCode: '12840', latitude: -6.2232, longitude: 106.8576 },
              { name: 'Manggarai', postalCode: '12850', latitude: -6.2111, longitude: 106.8519 },
              { name: 'Menteng Dalam', postalCode: '12870', latitude: -6.2281, longitude: 106.8436 },
            ],
          },
          {
            name: 'Cilandak',
            latitude: -6.2917,
            longitude: 106.7997,
            subdistricts: [
              { name: 'Cilandak Barat', postalCode: '12430', latitude: -6.2934, longitude: 106.7946 },
              { name: 'Cipete Selatan', postalCode: '12410', latitude: -6.2736, longitude: 106.8048 },
              { name: 'Gandaria Selatan', postalCode: '12420', latitude: -6.2705, longitude: 106.7937 },
              { name: 'Lebak Bulus', postalCode: '12440', latitude: -6.3015, longitude: 106.7794 },
              { name: 'Pondok Labu', postalCode: '12450', latitude: -6.3155, longitude: 106.7972 },
            ],
          },
          {
            name: 'Mampang Prapatan',
            latitude: -6.2514,
            longitude: 106.8278,
            subdistricts: [
              { name: 'Kuningan Barat', postalCode: '12710', latitude: -6.2396, longitude: 106.8252 },
              { name: 'Pela Mampang', postalCode: '12720', latitude: -6.2536, longitude: 106.8198 },
              { name: 'Bangka', postalCode: '12730', latitude: -6.2608, longitude: 106.8164 },
              { name: 'Mampang Prapatan', postalCode: '12790', latitude: -6.2482, longitude: 106.8275 },
              { name: 'Tegal Parang', postalCode: '12790', latitude: -6.2415, longitude: 106.8346 },
            ],
          },
          {
            name: 'Pasar Minggu',
            latitude: -6.2842,
            longitude: 106.8406,
            subdistricts: [
              { name: 'Pejaten Barat', postalCode: '12510', latitude: -6.2721, longitude: 106.8286 },
              { name: 'Pejaten Timur', postalCode: '12510', latitude: -6.2815, longitude: 106.8465 },
              { name: 'Pasar Minggu', postalCode: '12520', latitude: -6.2857, longitude: 106.8436 },
              { name: 'Kebagusan', postalCode: '12520', latitude: -6.3032, longitude: 106.8324 },
              { name: 'Jati Padang', postalCode: '12540', latitude: -6.2946, longitude: 106.8289 },
              { name: 'Ragunan', postalCode: '12550', latitude: -6.3075, longitude: 106.8202 },
              { name: 'Cilandak Timur', postalCode: '12560', latitude: -6.2961, longitude: 106.8145 },
            ],
          },
        ],
      },
      {
        name: 'Jakarta Pusat',
        type: 'Kota',
        latitude: -6.1865,
        longitude: 106.8341,
        districts: [
          {
            name: 'Gambir',
            latitude: -6.1754,
            longitude: 106.8272,
            subdistricts: [
              { name: 'Gambir', postalCode: '10110', latitude: -6.1764, longitude: 106.8302 },
              { name: 'Kebon Kelapa', postalCode: '10120', latitude: -6.1661, longitude: 106.8258 },
              { name: 'Petojo Selatan', postalCode: '10130', latitude: -6.1765, longitude: 106.8179 },
              { name: 'Duri Pulo', postalCode: '10140', latitude: -6.1648, longitude: 106.8087 },
              { name: 'Petojo Utara', postalCode: '10150', latitude: -6.1624, longitude: 106.8176 },
              { name: 'Cideng', postalCode: '10150', latitude: -6.1741, longitude: 106.8115 },
            ],
          },
          {
            name: 'Tanah Abang',
            latitude: -6.1956,
            longitude: 106.8142,
            subdistricts: [
              { name: 'Bendungan Hilir', postalCode: '10210', latitude: -6.2155, longitude: 106.8135 },
              { name: 'Karet Tengsin', postalCode: '10220', latitude: -6.2084, longitude: 106.8172 },
              { name: 'Kebon Melati', postalCode: '10230', latitude: -6.1994, longitude: 106.8184 },
              { name: 'Kebon Kacang', postalCode: '10240', latitude: -6.1924, longitude: 106.8181 },
              { name: 'Kampung Bali', postalCode: '10250', latitude: -6.1872, longitude: 106.8202 },
              { name: 'Petamburan', postalCode: '10260', latitude: -6.1956, longitude: 106.8035 },
              { name: 'Gelora', postalCode: '10270', latitude: -6.2168, longitude: 106.7995 },
            ],
          },
          {
            name: 'Menteng',
            latitude: -6.1963,
            longitude: 106.8335,
            subdistricts: [
              { name: 'Menteng', postalCode: '10310', latitude: -6.1945, longitude: 106.8306 },
              { name: 'Pegangsaan', postalCode: '10320', latitude: -6.2014, longitude: 106.8458 },
              { name: 'Cikini', postalCode: '10330', latitude: -6.1918, longitude: 106.8402 },
              { name: 'Gondangdia', postalCode: '10350', latitude: -6.1878, longitude: 106.8334 },
            ],
          },
          {
            name: 'Kemayoran',
            latitude: -6.1602,
            longitude: 106.8504,
            subdistricts: [
              { name: 'Gunung Sahari Selatan', postalCode: '10610' },
              { name: 'Kemayoran', postalCode: '10620' },
              { name: 'Kebon Kosong', postalCode: '10630' },
              { name: 'Cempaka Baru', postalCode: '10640' },
              { name: 'Harapan Mulya', postalCode: '10640' },
              { name: 'Sumur Batu', postalCode: '10640' },
              { name: 'Serdang', postalCode: '10650' },
              { name: 'Utan Panjang', postalCode: '10650' },
            ],
          },
        ],
      },
      {
        name: 'Jakarta Barat',
        type: 'Kota',
        latitude: -6.1683,
        longitude: 106.7588,
        districts: [
          {
            name: 'Kebon Jeruk',
            latitude: -6.1942,
            longitude: 106.7681,
            subdistricts: [
              { name: 'Duri Kepa', postalCode: '11510', latitude: -6.1772, longitude: 106.7765 },
              { name: 'Kedoya Selatan', postalCode: '11520', latitude: -6.1884, longitude: 106.7612 },
              { name: 'Kedoya Utara', postalCode: '11520', latitude: -6.1685, longitude: 106.7621 },
              { name: 'Kebon Jeruk', postalCode: '11530', latitude: -6.1932, longitude: 106.7745 },
              { name: 'Sukabumi Utara', postalCode: '11540', latitude: -6.2054, longitude: 106.7786 },
              { name: 'Kelapa Dua', postalCode: '11550', latitude: -6.2045, longitude: 106.7694 },
              { name: 'Sukabumi Selatan', postalCode: '11560', latitude: -6.2162, longitude: 106.7758 },
            ],
          },
          {
            name: 'Grogol Petamburan',
            latitude: -6.1648,
            longitude: 106.7884,
            subdistricts: [
              { name: 'Tomang', postalCode: '11440', latitude: -6.1775, longitude: 106.7972 },
              { name: 'Grogol', postalCode: '11450', latitude: -6.1624, longitude: 106.7892 },
              { name: 'Jelambar', postalCode: '11460', latitude: -6.1558, longitude: 106.7825 },
              { name: 'Tanjung Duren Utara', postalCode: '11470', latitude: -6.1724, longitude: 106.7845 },
              { name: 'Tanjung Duren Selatan', postalCode: '11470', latitude: -6.1812, longitude: 106.7856 },
            ],
          },
        ],
      },
      {
        name: 'Jakarta Utara',
        type: 'Kota',
        latitude: -6.1214,
        longitude: 106.8789,
        districts: [
          {
            name: 'Kelapa Gading',
            latitude: -6.1601,
            longitude: 106.9084,
            subdistricts: [
              { name: 'Kelapa Gading Barat', postalCode: '14240', latitude: -6.1565, longitude: 106.8972 },
              { name: 'Kelapa Gading Timur', postalCode: '14240', latitude: -6.1632, longitude: 106.9145 },
              { name: 'Pegangsaan Dua', postalCode: '14250', latitude: -6.1742, longitude: 106.9189 },
            ],
          },
          {
            name: 'Penjaringan',
            latitude: -6.1189,
            longitude: 106.7925,
            subdistricts: [
              { name: 'Pluit', postalCode: '14450', latitude: -6.1258, longitude: 106.7915 },
              { name: 'Pejagalan', postalCode: '14450', latitude: -6.1362, longitude: 106.7884 },
              { name: 'Penjaringan', postalCode: '14440', latitude: -6.1245, longitude: 106.8045 },
              { name: 'Kapuk Muara', postalCode: '14460', latitude: -6.1315, longitude: 106.7682 },
              { name: 'Kamal Muara', postalCode: '14470', latitude: -6.1084, longitude: 106.7321 },
            ],
          },
        ],
      },
      {
        name: 'Jakarta Timur',
        type: 'Kota',
        latitude: -6.225,
        longitude: 106.9004,
        districts: [
          {
            name: 'Jatinegara',
            latitude: -6.2285,
            longitude: 106.8724,
            subdistricts: [
              { name: 'Kampung Melayu', postalCode: '13320', latitude: -6.2275, longitude: 106.8624 },
              { name: 'Bidara Cina', postalCode: '13330', latitude: -6.2345, longitude: 106.8672 },
              { name: 'Cipinang Cempedak', postalCode: '13340', latitude: -6.2415, longitude: 106.8725 },
              { name: 'Rawa Bunga', postalCode: '13350', latitude: -6.2224, longitude: 106.8698 },
            ],
          },
          {
            name: 'Duren Sawit',
            latitude: -6.2345,
            longitude: 106.9185,
            subdistricts: [
              { name: 'Duren Sawit', postalCode: '13440', latitude: -6.2345, longitude: 106.9185 },
              { name: 'Pondok Bambu', postalCode: '13430', latitude: -6.2312, longitude: 106.9025 },
              { name: 'Pondok Kelapa', postalCode: '13450', latitude: -6.2385, longitude: 106.9362 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Jawa Barat',
    latitude: -6.9175,
    longitude: 107.6191,
    cities: [
      {
        name: 'Kota Bandung',
        type: 'Kota',
        latitude: -6.9175,
        longitude: 107.6191,
        districts: [
          {
            name: 'Coblong',
            latitude: -6.8858,
            longitude: 107.6148,
            subdistricts: [
              { name: 'Dago', postalCode: '40135', latitude: -6.8785, longitude: 107.6178 },
              { name: 'Lebak Siliwangi', postalCode: '40132', latitude: -6.8862, longitude: 107.6115 },
              { name: 'Sadang Serang', postalCode: '40133', latitude: -6.8924, longitude: 107.6215 },
              { name: 'Sekeloa', postalCode: '40134', latitude: -6.8905, longitude: 107.6158 },
            ],
          },
          {
            name: 'Sumur Bandung',
            latitude: -6.9184,
            longitude: 107.6135,
            subdistricts: [
              { name: 'Braga', postalCode: '40111', latitude: -6.9175, longitude: 107.6095 },
              { name: 'Kebon Pisang', postalCode: '40112', latitude: -6.9205, longitude: 107.6185 },
              { name: 'Merdeka', postalCode: '40113', latitude: -6.9125, longitude: 107.6115 },
            ],
          },
          {
            name: 'Bandung Wetan',
            latitude: -6.9035,
            longitude: 107.6185,
            subdistricts: [
              { name: 'Citarum', postalCode: '40115', latitude: -6.9025, longitude: 107.6185 },
              { name: 'Tamansari', postalCode: '40116', latitude: -6.8985, longitude: 107.6105 },
              { name: 'Cihapit', postalCode: '40114', latitude: -6.9095, longitude: 107.6255 },
            ],
          },
        ],
      },
      {
        name: 'Kota Bekasi',
        type: 'Kota',
        latitude: -6.2383,
        longitude: 106.9756,
        districts: [
          {
            name: 'Bekasi Selatan',
            latitude: -6.2545,
            longitude: 106.9825,
            subdistricts: [
              { name: 'Pekayon Jaya', postalCode: '17148', latitude: -6.2625, longitude: 106.9845 },
              { name: 'Jaka Setia', postalCode: '17147', latitude: -6.2585, longitude: 106.9725 },
              { name: 'Kayuringin Jaya', postalCode: '17144', latitude: -6.2425, longitude: 106.9835 },
            ],
          },
          {
            name: 'Bekasi Barat',
            latitude: -6.2325,
            longitude: 106.9685,
            subdistricts: [
              { name: 'Kranji', postalCode: '17135', latitude: -6.2285, longitude: 106.9625 },
              { name: 'Kota Baru', postalCode: '17133', latitude: -6.2245, longitude: 106.9745 },
              { name: 'Bintara', postalCode: '17134', latitude: -6.2345, longitude: 106.9585 },
            ],
          },
        ],
      },
      {
        name: 'Kota Depok',
        type: 'Kota',
        latitude: -6.4025,
        longitude: 106.7942,
        districts: [
          {
            name: 'Beji',
            latitude: -6.3725,
            longitude: 106.8245,
            subdistricts: [
              { name: 'Pondok Cina', postalCode: '16424', latitude: -6.3685, longitude: 106.8325 },
              { name: 'Kukusan', postalCode: '16425', latitude: -6.3625, longitude: 106.8185 },
              { name: 'Kemiri Muka', postalCode: '16423', latitude: -6.3815, longitude: 106.8275 },
            ],
          },
          {
            name: 'Pancoran Mas',
            latitude: -6.3985,
            longitude: 106.8125,
            subdistricts: [
              { name: 'Depok', postalCode: '16431', latitude: -6.3985, longitude: 106.8185 },
              { name: 'Depok Jaya', postalCode: '16432', latitude: -6.3915, longitude: 106.8095 },
            ],
          },
        ],
      },
      {
        name: 'Kota Bogor',
        type: 'Kota',
        latitude: -6.5971,
        longitude: 106.806,
        districts: [
          {
            name: 'Bogor Tengah',
            latitude: -6.5955,
            longitude: 106.7985,
            subdistricts: [
              { name: 'Pabaton', postalCode: '16121', latitude: -6.5915, longitude: 106.7925 },
              { name: 'Babakan', postalCode: '16128', latitude: -6.5885, longitude: 106.8045 },
              { name: 'Tegallega', postalCode: '16129', latitude: -6.6015, longitude: 106.8085 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Banten',
    latitude: -6.12,
    longitude: 106.15,
    cities: [
      {
        name: 'Kota Tangerang',
        type: 'Kota',
        latitude: -6.1783,
        longitude: 106.6319,
        districts: [
          {
            name: 'Tangerang',
            latitude: -6.1785,
            longitude: 106.6325,
            subdistricts: [
              { name: 'Sukarasa', postalCode: '15111', latitude: -6.1755, longitude: 106.6315 },
              { name: 'Sukasari', postalCode: '15118', latitude: -6.1825, longitude: 106.6385 },
            ],
          },
          {
            name: 'Cipondoh',
            latitude: -6.1925,
            longitude: 106.6785,
            subdistricts: [
              { name: 'Cipondoh', postalCode: '15148', latitude: -6.1925, longitude: 106.6785 },
              { name: 'Petir', postalCode: '15147', latitude: -6.1985, longitude: 106.6925 },
            ],
          },
        ],
      },
      {
        name: 'Kota Tangerang Selatan',
        type: 'Kota',
        latitude: -6.2889,
        longitude: 106.7178,
        districts: [
          {
            name: 'Serpong',
            latitude: -6.3125,
            longitude: 106.6685,
            subdistricts: [
              { name: 'Lengkong Gudang', postalCode: '15321', latitude: -6.3025, longitude: 106.6725 },
              { name: 'Rawa Buntu', postalCode: '15318', latitude: -6.3215, longitude: 106.6815 },
              { name: 'Cilenggang', postalCode: '15310', latitude: -6.3155, longitude: 106.6695 },
            ],
          },
          {
            name: 'Serpong Utara',
            latitude: -6.2625,
            longitude: 106.6585,
            subdistricts: [
              { name: 'Pakulonan', postalCode: '15325', latitude: -6.2485, longitude: 106.6525 },
              { name: 'Paku Alam', postalCode: '15320', latitude: -6.2585, longitude: 106.6625 },
            ],
          },
          {
            name: 'Pondok Aren',
            latitude: -6.2685,
            longitude: 106.7125,
            subdistricts: [
              { name: 'Pondok Betung', postalCode: '15221', latitude: -6.2655, longitude: 106.7415 },
              { name: 'Bintaro', postalCode: '15222', latitude: -6.2715, longitude: 106.7255 },
              { name: 'Jurang Mangu Timur', postalCode: '15222', latitude: -6.2785, longitude: 106.7185 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Jawa Timur',
    latitude: -7.5361,
    longitude: 112.2384,
    cities: [
      {
        name: 'Kota Surabaya',
        type: 'Kota',
        latitude: -7.2575,
        longitude: 112.7521,
        districts: [
          {
            name: 'Gubeng',
            latitude: -7.2745,
            longitude: 112.7585,
            subdistricts: [
              { name: 'Airlangga', postalCode: '60286', latitude: -7.2725, longitude: 112.7585 },
              { name: 'Kertajaya', postalCode: '60282', latitude: -7.2785, longitude: 112.7615 },
              { name: 'Pucang Sewu', postalCode: '60283', latitude: -7.2845, longitude: 112.7525 },
              { name: 'Baratajaya', postalCode: '60284', latitude: -7.2915, longitude: 112.7585 },
              { name: 'Mojo', postalCode: '60285', latitude: -7.2685, longitude: 112.7645 },
            ],
          },
          {
            name: 'Tegalsari',
            latitude: -7.2685,
            longitude: 112.7385,
            subdistricts: [
              { name: 'Kedungdoro', postalCode: '60261', latitude: -7.2615, longitude: 112.7345 },
              { name: 'Dr. Soetomo', postalCode: '60264', latitude: -7.2745, longitude: 112.7385 },
            ],
          },
        ],
      },
      {
        name: 'Kota Malang',
        type: 'Kota',
        latitude: -7.9666,
        longitude: 112.6326,
        districts: [
          {
            name: 'Klojen',
            latitude: -7.9785,
            longitude: 112.6285,
            subdistricts: [
              { name: 'Kauman', postalCode: '65119', latitude: -7.9825, longitude: 112.6285 },
              { name: 'Oro-oro Dowo', postalCode: '65112', latitude: -7.9685, longitude: 112.6245 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'DI Yogyakarta',
    latitude: -7.7956,
    longitude: 110.3695,
    cities: [
      {
        name: 'Kota Yogyakarta',
        type: 'Kota',
        latitude: -7.7956,
        longitude: 110.3695,
        districts: [
          {
            name: 'Gondomanan',
            latitude: -7.8015,
            longitude: 110.3685,
            subdistricts: [
              { name: 'Ngupasan', postalCode: '55122', latitude: -7.7985, longitude: 110.3655 },
              { name: 'Prawirodirjan', postalCode: '55121', latitude: -7.8045, longitude: 110.3715 },
            ],
          },
          {
            name: 'Danurejan',
            latitude: -7.7945,
            longitude: 110.3745,
            subdistricts: [
              { name: 'Suryatmajan', postalCode: '55213', latitude: -7.7945, longitude: 110.3715 },
              { name: 'Bausasran', postalCode: '55211', latitude: -7.7935, longitude: 110.3785 },
            ],
          },
        ],
      },
      {
        name: 'Kabupaten Sleman',
        type: 'Kabupaten',
        latitude: -7.7167,
        longitude: 110.3556,
        districts: [
          {
            name: 'Depok',
            latitude: -7.7685,
            longitude: 110.4045,
            subdistricts: [
              { name: 'Caturtunggal', postalCode: '55281', latitude: -7.7785, longitude: 110.3945 },
              { name: 'Maguwoharjo', postalCode: '55282', latitude: -7.7685, longitude: 110.4285 },
              { name: 'Condongcatur', postalCode: '55283', latitude: -7.7565, longitude: 110.4015 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Jawa Tengah',
    latitude: -6.9932,
    longitude: 110.4203,
    cities: [
      {
        name: 'Kota Semarang',
        type: 'Kota',
        latitude: -6.9932,
        longitude: 110.4203,
        districts: [
          {
            name: 'Semarang Tengah',
            latitude: -6.9825,
            longitude: 110.4185,
            subdistricts: [
              { name: 'Pendrikan Kidul', postalCode: '50131', latitude: -6.9815, longitude: 110.4085 },
              { name: 'Sekayu', postalCode: '50132', latitude: -6.9825, longitude: 110.4165 },
              { name: 'Pekunden', postalCode: '50134', latitude: -6.9885, longitude: 110.4215 },
            ],
          },
        ],
      },
      {
        name: 'Kota Surakarta',
        type: 'Kota',
        latitude: -7.5666,
        longitude: 110.8166,
        districts: [
          {
            name: 'Banjarsari',
            latitude: -7.5485,
            longitude: 110.8245,
            subdistricts: [
              { name: 'Manahan', postalCode: '57139', latitude: -7.5525, longitude: 110.8045 },
              { name: 'Kestalan', postalCode: '57132', latitude: -7.5585, longitude: 110.8215 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Bali',
    latitude: -8.4095,
    longitude: 115.1889,
    cities: [
      {
        name: 'Kota Denpasar',
        type: 'Kota',
        latitude: -8.6705,
        longitude: 115.2126,
        districts: [
          {
            name: 'Denpasar Selatan',
            latitude: -8.6945,
            longitude: 115.2285,
            subdistricts: [
              { name: 'Sanur', postalCode: '80228', latitude: -8.6885, longitude: 115.2615 },
              { name: 'Panjer', postalCode: '80225', latitude: -8.6815, longitude: 115.2245 },
              { name: 'Renon', postalCode: '80226', latitude: -8.6745, longitude: 115.2345 },
              { name: 'Sesetan', postalCode: '80223', latitude: -8.7045, longitude: 115.2185 },
              { name: 'Pedungan', postalCode: '80222', latitude: -8.7115, longitude: 115.2085 },
            ],
          },
          {
            name: 'Denpasar Barat',
            latitude: -8.6625,
            longitude: 115.1945,
            subdistricts: [
              { name: 'Pemecutan', postalCode: '80112', latitude: -8.6585, longitude: 115.2045 },
              { name: 'Dauh Puri', postalCode: '80113', latitude: -8.6655, longitude: 115.2115 },
            ],
          },
        ],
      },
      {
        name: 'Kabupaten Badung',
        type: 'Kabupaten',
        latitude: -8.5833,
        longitude: 115.1833,
        districts: [
          {
            name: 'Kuta',
            latitude: -8.7245,
            longitude: 115.1785,
            subdistricts: [
              { name: 'Legian', postalCode: '80361', latitude: -8.7085, longitude: 115.1725 },
              { name: 'Seminyak', postalCode: '80361', latitude: -8.6915, longitude: 115.1665 },
              { name: 'Kuta', postalCode: '80361', latitude: -8.7245, longitude: 115.1785 },
            ],
          },
          {
            name: 'Kuta Utara',
            latitude: -8.6485,
            longitude: 115.1585,
            subdistricts: [
              { name: 'Canggu', postalCode: '80351', latitude: -8.6485, longitude: 115.1385 },
              { name: 'Kerobokan Kelod', postalCode: '80361', latitude: -8.6685, longitude: 115.1645 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Sumatera Utara',
    latitude: 2.1154,
    longitude: 99.5451,
    cities: [
      {
        name: 'Kota Medan',
        type: 'Kota',
        latitude: 3.5952,
        longitude: 98.6722,
        districts: [
          {
            name: 'Medan Baru',
            latitude: 3.5785,
            longitude: 98.6615,
            subdistricts: [
              { name: 'Petisah Hulu', postalCode: '20152', latitude: 3.5845, longitude: 98.6685 },
              { name: 'Babura', postalCode: '20154', latitude: 3.5745, longitude: 98.6585 },
            ],
          },
          {
            name: 'Medan Kota',
            latitude: 3.5815,
            longitude: 98.6885,
            subdistricts: [
              { name: 'Pasar Baru', postalCode: '20212', latitude: 3.5845, longitude: 98.6845 },
              { name: 'Mesjid', postalCode: '20213', latitude: 3.5785, longitude: 98.6895 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Sulawesi Selatan',
    latitude: -5.1477,
    longitude: 119.4327,
    cities: [
      {
        name: 'Kota Makassar',
        type: 'Kota',
        latitude: -5.1477,
        longitude: 119.4327,
        districts: [
          {
            name: 'Panakkukang',
            latitude: -5.1425,
            longitude: 119.4515,
            subdistricts: [
              { name: 'Masale', postalCode: '90231', latitude: -5.1445, longitude: 119.4485 },
              { name: 'Pannampu', postalCode: '90232', latitude: -5.1385, longitude: 119.4545 },
            ],
          },
        ],
      },
    ],
  },
];

export function getProvinces(): string[] {
  return INDONESIAN_REGIONS.map(p => p.name);
}

export function getCities(provinceName: string): IndonesianCity[] {
  const prov = INDONESIAN_REGIONS.find(p => p.name.toLowerCase() === provinceName.toLowerCase());
  return prov ? prov.cities : [];
}

export function getDistricts(provinceName: string, cityName: string): IndonesianDistrict[] {
  const prov = INDONESIAN_REGIONS.find(p => p.name.toLowerCase() === provinceName.toLowerCase());
  if (!prov) return [];
  const city = prov.cities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
  return city ? city.districts : [];
}

export function getSubdistricts(provinceName: string, cityName: string, districtName: string): IndonesianSubdistrict[] {
  const prov = INDONESIAN_REGIONS.find(p => p.name.toLowerCase() === provinceName.toLowerCase());
  if (!prov) return [];
  const city = prov.cities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
  if (!city) return [];
  const district = city.districts.find(d => d.name.toLowerCase() === districtName.toLowerCase());
  return district ? district.subdistricts : [];
}

export function searchIndonesianAreas(query: string): AreaSearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const results: AreaSearchResult[] = [];

  for (const prov of INDONESIAN_REGIONS) {
    for (const city of prov.cities) {
      for (const dist of city.districts) {
        for (const sub of dist.subdistricts) {
          const combined = `${sub.name}, ${dist.name}, ${city.name}, ${prov.name}, ${sub.postalCode}`.toLowerCase();
          if (combined.includes(q) || sub.name.toLowerCase().includes(q) || dist.name.toLowerCase().includes(q) || city.name.toLowerCase().includes(q) || sub.postalCode.includes(q)) {
            const id = `ID-${prov.name.slice(0, 3).toUpperCase()}-${dist.name.replace(/\s+/g, '')}-${sub.postalCode}`;
            results.push({
              id,
              name: `${sub.name}, ${dist.name}, ${city.name}, ${prov.name}`,
              province: prov.name,
              city: city.name,
              district: dist.name,
              subdistrict: sub.name,
              postalCode: sub.postalCode,
              latitude: sub.latitude ?? dist.latitude ?? city.latitude,
              longitude: sub.longitude ?? dist.longitude ?? city.longitude,
            });
            if (results.length >= 10) return results;
          }
        }
      }
    }
  }

  return results;
}

export function getCoordinatesForArea(provinceName: string, cityName?: string, districtName?: string, subdistrictName?: string): { lat: number; lng: number } | null {
  const prov = INDONESIAN_REGIONS.find(p => p.name.toLowerCase() === provinceName.toLowerCase());
  if (!prov) return null;

  if (!cityName) return { lat: prov.latitude, lng: prov.longitude };

  const city = prov.cities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
  if (!city) return { lat: prov.latitude, lng: prov.longitude };

  if (!districtName) return { lat: city.latitude, lng: city.longitude };

  const dist = city.districts.find(d => d.name.toLowerCase() === districtName.toLowerCase());
  if (!dist) return { lat: city.latitude, lng: city.longitude };

  if (!subdistrictName) return { lat: dist.latitude ?? city.latitude, lng: dist.longitude ?? city.longitude };

  const sub = dist.subdistricts.find(s => s.name.toLowerCase() === subdistrictName.toLowerCase());
  if (sub && sub.latitude && sub.longitude) {
    return { lat: sub.latitude, lng: sub.longitude };
  }

  return { lat: dist.latitude ?? city.latitude, lng: dist.longitude ?? city.longitude };
}
