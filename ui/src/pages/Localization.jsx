import { useEffect, useMemo, useState } from 'react';
import KxCombobox from '../components/KxCombobox.jsx';
import {
  allCountryCodes,
  countryPresets,
  fallbackKeymaps,
  fallbackLocales,
  getRegionName,
  parseLocaleLabel,
} from '../data/localizationMeta.js';
import { installerApi } from '../utils/installerApi.js';
import {
  fetchCanonicalCatalog,
  normalizeCountryCanonicalKey,
  normalizeCountryDisplayValue,
  normalizeKeymapCanonicalKey,
  normalizeKeymapDisplayValue,
  normalizeLocaleCanonicalKey,
  normalizeLocaleDisplayValue,
} from '../utils/localizationCatalog.js';

export default function Localization({ wizard, onChange }) {
  const [countries, setCountries] = useState([]);
  const [locales, setLocales] = useState([]);
  const [keymaps, setKeymaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [degradedMode, setDegradedMode] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        setLoading(true);
        const [countriesData, localesData, keymapsData] = await Promise.all([
          fetchCanonicalCatalog(installerApi.getCountries, allCountryCodes, {
            normalizeDisplayValue: normalizeCountryDisplayValue,
            toCanonicalKey: normalizeCountryCanonicalKey,
          }),
          fetchCanonicalCatalog(installerApi.getLocales, fallbackLocales, {
            normalizeDisplayValue: normalizeLocaleDisplayValue,
            toCanonicalKey: normalizeLocaleCanonicalKey,
          }),
          fetchCanonicalCatalog(installerApi.getKeymaps, fallbackKeymaps, {
            normalizeDisplayValue: normalizeKeymapDisplayValue,
            toCanonicalKey: normalizeKeymapCanonicalKey,
          }),
        ]);

        if (!cancelled) {
          setCountries(countriesData.items);
          setLocales(localesData.items);
          setKeymaps(keymapsData.items);
          setDegradedMode(Boolean(countriesData.usedFallback || localesData.usedFallback || keymapsData.usedFallback));
        }
      } catch {
        // error handling handled implicitly by fallbacks in fetchCanonicalCatalog
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPreset = countryPresets[wizard.country] || null;
  const availableCountries = useMemo(() => countries.filter(Boolean).sort((a, b) => a.localeCompare(b)), [countries]);

  const countryOptions = useMemo(() => {
    return availableCountries.map(code => ({
      id: code,
      label: getRegionName(code),
      desc: code
    }));
  }, [availableCountries]);

  const localeOptions = useMemo(() => {
    return locales.map(locale => ({
      id: locale,
      label: parseLocaleLabel(locale),
      desc: locale
    }));
  }, [locales]);

  const keymapOptions = useMemo(() => {
    return keymaps.map(keymap => ({
      id: keymap,
      label: keymap,
      desc: ''
    }));
  }, [keymaps]);

  function applyCountry(value) {
    onChange((previous) => ({
      country: value,
    }));
  }

  function applySuggestions() {
    if (selectedPreset) {
      onChange((previous) => ({
        locale: selectedPreset.locale || previous.locale,
        keyMap: selectedPreset.keyMap || previous.keyMap,
        timeZone: selectedPreset.timeZone || previous.timeZone,
        timeZonePin: null,
        timeZoneLatitude: null,
        timeZoneLongitude: null,
        timeZoneCountryCode: '',
      }));
    }
  }

  const localeLabel = useMemo(() => parseLocaleLabel(wizard.locale), [wizard.locale]);
  const countryLabel = useMemo(() => getRegionName(wizard.country), [wizard.country]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 lg:flex-row">
      {/* 70% Coluna Principal de Configuração */}
      <div className="flex flex-1 flex-col overflow-y-auto pr-2 custom-scrollbar">


        <div className="flex flex-col gap-5">
          <KxCombobox
            label="1. País / Região"
            options={countryOptions}
            value={wizard.country}
            onChange={applyCountry}
            placeholder={loading ? 'Carregando países...' : 'Selecione um país'}
            disabled={loading}
          />

          <KxCombobox
            label="2. Idioma do sistema"
            options={localeOptions}
            value={wizard.locale}
            onChange={(val) => onChange({ locale: val })}
            placeholder={loading ? 'Carregando idiomas...' : 'Selecione um idioma'}
            disabled={loading}
          />

          <KxCombobox
            label="3. Layout de teclado"
            options={keymapOptions}
            value={wizard.keyMap}
            onChange={(val) => onChange({ keyMap: normalizeKeymapDisplayValue(val) })}
            placeholder={loading ? 'Carregando layouts...' : 'Selecione um teclado'}
            disabled={loading}
          />

          <div className="mt-4 border-t border-slate-200/50 pt-5 dark:border-white/10">
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={applySuggestions}
              disabled={!selectedPreset}
            >
              ✨ Aplicar sugestões do país
            </button>
            {!selectedPreset && wizard.country && (
              <div className="mt-2 text-[11px] text-slate-500">Sem sugestões padrão para o país selecionado.</div>
            )}
          </div>
          
          {degradedMode && (
            <div className="mt-4 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="text-accent-blue font-bold">Nota:</span> Catálogo local ativo. O backend pode complementar idiomas e layouts durante a instalação.
            </div>
          )}
        </div>
      </div>

      {/* 30% Coluna Lateral de Resumo */}
      <div className="w-full shrink-0 lg:w-[280px] lg:border-l lg:border-slate-200/50 lg:pl-6 lg:dark:border-white/10">
        <div className="rounded-xl border border-slate-200/50 bg-slate-50/50 p-5 dark:border-white/5 dark:bg-white/[0.02]">
          <h3 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Resumo regional
          </h3>
          
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold">País</div>
              <div className="text-[13px] font-bold text-slate-900 dark:text-white mt-0.5">{countryLabel || '—'}</div>
            </div>
            
            <div>
              <div className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold">Idioma</div>
              <div className="text-[13px] font-bold text-slate-900 dark:text-white mt-0.5">{localeLabel || '—'}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{wizard.locale || ''}</div>
            </div>
            
            <div>
              <div className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold">Teclado</div>
              <div className="text-[13px] font-bold text-slate-900 dark:text-white mt-0.5">{wizard.keyMap || '—'}</div>
            </div>
            
            <div className="border-t border-slate-200/50 pt-3 dark:border-white/10">
              <div className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold">Timezone sugerido</div>
              <div className="text-[13px] font-bold text-slate-900 dark:text-white mt-0.5">{selectedPreset?.timeZone || wizard.timeZone || '—'}</div>
            </div>
            
            <div className="border-t border-slate-200/50 pt-3 dark:border-white/10">
              <div className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold">Fonte de dados</div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                {degradedMode ? 'Catálogo local' : 'Backend online'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
