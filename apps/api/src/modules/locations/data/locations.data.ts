export interface LocalityDef {
  name: string;
  pincode?: string;
  metroLine?: string;
  landmarks?: string[];
}

export interface CityDef {
  id: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  popularLocalities: LocalityDef[];
}

export interface LandmarkDef {
  id: string;
  name: string;
  category: 'university' | 'office_park' | 'metro_station';
  city: string;
  locality: string;
  latitude: number;
  longitude: number;
  nearestMetro?: string;
}

export const SUPPORTED_INDIAN_CITIES: CityDef[] = [
  {
    id: 'delhi-ncr',
    name: 'Delhi NCR',
    state: 'Delhi',
    latitude: 28.6139,
    longitude: 77.209,
    popularLocalities: [
      { name: 'Hauz Khas', pincode: '110016', metroLine: 'Yellow Line', landmarks: ['IIT Delhi', 'Hauz Khas Village'] },
      { name: 'Saket', pincode: '110017', metroLine: 'Yellow Line', landmarks: ['Select Citywalk', 'Max Hospital'] },
      { name: 'North Campus', pincode: '110007', metroLine: 'Yellow Line', landmarks: ['Delhi University', 'Vishwa Vidyalaya'] },
      { name: 'Lajpat Nagar', pincode: '110024', metroLine: 'Violet Line', landmarks: ['Central Market'] },
      { name: 'Dwarka Sector 21', pincode: '110077', metroLine: 'Blue Line', landmarks: ['IGI Airport Metro'] },
      { name: 'Karol Bagh', pincode: '110005', metroLine: 'Blue Line', landmarks: ['IAS Coaching Hub'] },
    ],
  },
  {
    id: 'gurugram',
    name: 'Gurugram',
    state: 'Haryana',
    latitude: 28.4595,
    longitude: 77.0266,
    popularLocalities: [
      { name: 'Cyber City', pincode: '122002', metroLine: 'Rapid Metro', landmarks: ['DLF Phase 2', 'Cyber Hub'] },
      { name: 'DLF Phase 1', pincode: '122002', metroLine: 'Rapid Metro', landmarks: ['Sikanderpur'] },
      { name: 'Golf Course Road', pincode: '122011', metroLine: 'Rapid Metro', landmarks: ['Sector 54 Chowk'] },
      { name: 'Sector 48', pincode: '122018', landmarks: ['Sohna Road', 'Universal Trade Tower'] },
      { name: 'Sector 56', pincode: '122011', metroLine: 'Rapid Metro', landmarks: ['Huda City Centre Ext'] },
      { name: 'Sushant Lok 1', pincode: '122009', metroLine: 'Yellow Line', landmarks: ['IFFCO Chowk'] },
    ],
  },
  {
    id: 'noida',
    name: 'Noida',
    state: 'Uttar Pradesh',
    latitude: 28.5355,
    longitude: 77.391,
    popularLocalities: [
      { name: 'Sector 62', pincode: '201309', metroLine: 'Blue Line', landmarks: ['JIIT University', 'Electronic City'] },
      { name: 'Sector 18', pincode: '201301', metroLine: 'Blue Line', landmarks: ['Mall of India', 'Atta Market'] },
      { name: 'Sector 128', pincode: '201304', landmarks: ['Jaypee Wish Town', 'Noida Expressway'] },
      { name: 'Sector 137', pincode: '201305', metroLine: 'Aqua Line', landmarks: ['Expressway Towers'] },
      { name: 'Knowledge Park', pincode: '201310', metroLine: 'Aqua Line', landmarks: ['Greater Noida University Hub'] },
    ],
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru',
    state: 'Karnataka',
    latitude: 12.9716,
    longitude: 77.5946,
    popularLocalities: [
      { name: 'Koramangala', pincode: '560034', landmarks: ['Sony World Signal', 'Forum Mall'] },
      { name: 'Indiranagar', pincode: '560038', metroLine: 'Purple Line', landmarks: ['100 Feet Road'] },
      { name: 'HSR Layout', pincode: '560102', landmarks: ['27th Main Road', 'Startup Hub'] },
      { name: 'BTM Layout', pincode: '560076', landmarks: ['Udupi Garden'] },
      { name: 'Whitefield', pincode: '560066', metroLine: 'Purple Line', landmarks: ['ITPL', 'Phoenix Marketcity'] },
      { name: 'Bellandur', pincode: '560103', landmarks: ['EcoSpace', 'Outer Ring Road'] },
      { name: 'Electronic City', pincode: '560100', landmarks: ['Infosys Campus', 'Wipro Gate 5'] },
    ],
  },
  {
    id: 'pune',
    name: 'Pune',
    state: 'Maharashtra',
    latitude: 18.5204,
    longitude: 73.8567,
    popularLocalities: [
      { name: 'Hinjewadi', pincode: '411057', landmarks: ['Rajiv Gandhi Infotech Park Phase 1-3'] },
      { name: 'Viman Nagar', pincode: '411014', landmarks: ['Symbiosis Campus', 'Phoenix Marketcity'] },
      { name: 'Kothrud', pincode: '411038', landmarks: ['MIT College', 'Vanaz Metro'] },
      { name: 'Baner', pincode: '411045', landmarks: ['Balewadi High Street'] },
      { name: 'Wakad', pincode: '411057', landmarks: ['Dange Chowk', 'Bhumkar Chowk'] },
      { name: 'Koregaon Park', pincode: '411001', landmarks: ['North Main Road'] },
    ],
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    latitude: 19.076,
    longitude: 72.8777,
    popularLocalities: [
      { name: 'Powai', pincode: '400076', landmarks: ['IIT Bombay', 'Hiranandani'] },
      { name: 'Andheri West', pincode: '400058', metroLine: 'Line 1 / Line 2A', landmarks: ['Lokhandwala', 'DN Nagar'] },
      { name: 'Bandra West', pincode: '400050', landmarks: ['Hill Road', 'Linking Road'] },
      { name: 'Juhu', pincode: '400049', landmarks: ['NMIMS', 'Mithibai College'] },
      { name: 'Vashi', pincode: '400703', landmarks: ['Navi Mumbai Tech Zone'] },
    ],
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad',
    state: 'Telangana',
    latitude: 17.385,
    longitude: 78.4867,
    popularLocalities: [
      { name: 'Gachibowli', pincode: '500032', landmarks: ['IIIT Hyderabad', 'Financial District'] },
      { name: 'Madhapur', pincode: '500081', metroLine: 'Blue Line', landmarks: ['Hitec City', 'Inorbit Mall'] },
      { name: 'Kondapur', pincode: '500084', landmarks: ['Botanical Garden'] },
      { name: 'Banjara Hills', pincode: '500034', landmarks: ['Road No 12'] },
    ],
  },
];

