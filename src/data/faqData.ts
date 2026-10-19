import { FAQItem, TicketCategory } from '../types';

export interface FAQCategoryMeta {
  id: TicketCategory;
  label: string;
  description: string;
}

export const FAQ_CATEGORIES: FAQCategoryMeta[] = [
  {
    id: 'account_login',
    label: 'Account & Login',
    description: 'Sign-in options, email verification, passwords, and profile details.',
  },
  {
    id: 'finding_flatmates',
    label: 'Finding Flatmates',
    description: 'Profiles, lifestyle preferences, room sharing, and team-ups.',
  },
  {
    id: 'rooms_listings',
    label: 'Rooms & Listings',
    description: 'Publishing spaces, itemized costs, furnishing, and landlord rules.',
  },
  {
    id: 'family_stays_meals',
    label: 'Family Stays & Meals',
    description: 'Resident family homes, home-cooked food options, and co-living etiquette.',
  },
  {
    id: 'location',
    label: 'Location',
    description: 'Pan-India search, current location assistance, and manual entry.',
  },
  {
    id: 'verification',
    label: 'Verification',
    description: 'Listing freshness, phone verification, and moderation standards.',
  },
  {
    id: 'privacy_safety',
    label: 'Privacy & Safety',
    description: 'Scam prevention, advance payment rules, and address privacy.',
  },
  {
    id: 'technical_issues',
    label: 'Technical Issues',
    description: 'Site performance, photo uploads, browser compatibility, and errors.',
  },
];

export const FAQ_CATEGORY_LABELS: Record<TicketCategory, string> = {
  account_login: 'Account & Login',
  finding_flatmates: 'Finding Flatmates',
  rooms_listings: 'Rooms & Listings',
  family_stays_meals: 'Family Stays & Meals',
  location: 'Location',
  verification: 'Verification',
  privacy_safety: 'Privacy & Safety',
  technical_issues: 'Technical Issues',
  billing_fraud: 'Billing & Fraud',
  other: 'Other Marketplace Inquiries',
};

export const SAFETY_GUIDELINES = [
  {
    id: 'sg-1',
    title: 'Zero Advance Payments Before Physical Inspection',
    description:
      'Never transfer token money, booking amounts, or security deposits before visiting the home and meeting the flatmate or resident family in person. Aashvo does not operate escrow booking deposits.',
    severity: 'critical' as const,
  },
  {
    id: 'sg-2',
    title: 'Beware of UPI & QR Code Scams',
    description:
      'Fraudsters often claim to be military personnel or distant owners asking you to scan a QR code to "receive an advance" or pay a "society gate pass". Scanning a QR code only transfers money OUT of your bank account.',
    severity: 'critical' as const,
  },
  {
    id: 'sg-3',
    title: 'Never Share Passwords, OTPs or Banking PINs',
    description:
      'Aashvo representatives will NEVER contact you to ask for your password, email OTP, phone SMS code, or UPI PIN under any circumstance. Keep all one-time codes confidential.',
    severity: 'warning' as const,
  },
  {
    id: 'sg-4',
    title: 'Privacy Masking for Residential Addresses',
    description:
      'To protect the privacy of families and flatmates, exact door numbers and coordinates are masked publicly. Genuine hosts will provide apartment directions once an inquiry is accepted.',
    severity: 'info' as const,
  },
];

