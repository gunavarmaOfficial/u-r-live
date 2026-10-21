/**
 * Master data for Interests, Languages, Conversation Starters, and Mini-Games
 */

export const ALLOWED_INTERESTS = [
  'music',
  'movies',
  'tamil_cinema',
  'gaming',
  'anime',
  'technology',
  'startups',
  'business',
  'travel',
  'food',
  'fitness',
  'sports',
  'science',
  'education',
  'photography',
  'art',
  'books',
  'comedy',
  'general_conversation',
  'making_new_friends',
] as const;

export type InterestId = (typeof ALLOWED_INTERESTS)[number];

export const INTEREST_LABELS: Record<InterestId, string> = {
  music: 'Music',
  movies: 'Movies',
  tamil_cinema: 'Tamil cinema',
  gaming: 'Gaming',
  anime: 'Anime',
  technology: 'Technology',
  startups: 'Startups',
  business: 'Business',
  travel: 'Travel',
  food: 'Food',
  fitness: 'Fitness',
  sports: 'Sports',
  science: 'Science',
  education: 'Education',
  photography: 'Photography',
  art: 'Art',
  books: 'Books',
  comedy: 'Comedy',
  general_conversation: 'General conversation',
  making_new_friends: 'Making new friends',
};

export const ALLOWED_LANGUAGES = [
  'en', // English
  'ta', // Tamil
  'hi', // Hindi
  'ml', // Malayalam
  'te', // Telugu
  'kn', // Kannada
  'bn', // Bengali
  'mr', // Marathi
  'gu', // Gujarati
  'pa', // Punjabi
  'es', // Spanish
  'fr', // French
  'de', // German
  'pt', // Portuguese
  'ar', // Arabic
  'ja', // Japanese
  'ko', // Korean
] as const;

export type LanguageCode = (typeof ALLOWED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<LanguageCode, { name: string; native: string }> = {
  en: { name: 'English', native: 'English' },
  ta: { name: 'Tamil', native: 'தமிழ்' },
  hi: { name: 'Hindi', native: 'हिन्दी' },
  ml: { name: 'Malayalam', native: 'മലയാളം' },
  te: { name: 'Telugu', native: 'తెలుగు' },
  kn: { name: 'Kannada', native: 'ಕನ್ನಡ' },
  bn: { name: 'Bengali', native: 'বাংলা' },
  mr: { name: 'Marathi', native: 'मराठी' },
  gu: { name: 'Gujarati', native: 'ગુજરાતી' },
  pa: { name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  es: { name: 'Spanish', native: 'Español' },
  fr: { name: 'French', native: 'Français' },
  de: { name: 'German', native: 'Deutsch' },
  pt: { name: 'Portuguese', native: 'Português' },
  ar: { name: 'Arabic', native: 'العربية' },
  ja: { name: 'Japanese', native: '日本語' },
  ko: { name: 'Korean', native: '한국어' },
};

export interface ConversationStarter {
  id: string;
  category: 'movies' | 'music' | 'travel' | 'lifestyle' | 'technology' | 'food' | 'random';
  question: string;
}

export const CONVERSATION_STARTERS: ConversationStarter[] = [
  { id: 'cs_1', category: 'movies', question: 'What is your all-time favorite movie?' },
  { id: 'cs_2', category: 'movies', question: 'What is the best movie or series you watched recently?' },
  { id: 'cs_3', category: 'music', question: 'What music do you listen to when you want to relax?' },
  { id: 'cs_4', category: 'travel', question: 'Which place in the world would you love to visit next?' },
  { id: 'cs_5', category: 'food', question: 'What is your ultimate comfort food?' },
  { id: 'cs_6', category: 'lifestyle', question: 'What skill or hobby would you love to master?' },
  { id: 'cs_7', category: 'lifestyle', question: 'Do you prefer the quiet beach or the mountains?' },
  { id: 'cs_8', category: 'technology', question: 'What upcoming technology excites you the most?' },
  { id: 'cs_9', category: 'lifestyle', question: 'What is something interesting or unique about your hometown?' },
  { id: 'cs_10', category: 'lifestyle', question: 'Which new language would you love to learn?' },
  { id: 'cs_11', category: 'random', question: 'What is your favorite childhood memory?' },
  { id: 'cs_12', category: 'music', question: 'Have you ever been to a live music concert or festival?' },
  { id: 'cs_13', category: 'food', question: 'Are you a tea person, a coffee person, or neither?' },
  { id: 'cs_14', category: 'random', question: 'If you had a superpower for one day, what would it be?' },
  { id: 'cs_15', category: 'travel', question: 'What is the best road trip or vacation you have ever taken?' },
  { id: 'cs_16', category: 'technology', question: 'Can you live without your smartphone for an entire weekend?' },
  { id: 'cs_17', category: 'movies', question: 'Who is your favorite actor or movie director?' },
  { id: 'cs_18', category: 'random', question: 'Early bird or night owl?' },
];

export interface MiniGameQuestion {
  id: string;
  type: 'would_you_rather' | 'this_or_that';
  question: string;
  optionA: string;
  optionB: string;
}

export const MINI_GAME_QUESTIONS: MiniGameQuestion[] = [
  {
    id: 'wyr_1',
    type: 'would_you_rather',
    question: 'Would you rather travel to the past or the future?',
    optionA: 'Travel to the past',
    optionB: 'Travel to the future',
  },
  {
    id: 'wyr_2',
    type: 'would_you_rather',
    question: 'Would you rather have the ability to fly or be invisible?',
    optionA: 'Ability to fly',
    optionB: 'Be invisible',
  },
  {
    id: 'wyr_3',
    type: 'would_you_rather',
    question: 'Would you rather live without music or live without movies?',
    optionA: 'Live without music',
    optionB: 'Live without movies',
  },
  {
    id: 'wyr_4',
    type: 'would_you_rather',
    question: 'Would you rather explore deep space or the deep ocean?',
    optionA: 'Deep space',
    optionB: 'Deep ocean',
  },
  {
    id: 'wyr_5',
    type: 'would_you_rather',
    question: 'Would you rather always speak your mind or never speak again?',
    optionA: 'Always speak your mind',
    optionB: 'Never speak again',
  },
  {
    id: 'tot_1',
    type: 'this_or_that',
    question: 'Coffee or Tea?',
    optionA: 'Hot Coffee',
    optionB: 'Spiced Tea',
  },
  {
    id: 'tot_2',
    type: 'this_or_that',
    question: 'Beach Vacation or Mountain Retreat?',
    optionA: 'Sunny Beach',
    optionB: 'Misty Mountains',
  },
  {
    id: 'tot_3',
    type: 'this_or_that',
    question: 'City Life or Countryside Quiet?',
    optionA: 'Vibrant City',
    optionB: 'Peaceful Countryside',
  },
  {
    id: 'tot_4',
    type: 'this_or_that',
    question: 'Books or Podcasts?',
    optionA: 'Physical Books',
    optionB: 'Audio Podcasts',
  },
];
