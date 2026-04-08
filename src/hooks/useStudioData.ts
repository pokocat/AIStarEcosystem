import { APP_TRANSLATIONS, CHART_DATA, EARNING_DATA, LYRICS, MOCK_SINGERS, TRANSACTIONS } from '../data/studioData';
import type { Lang } from '../types/app';

export function useStudioData(lang: Lang) {
  return {
    lang,
    translations: APP_TRANSLATIONS,
    copy: APP_TRANSLATIONS[lang],
    mockSingers: MOCK_SINGERS,
    chartData: CHART_DATA,
    earningData: EARNING_DATA,
    transactions: TRANSACTIONS,
    lyrics: LYRICS,
  };
}
