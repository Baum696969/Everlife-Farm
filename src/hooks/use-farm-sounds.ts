import { useCallback, useEffect, useRef } from 'react';
import type { SoundSettings } from '@/lib/farm-types';

type SoundType = 'click' | 'grow' | 'buy' | 'harvest' | 'plant' | 'tractor' | 'water' | 'drop' | 'event' | 'rebirth' | 'newVariant';

const soundConfigs: Record<SoundType, { freq: number[]; duration: number; waveform: OscillatorType }> = {
  click:      { freq: [800],               duration: 80,  waveform: 'square' },
  grow:       { freq: [400, 600, 800],      duration: 300, waveform: 'square' },
  buy:        { freq: [600, 800, 1000],     duration: 200, waveform: 'square' },
  harvest:    { freq: [1000, 800, 600],     duration: 400, waveform: 'square' },
  plant:      { freq: [300, 500],           duration: 250, waveform: 'square' },
  tractor:    { freq: [150, 200, 180],      duration: 500, waveform: 'sawtooth' },
  water:      { freq: [500, 700, 900, 700], duration: 400, waveform: 'sine' },
  drop:       { freq: [1200, 1400, 1600, 1800, 2000], duration: 600, waveform: 'sine' },
  event:      { freq: [523, 659, 784, 1047], duration: 800, waveform: 'triangle' },
  rebirth:    { freq: [262, 330, 392, 523, 659, 784], duration: 1200, waveform: 'sine' },
  newVariant: { freq: [800, 1000, 1200, 1400], duration: 500, waveform: 'triangle' },
};

// Map sound types to settings keys
const soundToSetting: Record<SoundType, keyof SoundSettings | null> = {
  click: null, // always plays
  grow: null,
  buy: 'buy',
  harvest: 'harvest',
  plant: null,
  tractor: 'buy',
  water: 'water',
  drop: 'drop',
  event: 'event',
  rebirth: 'rebirth',
  newVariant: 'drop',
};

export function useFarmSounds(settings: SoundSettings) {
  const musicRef = useRef<{ ctx: AudioContext; stop: () => void } | null>(null);

  const playSound = useCallback((type: SoundType) => {
    const settingKey = soundToSetting[type];
    if (settingKey && !settings[settingKey]) return;

    const config = soundConfigs[type];
    if (!config) return;

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      config.freq.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.type = config.waveform;
        gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.1);
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
    if (!settings.music) {
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

      const playLoop = () => {
        if (!running) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(melody[noteIdx], ctx.currentTime);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
        noteIdx = (noteIdx + 1) % melody.length;
        setTimeout(playLoop, 600);
      };

      playLoop();

      musicRef.current = {
        ctx,
        stop: () => {
          running = false;
          ctx.close();
        },
      };

      return () => {
        running = false;
        ctx.close();
        musicRef.current = null;
      };
    } catch {
      // Audio not available
    }
  }, [settings.music]);

  return playSound;
}
