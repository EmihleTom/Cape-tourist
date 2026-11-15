import type { CapeTownWeather } from '@/src/types/app';

const FALLBACK_WEATHER: CapeTownWeather = {
  temperatureC: 21,
  windSpeedKmh: 19,
  windGustsKmh: 31,
  conditionLabel: 'Partly Cloudy · Atlantic Breeze',
  cablewayRisk: 'Moderate',
  observedAtLabel: 'Demo Snapshot',
  dataOrigin: 'demo',
};

function mapWmoWeatherCode(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code <= 3) return 'Partly Cloudy';
  if (code === 45 || code === 48) return 'Coastal Fog / Mist';
  if (code >= 51 && code <= 67) return 'Light Rain / Drizzle';
  if (code >= 80 && code <= 82) return 'Passing Showers';
  if (code >= 95) return 'Thunderstorm Watch';
  return 'Variable Peninsula Weather';
}

export async function fetchCapeTownWeather(): Promise<CapeTownWeather> {
  if (typeof fetch !== 'function') {
    return FALLBACK_WEATHER;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=-33.9249&longitude=18.4241&current=temperature_2m,wind_speed_10m,wind_gusts_10m,weather_code&timezone=Africa%2FJohannesburg';

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return FALLBACK_WEATHER;

    const json = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        wind_speed_10m?: number;
        wind_gusts_10m?: number;
        weather_code?: number;
        time?: string;
      };
    };

    const current = json.current;
    if (!current || typeof current.temperature_2m !== 'number') {
      return FALLBACK_WEATHER;
    }

    const gusts = Math.round(Number(current.wind_gusts_10m ?? current.wind_speed_10m ?? 20));
    const speed = Math.round(Number(current.wind_speed_10m ?? 15));
    const cablewayRisk: CapeTownWeather['cablewayRisk'] =
      gusts >= 45 ? 'High' : gusts >= 30 ? 'Moderate' : 'Low';

    const timePart = current.time ? current.time.split('T')[1]?.slice(0, 5) : '';
    return {
      temperatureC: Math.round(current.temperature_2m),
      windSpeedKmh: speed,
      windGustsKmh: gusts,
      conditionLabel: mapWmoWeatherCode(Number(current.weather_code ?? 1)),
      cablewayRisk,
      observedAtLabel: timePart ? `${timePart} SAST (Open-Meteo)` : 'Live (Open-Meteo)',
      dataOrigin: 'live',
    };
  } catch {
    return FALLBACK_WEATHER;
  }
}
