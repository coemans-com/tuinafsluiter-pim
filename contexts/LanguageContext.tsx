
import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language, TranslationKey } from '../services/translations';
import { api } from '../services/api';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Try LocalStorage first (immediate load)
  const savedLang = localStorage.getItem('app_language') as Language;
  // Default to saved or 'en'. 
  const [language, setLanguageState] = useState<Language>(savedLang || 'en');

  // 2. Try DB Settings on mount, but be careful not to override if local exists and differs from default
  useEffect(() => {
    const syncLang = async () => {
        try {
            const settings = await api.getAppSettings();
            // Only update if settings.language is explicitly set in DB (not null) AND different
            // AND we don't already have a valid one in localStorage that might be newer (this part is tricky, 
            // usually we trust DB on login, but user might have just changed it in current session).
            // Simplified: If DB has a value, use it, assuming DB is single source of truth for "saved" state.
            if (settings.language && settings.language !== language) {
                setLanguageState(settings.language);
                localStorage.setItem('app_language', settings.language);
            }
        } catch (e) {
            console.warn("Could not fetch language settings", e);
        }
    };
    
    // Only fetch if we are logged in
    if (api.getCurrentSession()) {
        syncLang();
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
