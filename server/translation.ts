/**
 * Server-side Translation Service Abstraction
 * Handles translation requests with in-memory caching and rate limiting
 */
import { ALLOWED_LANGUAGES, LanguageCode } from './interests_languages';

interface CacheEntry {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}

const translationCache = new Map<string, CacheEntry>();
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const MAX_PER_MINUTE = 30;

// Simple dictionary for high-frequency common greetings and chat phrases across supported languages
const PHRASE_DICTIONARY: Record<string, Partial<Record<LanguageCode, string>>> = {
  'hello': {
    en: 'Hello',
    ta: 'வணக்கம் (Vanakkam)',
    hi: 'नमस्ते (Namaste)',
    ml: 'നമസ്കാരം (Namaskaram)',
    te: 'నమస్కారం (Namaskaram)',
    kn: 'ನಮಸ್ಕಾರ (Namaskara)',
    es: 'Hola',
    fr: 'Bonjour',
    de: 'Hallo',
    ja: 'こんにちは (Konnichiwa)',
    ko: '안녕하세요 (Annyeonghaseyo)',
    ar: 'مرحبا (Marhaban)',
  },
  'hi': {
    en: 'Hi',
    ta: 'வணக்கம் (Vanakkam)',
    hi: 'नमस्ते (Namaste)',
    es: 'Hola',
    fr: 'Salut',
    de: 'Hi',
  },
  'how are you': {
    en: 'How are you?',
    ta: 'எப்படி இருக்கிறீர்கள்? (Eppadi irukkireergal?)',
    hi: 'आप कैसे हैं? (Aap kaise hain?)',
    ml: 'സുഖമാണോ? (Sukhamano?)',
    te: 'మీరు ఎలా ఉన్నారు? (Meeru ela unnaru?)',
    es: '¿Cómo estás?',
    fr: 'Comment vas-tu?',
    de: 'Wie geht es dir?',
    ja: 'お元気ですか？ (Ogenki desu ka?)',
  },
  'where are you from': {
    en: 'Where are you from?',
    ta: 'நீங்கள் எந்த ஊர்? (Neengal entha ooru?)',
    hi: 'आप कहाँ से हैं? (Aap kahan se hain?)',
    es: '¿De dónde eres?',
    fr: "D'où viens-tu?",
    de: 'Woher kommst du?',
  },
  'nice to meet you': {
    en: 'Nice to meet you!',
    ta: 'உங்களை சந்தித்ததில் மகிழ்ச்சி! (Ungalai santhithathil magizhchi!)',
    hi: 'आपसे मिलकर अच्छा लगा! (Aapse milkar achha laga!)',
    es: '¡Mucho gusto!',
    fr: 'Ravi de vous rencontrer!',
    de: 'Schön, dich kennenzulernen!',
  },
};

export class TranslationService {
  /**
   * Translate text into target language
   */
  public async translateText(
    userId: string,
    text: string,
    targetLang: string
  ): Promise<{
    translatedText: string;
    sourceLang: string;
    targetLang: string;
    cached: boolean;
    provider: 'cache' | 'dictionary' | 'external' | 'fallback';
  }> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Message text cannot be empty');
    }
    if (trimmed.length > 500) {
      throw new Error('Message text exceeds maximum length of 500 characters');
    }

    // Validate target language
    const validTarget = ALLOWED_LANGUAGES.includes(targetLang as LanguageCode)
      ? (targetLang as LanguageCode)
      : 'en';

    // Rate limiting check
    const now = Date.now();
    const rate = rateLimitMap.get(userId) || { count: 0, windowStart: now };
    if (now - rate.windowStart > 60000) {
      rate.count = 1;
      rate.windowStart = now;
    } else {
      rate.count += 1;
      if (rate.count > MAX_PER_MINUTE) {
        throw new Error('Translation rate limit exceeded. Please wait a minute.');
      }
    }
    rateLimitMap.set(userId, rate);

    // Cache check
    const cacheKey = `${trimmed.toLowerCase()}_to_${validTarget}`;
    const cached = translationCache.get(cacheKey);
    if (cached && now - cached.timestamp < 24 * 60 * 60 * 1000) {
      return {
        translatedText: cached.translatedText,
        sourceLang: cached.sourceLang,
        targetLang: cached.targetLang,
        cached: true,
        provider: 'cache',
      };
    }

    // Check phrase dictionary
    const lowerKey = trimmed.toLowerCase().replace(/[?!.,]/g, '').trim();
    if (PHRASE_DICTIONARY[lowerKey] && PHRASE_DICTIONARY[lowerKey][validTarget]) {
      const translated = PHRASE_DICTIONARY[lowerKey][validTarget]!;
      translationCache.set(cacheKey, {
        translatedText: translated,
        sourceLang: 'auto',
        targetLang: validTarget,
        timestamp: now,
      });
      return {
        translatedText: translated,
        sourceLang: 'auto',
        targetLang: validTarget,
        cached: false,
        provider: 'dictionary',
      };
    }

    // Optional external translation provider if configured
    const apiKey = process.env.TRANSLATION_API_KEY;
    if (apiKey) {
      try {
        const response = await fetch(
          `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              q: trimmed,
              target: validTarget,
              format: 'text',
            }),
          }
        );
        if (response.ok) {
          const data = (await response.json()) as any;
          const translated = data?.data?.translations?.[0]?.translatedText;
          const detected = data?.data?.translations?.[0]?.detectedSourceLanguage || 'auto';
          if (translated) {
            translationCache.set(cacheKey, {
              translatedText: translated,
              sourceLang: detected,
              targetLang: validTarget,
              timestamp: now,
            });
            return {
              translatedText: translated,
              sourceLang: detected,
              targetLang: validTarget,
              cached: false,
              provider: 'external',
            };
          }
        }
      } catch (err) {
        console.warn('External translation API error, applying fallback:', err);
      }
    }

    // Graceful fallback: return original text with language annotation so chat never breaks
    const fallbackTranslation = `[${validTarget.toUpperCase()} translation]: ${trimmed}`;
    return {
      translatedText: fallbackTranslation,
      sourceLang: 'auto',
      targetLang: validTarget,
      cached: false,
      provider: 'fallback',
    };
  }
}

export const translationService = new TranslationService();
