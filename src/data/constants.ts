export interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: 'GLOBAL', name: 'Global (Worldwide)', flag: '🌐' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
];

export interface InterestOption {
  id: string;
  label: string;
  emoji: string;
}

export const POPULAR_INTERESTS: InterestOption[] = [
  { id: 'general_conversation', label: 'Chat & Friends', emoji: '💬' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'movies', label: 'Movies & Series', emoji: '🎬' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'anime', label: 'Anime & Manga', emoji: '✨' },
  { id: 'technology', label: 'Technology & AI', emoji: '💻' },
  { id: 'travel', label: 'Travel & Culture', emoji: '✈️' },
  { id: 'food', label: 'Food & Cooking', emoji: '🍕' },
  { id: 'fitness', label: 'Fitness & Sports', emoji: '💪' },
  { id: 'comedy', label: 'Humour & Memes', emoji: '😂' },
  { id: 'photography', label: 'Photography', emoji: '📷' },
  { id: 'art', label: 'Art & Design', emoji: '🎨' },
  { id: 'books', label: 'Books & Literature', emoji: '📚' },
  { id: 'startups', label: 'Startups & Business', emoji: '🚀' },
  { id: 'science', label: 'Science & Space', emoji: '🔬' },
  { id: 'education', label: 'Language Learning', emoji: '🌍' },
];

export interface LanguageOption {
  code: string;
  name: string;
  native: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
];
