import { useCallback, useEffect, useRef } from 'react';
import type { SoundSettings } from '@/lib/farm-types';

export type SoundType = 'click' | 'plant' | 'harvest' | 'autoHarvest' | 'buy' | 'sell' | 'water' | 'rebirth' | 'event' | 'unlock' | 'drop' | 'grow';

// Sound category mapping
type SoundCategory = 'plant' | 'ui' | 'eventRebirth' | 'always';

const soundCategory: Record<SoundType, SoundCategory> = {
  click: 'always',
  grow: 'always',
  plant: 'plant',
  harvest: 'plant',
  autoHarvest: 'plant',
  buy: 'ui',
  sell: 'ui',
  water: 'ui',
  drop: 'ui',
  rebirth: 'eventRebirth',
  event: 'eventRebirth',
  unlock: 'eventRebirth',
};

// Hit-plant sounds use real MP3 files
const hitPlantPaths = [
  '/sounds/hit-plant-1.mp3',
  '/sounds/hit-plant-2.mp3',
  '/sounds/hit-plant-3.mp3',
];

// Other real MP3 files
const mp3Sounds: Partial<Record<SoundType, string>> = {
  buy: '/sounds/buy.mp3',
  sell: '/sounds/buy.mp3',
  rebirth: '/sounds/rebirth.mp3',
};

// Synth fallbacks for sounds without MP3
const synthConfigs: Partial<Record<SoundType, { freq: number[]; duration: number; waveform: OscillatorType }>> = {
  click: { freq: [800], duration: 80, waveform: 'square' },
  grow: { freq: [400, 600, 800], duration: 300, waveform: 'square' },
  water: { freq: [500, 700, 900, 700], duration: 400, waveform: 'sine' },
  drop: { freq: [1200, 1400, 1600, 1800, 2000], duration: 600, waveform: 'sine' },
  event: { freq: [523, 659, 784, 1047], duration: 800, waveform: 'triangle' },
  unlock: { freq: [800, 1000, 1200, 1400], duration: 500, waveform: 'triangle' },
};

// Preloaded audio cache
const audioCache: Map<string, HTMLAudioElement> = new Map();

function preloadAudio(path: string): HTMLAudioElement {
  let audio = audioCache.get(path);
  if (!audio) {
    audio = new Audio(path);
    audio.preload = 'auto';
    audioCache.set(path, audio);
  }
  return audio;
}

// Preload all sounds on module load
[...hitPlantPaths, ...Object.values(mp3Sounds)].forEach(p => {
  if (p) preloadAudio(p);
});

export function useFarmSounds(settings: SoundSettings) {
  const musicRef = useRef<{ ctx: AudioContext; stop: () => void } | null>(null);

  const playSound = useCallback((type: SoundType, volumeOverride?: number) => {
    const cat = soundCategory[type];
    if (cat === 'plant' && !settings.plantSounds) return;
    if (cat === 'ui' && !settings.uiSounds) return;
    if (cat === 'eventRebirth' && !settings.eventRebirthSounds) return;

    const vol = (volumeOverride ?? 1) * settings.masterVolume;
    if (vol <= 0) return;

    try {
      // Hit-plant sounds for plant/harvest/autoHarvest
      if (type === 'plant' || type === 'harvest' || type === 'autoHarvest') {
        const path = hitPlantPaths[Math.floor(Math.random() * hitPlantPaths.length)];
        const audio = preloadAudio(path).cloneNode() as HTMLAudioElement;
        audio.volume = type === 'autoHarvest' ? vol * 0.7 : vol;
        // Slight pitch variation ±3%
        if (audio.preservesPitch !== undefined) audio.preservesPitch = false;
        audio.playbackRate = 0.97 + Math.random() * 0.06;
        audio.play().catch(() => {});
        return;
      }

      // MP3-based sounds
      const mp3Path = mp3Sounds[type];
      if (mp3Path) {
        const audio = preloadAudio(mp3Path).cloneNode() as HTMLAudioElement;
        audio.volume = vol;
        audio.play().catch(() => {});
        return;
      }

      // Synth fallback
      const config = synthConfigs[type];
      if (!config) return;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      config.freq.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.type = config.waveform;
        gain.gain.setValueAtTime(0.08 * vol, ctx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + config.duration / 1000 + i * 0.1);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + config.duration / 1000 + i * 0.1 + 0.05);
      });
    } catch {
      // Audio not available
    }
  }, [settings]);

  // Background music
  useEffect(() => {
    if (!settings.music || settings.masterVolume <= 0) {
      if (musicRef.current) {
        musicRef.current.stop();
        musicRef.current = null;
      }
      return;
    }

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      let running = true;
      const melody = [262, 294, 330, 349, 392, 349, 330, 294];
      let noteIdx = 0;
      const vol = settings.masterVolume;

      const playLoop = () => {
        if (!running) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(melody[noteIdx], ctx.currentTime);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.04 * vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
        noteIdx = (noteIdx + 1) % melody.length;
        setTimeout(playLoop, 600);
      };

      playLoop();
      musicRef.current = { ctx, stop: () => { running = false; ctx.close(); } };

      return () => {
        running = false;
        ctx.close();
        musicRef.current = null;
      };
    } catch {
      // Audio not available
    }
  }, [settings.music, settings.masterVolume]);

  return playSound;
}