export const VERIFIED_INDIAN_LANDMARKS: LandmarkDef[] = [
  // Delhi NCR / Gurugram / Noida
  { id: 'lm-iit-delhi', name: 'IIT Delhi', category: 'university', city: 'Delhi NCR', locality: 'Hauz Khas', latitude: 28.545, longitude: 77.1926, nearestMetro: 'IIT Metro Station (Magenta Line)' },
  { id: 'lm-du-north', name: 'Delhi University (North Campus)', category: 'university', city: 'Delhi NCR', locality: 'North Campus', latitude: 28.6892, longitude: 77.2104, nearestMetro: 'Vishwa Vidyalaya (Yellow Line)' },
  { id: 'lm-jiit-noida', name: 'Jaypee Institute of Information Technology (JIIT)', category: 'university', city: 'Noida', locality: 'Sector 62', latitude: 28.6297, longitude: 77.3721, nearestMetro: 'Noida Electronic City (Blue Line)' },
  { id: 'lm-cyber-hub', name: 'DLF Cyber Hub & Cyber City', category: 'office_park', city: 'Gurugram', locality: 'Cyber City', latitude: 28.4952, longitude: 77.0894, nearestMetro: 'Cyber City (Rapid Metro)' },
  { id: 'lm-golf-course', name: 'One Horizon Center & Golf Course Road', category: 'office_park', city: 'Gurugram', locality: 'Golf Course Road', latitude: 28.4735, longitude: 77.0984, nearestMetro: 'Sector 54 Chowk (Rapid Metro)' },
  { id: 'lm-noida-sec62-park', name: 'Noida Electronic City Tech Zone', category: 'office_park', city: 'Noida', locality: 'Sector 62', latitude: 28.625, longitude: 77.368, nearestMetro: 'Noida Electronic City (Blue Line)' },
  { id: 'lm-sikanderpur-metro', name: 'Sikanderpur Interchange Metro Station', category: 'metro_station', city: 'Gurugram', locality: 'DLF Phase 1', latitude: 28.4815, longitude: 77.0931, nearestMetro: 'Yellow Line & Rapid Metro' },
  { id: 'lm-hauz-khas-metro', name: 'Hauz Khas Interchange Metro Station', category: 'metro_station', city: 'Delhi NCR', locality: 'Hauz Khas', latitude: 28.5432, longitude: 77.2065, nearestMetro: 'Yellow Line & Magenta Line' },

  // Bengaluru
  { id: 'lm-christ-uni', name: 'Christ University (Main Campus)', category: 'university', city: 'Bengaluru', locality: 'Koramangala', latitude: 12.9343, longitude: 77.606, nearestMetro: 'South End Circle (Green Line)' },
  { id: 'lm-iisc-blr', name: 'Indian Institute of Science (IISc)', category: 'university', city: 'Bengaluru', locality: 'Malleshwaram', latitude: 13.0219, longitude: 77.5671, nearestMetro: 'Yeshwantpur (Green Line)' },
  { id: 'lm-manyata', name: 'Manyata Embassy Business Park', category: 'office_park', city: 'Bengaluru', locality: 'Nagavara', latitude: 13.0489, longitude: 77.6206, nearestMetro: 'Hebbal Commuter Link' },
  { id: 'lm-ecospace', name: 'Rmz EcoSpace & Bellandur ORR', category: 'office_park', city: 'Bengaluru', locality: 'Bellandur', latitude: 12.926, longitude: 77.6836, nearestMetro: 'Outer Ring Road Metro (Under Construction)' },
  { id: 'lm-indiranagar-metro', name: 'Indiranagar 100 Feet Metro', category: 'metro_station', city: 'Bengaluru', locality: 'Indiranagar', latitude: 12.9784, longitude: 77.6408, nearestMetro: 'Purple Line' },

  // Mumbai
  { id: 'lm-iit-bombay', name: 'IIT Bombay', category: 'university', city: 'Mumbai', locality: 'Powai', latitude: 19.1334, longitude: 72.9133, nearestMetro: 'Kanjurmarg / Line 6' },
  { id: 'lm-nmims-mumbai', name: 'NMIMS / Mithibai College', category: 'university', city: 'Mumbai', locality: 'Juhu', latitude: 19.1031, longitude: 72.8372, nearestMetro: 'Vile Parle Station' },
  { id: 'lm-bkc-park', name: 'Bandra Kurla Complex (BKC)', category: 'office_park', city: 'Mumbai', locality: 'Bandra', latitude: 19.0657, longitude: 72.8687, nearestMetro: 'BKC Metro (Aqua Line 3)' },

  // Pune
  { id: 'lm-symbiosis-pune', name: 'Symbiosis International University', category: 'university', city: 'Pune', locality: 'Viman Nagar', latitude: 18.563, longitude: 73.9126, nearestMetro: 'Ramwadi Metro (Aqua Line)' },
  { id: 'lm-hinjewadi-park', name: 'Rajiv Gandhi Infotech Park', category: 'office_park', city: 'Pune', locality: 'Hinjewadi', latitude: 18.5913, longitude: 73.7389, nearestMetro: 'Hinjewadi Metro Line 3' },

  // Hyderabad
  { id: 'lm-iiit-hyd', name: 'IIIT Hyderabad', category: 'university', city: 'Hyderabad', locality: 'Gachibowli', latitude: 17.445, longitude: 78.349, nearestMetro: 'Raidurg Metro' },
  { id: 'lm-hitec-city', name: 'Hitec City & Mindspace Cyberabad', category: 'office_park', city: 'Hyderabad', locality: 'Madhapur', latitude: 17.4435, longitude: 78.3772, nearestMetro: 'Hitec City (Blue Line)' },
];
