import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import bn from '@/locales/bn.json';
import en from '@/locales/en.json';
import gu from '@/locales/gu.json';
import hi from '@/locales/hi.json';
import kn from '@/locales/kn.json';
import ml from '@/locales/ml.json';
import mr from '@/locales/mr.json';
import or from '@/locales/or.json';
import pa from '@/locales/pa.json';
import ta from '@/locales/ta.json';
import te from '@/locales/te.json';

export interface AppLanguage {
  code: string;
  bcp47: string;
  native: string;
  english: string;
}

export const LANGUAGES: AppLanguage[] = [
  { code: 'hi', bcp47: 'hi-IN', native: 'हिन्दी', english: 'Hindi' },
  { code: 'en', bcp47: 'en-IN', native: 'English', english: 'English' },
  { code: 'mr', bcp47: 'mr-IN', native: 'मराठी', english: 'Marathi' },
  { code: 'pa', bcp47: 'pa-IN', native: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
  { code: 'gu', bcp47: 'gu-IN', native: 'ગુજરાતી', english: 'Gujarati' },
  { code: 'bn', bcp47: 'bn-IN', native: 'বাংলা', english: 'Bengali' },
  { code: 'ta', bcp47: 'ta-IN', native: 'தமிழ்', english: 'Tamil' },
  { code: 'te', bcp47: 'te-IN', native: 'తెలుగు', english: 'Telugu' },
  { code: 'kn', bcp47: 'kn-IN', native: 'ಕನ್ನಡ', english: 'Kannada' },
  { code: 'ml', bcp47: 'ml-IN', native: 'മലയാളം', english: 'Malayalam' },
  { code: 'or', bcp47: 'or-IN', native: 'ଓଡ଼ିଆ', english: 'Odia' },
];

export const languageInfo = (code: string) => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[1];

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    mr: { translation: mr },
    pa: { translation: pa },
    gu: { translation: gu },
    bn: { translation: bn },
    ta: { translation: ta },
    te: { translation: te },
    kn: { translation: kn },
    ml: { translation: ml },
    or: { translation: or },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;

/** Indian digit grouping: 1,23,456 */
export function formatINR(value: number): string {
  const sign = value < 0 ? '-' : '';
  const s = Math.round(Math.abs(value)).toString();
  if (s.length <= 3) return `${sign}₹${s}`;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${sign}₹${rest},${last3}`;
}

export function formatDate(iso: string, lang: string): string {
  try {
    return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(languageInfo(lang).bcp47, { day: 'numeric', month: 'short' });
  } catch {
    return iso.slice(0, 10);
  }
}
