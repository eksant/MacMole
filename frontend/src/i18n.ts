import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from './locales/en/common.json'
import idCommon from './locales/id/common.json'

const savedLang = localStorage.getItem('macmole_lang') ?? 'en'

void i18n.use(initReactI18next).init({
  lng: savedLang,
  fallbackLng: 'en',
  resources: {
    en: { common: enCommon },
    id: { common: idCommon },
  },
  interpolation: { escapeValue: false },
})

export default i18n
