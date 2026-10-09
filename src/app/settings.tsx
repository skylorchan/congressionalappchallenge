import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type TextSize = 'normal' | 'large' | 'xlarge';
export type Settings = {
  textSize: TextSize;
  highContrast: boolean;
  /** Kūpuna (elder) mode: one screen of giant buttons instead of the full app. */
  kupuna: boolean;
};

const DEFAULTS: Settings = { textSize: 'normal', highContrast: false, kupuna: false };
const STORAGE_KEY = 'kokua.settings';

function read(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

type Ctx = { settings: Settings; change: (c: Partial<Settings>) => void };
const SettingsContext = createContext<Ctx | null>(null);

/**
 * Display settings, saved on the device. They are applied as attributes on <html>, and
 * the stylesheet does the rest: every size is in rem, so text size is one font-size.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(read);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.textSize = settings.textSize;
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
    root.dataset.kupuna = String(settings.kupuna);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* not remembered; still applied for this session */
    }
  }, [settings]);

  const change = useCallback((c: Partial<Settings>) => setSettings((s) => ({ ...s, ...c })), []);
  const value = useMemo(() => ({ settings, change }), [settings, change]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
