import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';

export default function SystemSettings() {
  const [settings, setSettings] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.get('/settings').then(r => setSettings(r.data)); }, []);

  const save = async e => {
    e.preventDefault();
    await api.put('/settings', settings);
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const fields = [
    ['daily_report_time', 'Daily Report Time', 'time'],
    ['report_from_email', 'Report From Email', 'email'],
    ['smtp_host', 'SMTP Host', 'text'],
    ['smtp_port', 'SMTP Port', 'number'],
    ['smtp_user', 'SMTP Username', 'text'],
    ['smtp_pass', 'SMTP Password', 'password'],
  ];

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">System Settings</h2>
      <form onSubmit={save} className="bg-white rounded-xl border p-6 space-y-4">
        {fields.map(([key, label, type]) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input type={type} value={settings[key] || ''} onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
        ))}
        {saved && <p className="text-green-600 text-sm">✅ Settings saved!</p>}
        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Save Settings</button>
      </form>
    </div>
  );
}