export const FAQ_ITEMS: FAQItem[] = [
  // 1. Account & Login
  {
    id: 'faq-acc-1',
    category: 'account_login',
    question: 'How do I create an account or sign in to Aashvo?',
    answer:
      'You can sign up using Google OAuth with one click or register with your email address and a secure password. If you sign up with email and password, a verification link will be sent to your inbox to activate your account.',
    helpfulCount: 42,
  },
  {
    id: 'faq-acc-2',
    category: 'account_login',
    question: 'Can I browse rooms and flatmate profiles without logging in?',
    answer:
      'Yes. Public browsing across flatmates, Family Stays, and entire flats is completely unrestricted. You are only prompted to authenticate when initiating direct contact inquiries or publishing a listing.',
    helpfulCount: 38,
  },
  {
    id: 'faq-acc-3',
    category: 'account_login',
    question: 'I forgot my password or cannot access my registered email. What should I do?',
    answer:
      'Use the "Forgot Password" link on the sign-in modal to trigger a password reset email. If you have lost access to your primary email address, open an unauthenticated support ticket below with your prior registration details.',
    helpfulCount: 19,
  },

  // 2. Finding Flatmates
  {
    id: 'faq-flt-1',
    category: 'finding_flatmates',
    question: 'How does Aashvo match flatmates and roommates?',
    answer:
      'Flatmates are matched based on lifestyle compatibility dimensions including food habits (Vegetarian, Non-Vegetarian, Eggetarian, Vegan), sleep schedules (Early Bird vs Night Owl), cleanliness expectations, pet friendliness, and budget ceilings.',
    helpfulCount: 56,
  },
  {
    id: 'faq-flt-2',
    category: 'finding_flatmates',
    question: 'What is the difference between "Has a Room" and "Seeking a Room"?',
    answer:
      'Users marked "Has a Room" currently occupy a flat and are looking for a flatmate to occupy a vacant bedroom. Users marked "Seeking a Room" are actively looking to join an existing flat or team up with others to rent a new flat together.',
    helpfulCount: 31,
  },
  {
    id: 'faq-flt-3',
    category: 'finding_flatmates',
    question: 'How can I connect with someone whose flatmate profile I like?',
    answer:
      'Click on their profile card to open the detail modal and click "Send Inquiry". To protect community safety, direct contact requires an active account with verified email and phone verification.',
    helpfulCount: 27,
  },

  // 3. Rooms & Listings
  {
    id: 'faq-rms-1',
    category: 'rooms_listings',
    question: 'Are listing prices on Aashvo guaranteed to have zero hidden charges?',
    answer:
      'Yes. Aashvo enforces radical cost transparency: monthly rent, security deposit, society maintenance, and electricity meter rates must be itemized before publishing. Imposing unlisted fees is grounds for permanent delisting.',
    helpfulCount: 64,
  },
  {
    id: 'faq-rms-2',
    category: 'rooms_listings',
    question: 'Do direct property owners pay any brokerage or listing fees?',
    answer:
      'No. Direct property owners list 100% free with ₹0 brokerage. Commercial managers or brokers must explicitly disclose their upfront service charge before their listing can be published.',
    helpfulCount: 49,
  },
  {
    id: 'faq-rms-3',
    category: 'rooms_listings',
    question: 'How often must listings be reconfirmed for freshness?',
    answer:
      'Hosts must reconfirm property availability every 14 days. Listings that are not reconfirmed will transition from "Active" to "Pending Review" and are deprioritized in search results.',
    helpfulCount: 22,
  },

  // 4. Family Stays & Meals
  {
    id: 'faq-fam-1',
    category: 'family_stays_meals',
    question: 'What is an Aashvo Family Stay and who is eligible to list one?',
    answer:
      'A Family Stay is a room inside the primary home of a resident family living on the premises full-time. Non-resident landlords, commercial brokers, PG agencies, and commercial boarding houses are strictly prohibited from publishing under this category.',
    helpfulCount: 71,
  },
  {
    id: 'faq-fam-2',
    category: 'family_stays_meals',
    question: 'How are meals priced and provided in Family Stays?',
    answer:
      'Hosts offer one of three canonical meal arrangements: (1) Meals Included in Rent (the monthly rent already covers daily food with zero double-counting), (2) Optional Extra (a transparent monthly food fee is offered), or (3) No Meals / Self-Catering.',
    helpfulCount: 53,
  },
  {
    id: 'faq-fam-3',
    category: 'family_stays_meals',
    question: 'Can I visit and sample the meal arrangements before deciding?',
    answer:
      'Yes. When scheduling a home visit with the resident family, you can discuss meal schedules, dietary preferences (such as pure vegetarian kitchens), and house guidelines.',
    helpfulCount: 29,
  },

  // 5. Location
  {
    id: 'faq-loc-1',
    category: 'location',
    question: 'Is Aashvo available across India?',
    answer:
      'Yes. Aashvo is a nationwide platform built for students and working professionals moving across Indian cities. Hosts and flatmates can list and discover accommodations across Delhi NCR, Bengaluru, Mumbai, Pune, Hyderabad, and university hubs nationwide with full address and privacy control.',
    helpfulCount: 39,
  },
  {
    id: 'faq-loc-2',
    category: 'location',
    question: 'How does the "Use Current Location" feature work during listing creation?',
    answer:
      'Clicking "Option A: Use Current Location" requests your device GPS coordinates to establish an initial latitude/longitude. You can freely refine the city, locality, and landmark before publishing. If GPS permission is denied, manual selection is always available.',
    helpfulCount: 24,
  },

  // 6. Verification
  {
    id: 'faq-ver-1',
    category: 'verification',
    question: 'Why does Aashvo require phone verification before submitting inquiries or listings?',
    answer:
      'Contextual phone verification ensures that inquiries and property listings come from genuine individuals with active phone numbers, discouraging spam inquiries, bot harvesters, and fraudulent listings.',
    helpfulCount: 46,
  },
  {
    id: 'faq-ver-2',
    category: 'verification',
    question: 'What does the "Confirmed Yesterday" or "Active Today" badge mean?',
    answer:
      'These badges show the exact timestamp when the host or current flatmate last verified the availability of their listing. Badges decay dynamically based on elapsed time.',
    helpfulCount: 33,
  },

  // 7. Privacy & Safety
  {
    id: 'faq-sec-1',
    category: 'privacy_safety',
    question: 'Why are exact door and flat numbers hidden on public listings?',
    answer:
      'To prevent unwanted unsolicited visits and protect host security, door numbers and private GPS coordinates are masked publicly. Unverified users only see the neighborhood and verified landmarks.',
    helpfulCount: 58,
  },
  {
    id: 'faq-sec-2',
    category: 'privacy_safety',
    question: 'What should I do if a host asks for advance money before meeting?',
    answer:
      'Decline immediately and use the "Report Listing" button on the property modal. Aashvo strictly advises users never to transfer funds before a physical meeting and agreement verification.',
    helpfulCount: 67,
  },

  // 8. Technical Issues
  {
    id: 'faq-tec-1',
    category: 'technical_issues',
    question: 'What image formats and sizes are supported for listing photo uploads?',
    answer:
      'Aashvo accepts JPEG, PNG, and WebP images up to 5MB per file. High-resolution horizontal landscape photos of bedrooms, common areas, and washrooms work best.',
    helpfulCount: 18,
  },
  {
    id: 'faq-tec-2',
    category: 'technical_issues',
    question: 'What response time can I expect when submitting a support ticket?',
    answer:
      'Our team reviews support inquiries in chronological order. We aim to respond within 24 to 48 business hours. Urgent safety and fraud reports are prioritized for rapid review.',
    helpfulCount: 35,
  },
];
