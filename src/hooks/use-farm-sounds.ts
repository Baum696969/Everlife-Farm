import { useCallback, useEffect, useRef } from 'react';
import type { SoundSettings, MusicTrack } from '@/lib/farm-types';

export type SoundType = 'click' | 'plant' | 'harvest' | 'autoHarvest' | 'buy' | 'sell' | 'water' | 'rebirth' | 'event' | 'unlock' | 'drop' | 'grow' | 'wrong';

// Sound category mapping
type SoundCategory = 'plant' | 'ui' | 'eventRebirth' | 'always';

const soundCategory: Record<SoundType, SoundCategory> = {
  click: 'always',
  grow: 'always',
  wrong: 'always',
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
  wrong: '/sounds/wrong.mp3',
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

// Music tracks
export const musicTracks: { key: MusicTrack; name: string; path: string }[] = [
  { key: 'standard', name: 'Standard (empfohlen)', path: '/sounds/music-standard.mp3' },
  { key: 'lofi', name: 'Lo-Fi Chill', path: '/sounds/music-lofi.mp3' },
  { key: 'lounge', name: 'Cozy Lounge', path: '/sounds/music-lounge.mp3' },
  { key: 'gaming', name: 'Gaming Vibes', path: '/sounds/music-gaming.mp3' },
];

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
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

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

  // Background music using real MP3 tracks
  useEffect(() => {
    if (!settings.music || settings.masterVolume <= 0 || settings.musicVolume <= 0) {
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current.currentTime = 0;
        musicRef.current = null;
      }
      return;
    }

    const track = musicTracks.find(t => t.key === settings.musicTrack) || musicTracks[0];
    
    // If track changed, stop old one
    if (musicRef.current && musicRef.current.src !== new URL(track.path, window.location.origin).href) {
      musicRef.current.pause();
      musicRef.current.currentTime = 0;
      musicRef.current = null;
    }

    if (!musicRef.current) {
      const audio = new Audio(track.path);
      audio.loop = true;
      audio.volume = settings.musicVolume * settings.masterVolume;
      audio.play().catch(() => {});
      musicRef.current = audio;
    } else {
      musicRef.current.volume = settings.musicVolume * settings.masterVolume;
    }

    return () => {
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current.currentTime = 0;
        musicRef.current = null;
      }
    };
  }, [settings.music, settings.musicTrack, settings.musicVolume, settings.masterVolume]);

  // Preview a music track (short play)
  const previewTrack = useCallback((trackKey: MusicTrack) => {
    if (previewRef.current) {
      previewRef.current.pause();
      previewRef.current = null;
    }
    const track = musicTracks.find(t => t.key === trackKey);
    if (!track) return;
    const audio = new Audio(track.path);
    audio.volume = (settings.musicVolume || 0.5) * settings.masterVolume;
    audio.play().catch(() => {});
    previewRef.current = audio;
    // Stop after 6 seconds
    setTimeout(() => {
      if (previewRef.current === audio) {
        audio.pause();
        previewRef.current = null;
      }
    }, 6000);
  }, [settings.musicVolume, settings.masterVolume]);

  return { playSound, previewTrack };
}
