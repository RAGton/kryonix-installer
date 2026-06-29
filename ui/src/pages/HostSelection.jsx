import React from 'react';
import { useTranslation } from 'react-i18next';

export default function HostSelection({ wizard, onChange, validation }) {
  const { t } = useTranslation();
  const error = validation?.fieldErrors?.hostName;

  return (
    <div className="wizard-content">

      <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-xl max-w-lg">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {t('host_selection.hostname_label', { defaultValue: 'Hostname' })}
        </label>
        <input
          type="text"
          value={wizard.hostName}
          onChange={(e) => onChange({ hostName: e.target.value })}
          className={`w-full bg-gray-900 border ${error ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500`}
          placeholder={t('host_selection.hostname_placeholder', { defaultValue: 'ex: kryonix-server' })}
        />
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        
        <div className="mt-4 text-sm text-gray-500 bg-black/30 p-4 rounded-lg">
          <p><strong>{t('host_selection.note', { defaultValue: 'Nota:' })}</strong> {t('host_selection.note_desc', { defaultValue: 'O nome escolhido aqui sera o nome do host final.' })}</p>
          <p className="mt-2 text-amber-500/80">
            {t('host_selection.offline_notice', { defaultValue: 'Em P1 a fonte e offline (ISO base). A integracao com repositorio GitHub remoto esta em construcao e ainda nao e usada neste instalador.' })}
          </p>
        </div>
      </div>
    </div>
  );
}
