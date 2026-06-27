import { useEffect, useMemo, useState } from 'react';
import FieldError from '../components/FieldError.jsx';
import TimezoneMap from '../components/TimezoneMap.jsx';
import KxCombobox from '../components/KxCombobox.jsx';
import { timezoneRegions } from '../data/timezoneRegions.js';
import { installerApi } from '../utils/installerApi.js';
import {
  decorateTimezoneLocation,
  isMappableTimezone,
  normalizeTimezoneLabel,
  timezoneRegionKey,
} from '../utils/nearestTimezone.js';

function resolveSelectionPatch(location) {
  if (!location) {
    return {
      timeZone: '',
      timeZonePin: null,
      timeZoneLatitude: null,
      timeZoneLongitude: null,
      timeZoneCountryCode: '',
    };
  }

  return {
    timeZone: location.timezone,
    timeZonePin: {
      label: location.label,
      latitude: location.latitude,
      longitude: location.longitude,
      countryCode: location.countryCode || '',
    },
    timeZoneLatitude: location.latitude,
    timeZoneLongitude: location.longitude,
    timeZoneCountryCode: location.countryCode || '',
  };
}

function mergeTimezoneLocations(timezones, locations) {
  const map = new Map();

  for (const raw of timezoneRegions) {
    const item = decorateTimezoneLocation(raw);
    map.set(item.timezone, item);
  }

  for (const raw of locations) {
    const item = decorateTimezoneLocation(raw);
    if (!item.timezone) continue;
    map.set(item.timezone, {
      ...map.get(item.timezone),
      ...item,
      label: item.label || map.get(item.timezone)?.label || normalizeTimezoneLabel(item.timezone),
      group: item.group || map.get(item.timezone)?.group || timezoneRegionKey(item.timezone),
    });
  }

  for (const timezone of timezones) {
    if (!map.has(timezone)) {
      map.set(timezone, decorateTimezoneLocation({ timezone }));
    }
  }

  return Array.from(map.values()).sort((a, b) => a.timezone.localeCompare(b.timezone));
}

