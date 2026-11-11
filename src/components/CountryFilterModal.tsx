import React, { useState, useEffect, useMemo } from 'react';
import {
  Cancel01Icon,
  Search01Icon,
  Tick02Icon,
  Globe02Icon,
  SparklesIcon,
} from 'hugeicons-react';
import { COUNTRIES, CountryOption, SUPPORTED_LANGUAGES, LanguageOption } from '../data/constants';

export interface CountryFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Country state
  selectedCountry: string; // primary / legacy single country
  selectedCountries: string[]; // multiple selected countries
  onApplyCountries: (countries: string[]) => void;
  // Language state
  selectedLanguage: string; // primary / legacy single language
  selectedLanguages: string[]; // multiple selected languages
  onApplyLanguages: (languages: string[]) => void;
  // Multiple selection toggle state
  isMultipleEnabled: boolean;
  onToggleMultiple: (enabled: boolean) => void;
  // Reset handler
  onReset: () => void;
}

export const CountryFilterModal: React.FC<CountryFilterModalProps> = ({
  isOpen,
  onClose,
  selectedCountry,
  selectedCountries,
  onApplyCountries,
  selectedLanguage,
  selectedLanguages,
  onApplyLanguages,
  isMultipleEnabled,
  onToggleMultiple,
  onReset,
}) => {
  const [activeTab, setActiveTab] = useState<'country' | 'language'>('country');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettingsInfo, setShowSettingsInfo] = useState(false);

  // Local draft states so user can pick and preview before applying
  const [draftCountries, setDraftCountries] = useState<string[]>(
    selectedCountries.length > 0 ? selectedCountries : [selectedCountry || 'GLOBAL']
  );
  const [draftLanguages, setDraftLanguages] = useState<string[]>(
    selectedLanguages.length > 0 ? selectedLanguages : [selectedLanguage || 'en']
  );
  const [draftMultiple, setDraftMultiple] = useState<boolean>(isMultipleEnabled);

  // Sync draft states when modal opens
  useEffect(() => {
    if (isOpen) {
      setDraftCountries(
        selectedCountries.length > 0 ? selectedCountries : [selectedCountry || 'GLOBAL']
      );
      setDraftLanguages(
        selectedLanguages.length > 0 ? selectedLanguages : [selectedLanguage || 'en']
      );
      setDraftMultiple(isMultipleEnabled);
      setSearchQuery('');
      setShowSettingsInfo(false);
    }
  }, [isOpen, selectedCountry, selectedCountries, selectedLanguage, selectedLanguages, isMultipleEnabled]);

  // Lock background scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered lists based on search query
  const filteredCountries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredLanguages = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return SUPPORTED_LANGUAGES;
    return SUPPORTED_LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.native.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  // Selection handlers
  const handleSelectCountry = (code: string) => {
    if (code === 'GLOBAL') {
      // Global clears any specific multi-selection
      setDraftCountries(['GLOBAL']);
      return;
    }

    if (draftMultiple) {
      // Multiple selection mode
      if (draftCountries.includes(code)) {
        const remaining = draftCountries.filter((c) => c !== code);
        setDraftCountries(remaining.length > 0 ? remaining : ['GLOBAL']);
      } else {
        const cleaned = draftCountries.filter((c) => c !== 'GLOBAL');
        setDraftCountries([...cleaned, code]);
      }
    } else {
      // Single selection mode
      setDraftCountries([code]);
    }
  };

  const handleSelectLanguage = (code: string) => {
    if (draftMultiple) {
      if (draftLanguages.includes(code)) {
        const remaining = draftLanguages.filter((l) => l !== code);
        setDraftLanguages(remaining.length > 0 ? remaining : ['en']);
      } else {
        setDraftLanguages([...draftLanguages, code]);
      }
    } else {
      setDraftLanguages([code]);
    }
  };

  const handleToggleMultipleMode = () => {
    const nextVal = !draftMultiple;
    setDraftMultiple(nextVal);
    onToggleMultiple(nextVal);

    // If turned off, keep only the first selected item
    if (!nextVal) {
      if (draftCountries.length > 1) {
        setDraftCountries([draftCountries[0]]);
      }
      if (draftLanguages.length > 1) {
        setDraftLanguages([draftLanguages[0]]);
      }
    }
  };

  const handleClearAll = () => {
    if (activeTab === 'country') {
      setDraftCountries(['GLOBAL']);
    } else {
      setDraftLanguages(['en']);
    }
  };

  const handleApply = () => {
    onApplyCountries(draftCountries);
    onApplyLanguages(draftLanguages);
    onToggleMultiple(draftMultiple);
    onClose();
  };

  const handleResetAll = () => {
    setDraftCountries(['GLOBAL']);
    setDraftLanguages(['en']);
    setDraftMultiple(false);
    onReset();
  };

  const countrySelectionCount = draftCountries.filter((c) => c !== 'GLOBAL').length;
  const languageSelectionCount = draftLanguages.filter((l) => l !== 'en').length;
  const hasActiveSelection =
    activeTab === 'country'
      ? !draftCountries.includes('GLOBAL')
      : draftLanguages.length > 1 || draftLanguages[0] !== 'en';

  const selectionLabel =
    activeTab === 'country'
      ? draftCountries.includes('GLOBAL')
        ? 'Global (Worldwide)'
        : draftCountries.length === 1
          ? COUNTRIES.find((c) => c.code === draftCountries[0])?.name || draftCountries[0]
          : `${draftCountries.length} countries selected`
      : draftLanguages.length === 1
        ? SUPPORTED_LANGUAGES.find((l) => l.code === draftLanguages[0])?.name || draftLanguages[0]
        : `${draftLanguages.length} languages selected`;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xl animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="country-filter-title"
    >
      <div className="animate-in relative w-full max-w-xl max-h-[92dvh] flex flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px] border border-white/10 bg-[#0b0914]/95 backdrop-blur-2xl text-white shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)]">
        {/* Brand hairline glow across the top edge */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/70 to-transparent"
        />

        {/* A. Modal Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-cyan-400/15 border border-violet-400/30 text-violet-200 shadow-[0_0_24px_-10px_rgba(139,92,246,0.9)]">
              {activeTab === 'country' ? (
                <Globe02Icon className="h-5 w-5" />
              ) : (
                <SparklesIcon className="h-5 w-5" />
              )}
            </span>

            <div className="min-w-0">
              <h2
                id="country-filter-title"
                className="font-display text-lg sm:text-xl font-bold tracking-tight text-white"
              >
                {activeTab === 'country' ? 'Country filter' : 'Language filter'}
              </h2>
              <p className="mt-1 text-[11px] text-white/45">
                Choose who you get matched with across the network.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleResetAll}
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-white/50 transition-colors hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
              title="Reset all country and language filters to default"
            >
              Reset
            </button>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
              aria-label="Close modal"
            >
              <Cancel01Icon className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* B. Segmented Tabs */}
        <div className="px-5 pb-4">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            <button
              onClick={() => setActiveTab('country')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-all ${
                activeTab === 'country'
                  ? 'bg-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_18px_-10px_rgba(0,0,0,0.9)]'
                  : 'text-white/45 hover:text-white/80'
              }`}
            >
              <Globe02Icon className="h-4 w-4" />
              Country
              {countrySelectionCount > 0 && (
                <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-violet-500 px-1 text-[9px] font-extrabold text-white">
                  {countrySelectionCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('language')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-all ${
                activeTab === 'language'
                  ? 'bg-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_18px_-10px_rgba(0,0,0,0.9)]'
                  : 'text-white/45 hover:text-white/80'
              }`}
            >
              Language
              <span className="rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-1.5 py-px text-[8px] font-extrabold uppercase tracking-wider text-white">
                New
              </span>
              {languageSelectionCount > 0 && (
                <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-violet-500 px-1 text-[9px] font-extrabold text-white">
                  {languageSelectionCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowSettingsInfo(!showSettingsInfo)}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors ${
                showSettingsInfo
                  ? 'bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/40'
                  : 'text-white/40 hover:bg-white/[0.07] hover:text-white/80'
              }`}
              title="How filtering affects matchmaking"
              aria-label="Filter settings"
              aria-expanded={showSettingsInfo}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Optional Filter Preferences Info Sheet */}
        {showSettingsInfo && (
          <div className="mx-5 mb-3 animate-in rounded-2xl border border-violet-400/20 bg-violet-500/[0.07] px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-violet-300">
              <SparklesIcon className="h-3.5 w-3.5" />
              Reciprocal matching
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/55">
              With filters enabled, U-R-LIVE only connects you to partners matching your selected
              countries or languages. If nobody compatible is online, you stay in queue until a match joins.
            </p>
          </div>
        )}

        {/* D. Search & multi-select controls */}
        <div className="space-y-3 px-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search01Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="text"
                placeholder={activeTab === 'country' ? 'Search country or code…' : 'Search language…'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-9 text-xs text-white placeholder:text-white/30 transition-colors focus:border-violet-400/60 focus:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
                  aria-label="Clear search"
                >
                  <Cancel01Icon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleToggleMultipleMode}
              role="switch"
              aria-checked={draftMultiple}
              className={`flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 ${
                draftMultiple
                  ? 'border-violet-400/40 bg-violet-500/15 text-violet-100'
                  : 'border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.07]'
              }`}
              title="Toggle multiple selection"
            >
              <span className="text-[11px] font-semibold whitespace-nowrap">
                <span className="hidden sm:inline">Select </span>Multiple
              </span>
              <span
                className={`relative h-4.5 w-8 rounded-full p-0.5 transition-colors ${
                  draftMultiple ? 'bg-violet-500' : 'bg-white/15'
                }`}
              >
                <span
                  className={`block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    draftMultiple ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>
          </div>

          {/* Active selection summary */}
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-white/35">Selected</span>
              <span className="h-1 w-1 rounded-full bg-white/20" />
              <span className="truncate font-semibold text-violet-200">{selectionLabel}</span>
            </div>

            {hasActiveSelection && (
              <button
                onClick={handleClearAll}
                className="shrink-0 rounded-full px-2 py-0.5 font-semibold text-violet-300 transition-colors hover:bg-violet-500/15 hover:text-violet-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* C & E. Scrollable selection grid */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-1">
          {activeTab === 'country' ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filteredCountries.map((country: CountryOption) => {
                const isSelected = draftCountries.includes(country.code);

                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleSelectCountry(country.code)}
                    aria-pressed={isSelected}
                    className={`group flex w-full items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 ${
                      isSelected
                        ? 'border-violet-400/50 bg-violet-500/[0.14] text-white shadow-[0_0_26px_-12px_rgba(139,92,246,0.95)] ring-1 ring-violet-400/25'
                        : 'border-white/[0.07] bg-white/[0.03] text-white/70 hover:border-white/15 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="shrink-0 select-none text-xl">{country.flag}</span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold leading-tight sm:text-[13px]">
                          {country.name}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.10em] text-white/35">
                          {country.code === 'GLOBAL' ? 'Worldwide' : country.code}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-[0_0_12px_-2px_rgba(139,92,246,0.9)]">
                          <Tick02Icon className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="block h-4.5 w-4.5 rounded-full border border-white/20 transition-colors group-hover:border-white/40" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filteredLanguages.map((lang: LanguageOption) => {
                const isSelected = draftLanguages.includes(lang.code);

                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelectLanguage(lang.code)}
                    aria-pressed={isSelected}
                    className={`group flex w-full items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 ${
                      isSelected
                        ? 'border-violet-400/50 bg-violet-500/[0.14] text-white shadow-[0_0_26px_-12px_rgba(139,92,246,0.95)] ring-1 ring-violet-400/25'
                        : 'border-white/[0.07] bg-white/[0.03] text-white/70 hover:border-white/15 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-[10px] font-extrabold uppercase tracking-wide text-violet-200">
                        {lang.code}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold leading-tight sm:text-[13px]">
                          {lang.name}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-white/35">{lang.native}</p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-[0_0_12px_-2px_rgba(139,92,246,0.9)]">
                          <Tick02Icon className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="block h-4.5 w-4.5 rounded-full border border-white/20 transition-colors group-hover:border-white/40" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {((activeTab === 'country' && filteredCountries.length === 0) ||
            (activeTab === 'language' && filteredLanguages.length === 0)) && (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              <Search01Icon className="h-5 w-5 text-white/25" />
              <p className="text-xs text-white/45">No matches for “{searchQuery.trim()}”</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-1 flex items-center justify-between gap-3 border-t border-white/[0.07] bg-[#08060f]/80 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl">
          <div className="hidden text-[11px] sm:block">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              Filters apply to your next match
            </span>
          </div>

          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2.5 text-xs font-semibold text-white/50 transition-colors hover:bg-white/[0.07] hover:text-white sm:py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="btn-primary flex h-10 flex-1 items-center justify-center px-6 text-xs sm:h-9 sm:flex-initial sm:text-[11px]"
            >
              Apply filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
