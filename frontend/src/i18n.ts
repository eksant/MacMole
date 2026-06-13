import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from './locales/en/common.json'
import idCommon from './locales/id/common.json'
import enCleanup from './locales/en/cleanup.json'
import idCleanup from './locales/id/cleanup.json'
import enDashboard from './locales/en/dashboard.json'
import idDashboard from './locales/id/dashboard.json'
import enCleaner from './locales/en/cleaner.json'
import idCleaner from './locales/id/cleaner.json'
import enOptimizer from './locales/en/optimizer.json'
import idOptimizer from './locales/id/optimizer.json'
import enAnalyzer from './locales/en/analyzer.json'
import idAnalyzer from './locales/id/analyzer.json'
import enProcesses from './locales/en/processes.json'
import idProcesses from './locales/id/processes.json'
import enDevCaches from './locales/en/devcaches.json'
import idDevCaches from './locales/id/devcaches.json'
import enNodeModules from './locales/en/nodemodules.json'
import idNodeModules from './locales/id/nodemodules.json'
import enInstaller from './locales/en/installer.json'
import idInstaller from './locales/id/installer.json'
import enUninstall from './locales/en/uninstall.json'
import idUninstall from './locales/id/uninstall.json'
import enLogs from './locales/en/logs.json'
import idLogs from './locales/id/logs.json'
import enPurge from './locales/en/purge.json'
import idPurge from './locales/id/purge.json'
import enHistory from './locales/en/history.json'
import idHistory from './locales/id/history.json'
import enSettings from './locales/en/settings.json'
import idSettings from './locales/id/settings.json'

const savedLang = localStorage.getItem('macmole_lang') ?? 'en'

void i18n.use(initReactI18next).init({
  lng: savedLang,
  fallbackLng: 'en',
  resources: {
    en: {
      common: enCommon,
      cleanup: enCleanup,
      dashboard: enDashboard,
      cleaner: enCleaner,
      optimizer: enOptimizer,
      analyzer: enAnalyzer,
      processes: enProcesses,
      devcaches: enDevCaches,
      nodemodules: enNodeModules,
      installer: enInstaller,
      uninstall: enUninstall,
      logs: enLogs,
      purge: enPurge,
      history: enHistory,
      settings: enSettings,
    },
    id: {
      common: idCommon,
      cleanup: idCleanup,
      dashboard: idDashboard,
      cleaner: idCleaner,
      optimizer: idOptimizer,
      analyzer: idAnalyzer,
      processes: idProcesses,
      devcaches: idDevCaches,
      nodemodules: idNodeModules,
      installer: idInstaller,
      uninstall: idUninstall,
      logs: idLogs,
      purge: idPurge,
      history: idHistory,
      settings: idSettings,
    },
  },
  interpolation: { escapeValue: false },
})

export default i18n