export default function Timezone({ wizard, onChange, validation }) {
  const [timezones, setTimezones] = useState([]);
  const [timezoneLocations, setTimezoneLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fieldErrors = validation?.fieldErrors || {};

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let nextError = '';

      try {
        setLoading(true);
        setError('');

        const [listResult, locationsResult] = await Promise.allSettled([
          installerApi.getTimezones(),
          installerApi.getTimezoneLocations(),
        ]);

        if (cancelled) {
          return;
        }

        const items = listResult.status === 'fulfilled' && Array.isArray(listResult.value?.items)
          ? listResult.value.items
          : [];
        const locations = locationsResult.status === 'fulfilled' && Array.isArray(locationsResult.value?.items)
          ? locationsResult.value.items
          : [];

        setTimezones(items.length > 0 ? items : timezoneRegions.map((item) => item.timezone));
        setTimezoneLocations(locations.length > 0 ? locations : timezoneRegions);

        if (listResult.status !== 'fulfilled' && locationsResult.status !== 'fulfilled') {
          nextError = 'Backend indisponível para timezones. Usando catálogo interno.';
        }
      } finally {
        if (!cancelled) {
          setError(nextError);
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const mergedLocations = useMemo(
    () => mergeTimezoneLocations(timezones, timezoneLocations),
    [timezones, timezoneLocations],
  );

  const mappableLocations = useMemo(
    () => mergedLocations.filter(isMappableTimezone),
    [mergedLocations],
  );

  const selectedLocation = useMemo(
    () => mergedLocations.find((item) => item.timezone === wizard.timeZone) || null,
    [mergedLocations, wizard.timeZone],
  );

  useEffect(() => {
    if (!wizard.timeZone || !selectedLocation) return;

    if (
      wizard.timeZoneLatitude !== selectedLocation.latitude
      || wizard.timeZoneLongitude !== selectedLocation.longitude
      || wizard.timeZoneCountryCode !== (selectedLocation.countryCode || '')
      || wizard.timeZonePin?.label !== selectedLocation.label
    ) {
      onChange(resolveSelectionPatch(selectedLocation));
    }
  }, [
    onChange,
    selectedLocation,
    wizard.timeZone,
    wizard.timeZoneCountryCode,
    wizard.timeZoneLatitude,
    wizard.timeZoneLongitude,
    wizard.timeZonePin?.label,
  ]);

  function applyLocation(location) {
    onChange(resolveSelectionPatch(location));
  }

  // Prepara as opções para o KxCombobox
  const timezoneOptions = useMemo(() => {
    return mergedLocations.map(loc => ({
      id: loc.timezone,
      label: loc.timezone,
      desc: `${loc.label} • ${loc.group}`
    }));
  }, [mergedLocations]);

  // Data e Hora simulada para o preview local
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = useMemo(() => {
    if (!wizard.timeZone) return '—';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: wizard.timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(currentTime);
    } catch {
      return '—';
    }
  }, [wizard.timeZone, currentTime]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 lg:flex-row">
      {/* 70% Coluna Principal de Configuração */}
      <div className="flex flex-1 flex-col overflow-y-auto pr-2 custom-scrollbar">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Fuso Horário</h2>
          <p className="mt-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
            Selecione no mapa ou busque sua região.
          </p>
        </div>

        <div className="mb-4">
          <KxCombobox
            options={timezoneOptions}
            value={wizard.timeZone}
            onChange={(id) => {
              const loc = mergedLocations.find(l => l.timezone === id);
              if (loc) applyLocation(loc);
            }}
            placeholder={loading ? 'Carregando timezones...' : 'Buscar cidade ou fuso horário...'}
            searchPlaceholder="Buscar por IANA, cidade..."
            disabled={loading}
            maxItems={8}
          />
          <FieldError message={fieldErrors.timeZone} />
        </div>

        <div className="min-h-[300px] flex-1 rounded-xl overflow-hidden border border-slate-200/50 dark:border-white/10 shadow-sm">
          <TimezoneMap
            locations={mappableLocations}
            selectedLocation={selectedLocation}
            value={wizard.timeZone}
            onChange={({ location }) => applyLocation(location)}
          />
        </div>
        
        {error && (
          <div className="mt-4 text-[11px] font-medium text-warning dark:text-warning">
            <span className="font-bold">Aviso:</span> {error}
          </div>
        )}
      </div>

      {/* 30% Coluna Lateral de Resumo */}
      <div className="w-full shrink-0 lg:w-[280px] lg:border-l lg:border-slate-200/50 lg:pl-6 lg:dark:border-white/10">
        <div className="rounded-xl border border-slate-200/50 bg-slate-50/50 p-5 dark:border-white/5 dark:bg-white/[0.02]">
          <h3 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Resumo do Fuso
          </h3>
          
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold">Fuso Selecionado</div>
              <div className="text-[13px] font-bold text-slate-900 dark:text-white mt-0.5 break-all">
                {wizard.timeZone || '—'}
              </div>
            </div>
            
            <div>
              <div className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold">Região</div>
              <div className="text-[13px] font-bold text-slate-900 dark:text-white mt-0.5">
                {selectedLocation?.label || '—'}
              </div>
            </div>
            
            <div className="border-t border-slate-200/50 pt-3 dark:border-white/10">
              <div className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold">Hora Local Prevista</div>
              <div className="text-xl font-bold text-accent-blue mt-0.5">
                {formattedTime}
              </div>
            </div>

            {selectedLocation?.latitude !== undefined && selectedLocation?.longitude !== undefined && (
              <div className="border-t border-slate-200/50 pt-3 dark:border-white/10">
                <div className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold">Coordenadas</div>
                <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                  {Number(selectedLocation.latitude).toFixed(4)}, {Number(selectedLocation.longitude).toFixed(4)}
                </div>
              </div>
            )}
            
            <div className="mt-2">
              <button
                type="button"
                className="btn-secondary w-full !text-xs !py-2"
                onClick={() => applyLocation(decorateTimezoneLocation({
                  timezone: 'Etc/UTC',
                  label: 'UTC',
                  group: 'UTC',
                  latitude: 0,
                  longitude: 0,
                  countryCode: '',
                }))}
              >
                Usar UTC
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
