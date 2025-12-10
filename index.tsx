import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { Peer, DataConnection } from 'peerjs';

// --- Configuration & Constants ---

const SCRABBLE_SCORES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
};

type Difficulty = 'Easy' | 'Medium' | 'Hard';
type GameMode = 'scrabble' | 'spelling' | 'multiplayer';

// Fallback Dictionary for Offline/Error Mode (Scrabble)
interface WordEntry {
  word: string;
  definition: string;
  phonetic?: string;
  sentence?: string;
  imageUrl?: string;
}

interface SpellingWordData {
  word: string;
  phonetic?: string;
  definition: string;
  sentence?: string;
  imageUrl?: string;
}

const LOCAL_DICTIONARY: Record<Difficulty, WordEntry[]> = {
  Easy: [
    { word: "APPLE", definition: "A round fruit with red or green skin and a whitish inside." },
    { word: "BREAD", definition: "Food made of flour, water, and yeast." },
    { word: "CHAIR", definition: "A separate seat for one person, typically with a back and four legs." },
    { word: "DANCE", definition: "Move rhythmically to music." },
    { word: "HAPPY", definition: "Feeling or showing pleasure or contentment." },
    // User Added Words (1-30)
    { word: "ABATE", definition: "To reduce or lessen." },
    { word: "ABRIDGE", definition: "To shorten a text." },
    { word: "ACCENTUATE", definition: "To emphasize." },
    { word: "AFFLUENT", definition: "Rich, wealthy." },
    { word: "ALLUDE", definition: "To indirectly refer to something." },
    { word: "AMELIORATE", definition: "To make something better." },
    { word: "APATHETIC", definition: "Not caring; showing little emotion." },
    { word: "ARDUOUS", definition: "Very difficult or tiring." },
    { word: "AUSPICIOUS", definition: "Favorable; showing good signs." },
    { word: "BANAL", definition: "Boring, not original." },
    { word: "BENIGN", definition: "Harmless." },
    { word: "BOLSTER", definition: "To support or strengthen." },
    { word: "CANDID", definition: "Honest and truthful." },
    { word: "CHRONICLE", definition: "To record events in order." },
    { word: "COHERENT", definition: "Clear and logical." },
    { word: "COLLOQUIAL", definition: "Informal language." },
    { word: "CONCUR", definition: "To agree." },
    { word: "CONSPICUOUS", definition: "Easily seen or noticed." },
    { word: "CURSORY", definition: "Quick and not detailed." },
    { word: "DAUNTING", definition: "Intimidating; scary to start." },
    { word: "DEBILITATE", definition: "To weaken." },
    { word: "DELINEATE", definition: "To describe clearly." },
    { word: "DERIVE", definition: "To obtain from a source." },
    { word: "DILIGENT", definition: "Hardworking." },
    { word: "DISCERN", definition: "To notice or recognize." },
    { word: "DISCREET", definition: "Careful not to attract attention." },
    { word: "ELICIT", definition: "To draw out (information or reaction)." },
    { word: "ELUSIVE", definition: "Hard to find or catch." },
    { word: "EMULATE", definition: "To imitate to match or surpass." },
    { word: "ENIGMATIC", definition: "Mysterious." }
  ],
  Medium: [
    { word: "BRIDGE", definition: "A structure carrying a road across a river." },
    { word: "CANYON", definition: "A deep gorge, typically one with a river flowing through it." },
    { word: "GALAXY", definition: "A system of millions or billions of stars." },
    { word: "HARBOR", definition: "A place on the coast where vessels may find shelter." },
    { word: "MAGNET", definition: "A material that exhibits properties of magnetism." },
    { word: "AMBIGUOUS", definition: "Not clear; can have more than one meaning." },
    { word: "PLAUSIBLE", definition: "Seems possible or believable." },
    { word: "INEVITABLE", definition: "Cannot be avoided." },
    { word: "METICULOUS", definition: "Very careful with details." },
    { word: "TEDIOUS", definition: "Boring and long." },
    { word: "HOSTILE", definition: "Unfriendly or aggressive." },
    { word: "SUBTLE", definition: "Not obvious." },
    { word: "INFER", definition: "To conclude from clues." },
    { word: "MUNDANE", definition: "Ordinary, not exciting." },
    { word: "REFRAIN", definition: "To stop yourself from doing something." },
    { word: "ADEQUATE", definition: "Good enough." },
    { word: "ARBITRARY", definition: "Based on random choice, not reason." },
    { word: "CONVENTIONAL", definition: "Normal, traditional." },
    { word: "RELUCTANT", definition: "Not wanting to do something." },
    { word: "AMPLE", definition: "More than enough." },
    { word: "BRITTLE", definition: "Easily broken." },
    { word: "PONDER", definition: "To think deeply." },
    { word: "RIGID", definition: "Not flexible." },
    { word: "TRIVIAL", definition: "Not important." },
    { word: "PROFOUND", definition: "Deep or meaningful." },
    { word: "CUMULATIVE", definition: "Increasing by adding over time." }
  ],
  Hard: [
    { word: "ECLIPSE", definition: "An obscuring of the light from one celestial body by another." },
    { word: "GLACIER", definition: "A slowly moving mass of ice formed by the accumulation of snow." },
    { word: "LABYRINTH", definition: "A complicated irregular network of passages; a maze." },
    { word: "PHOENIX", definition: "A mythical bird that regenerates from its own ashes." },
    { word: "SYMPHONY", definition: "An elaborate musical composition for full orchestra." },
    { word: "OBFUSCATE", definition: "To make something unclear." },
    { word: "PERNICIOUS", definition: "Harmful in a subtle way." },
    { word: "UBIQUITOUS", definition: "Found everywhere." },
    { word: "EPHEMERAL", definition: "Lasting for a very short time." },
    { word: "MAGNANIMOUS", definition: "Very generous and forgiving." },
    { word: "ESOTERIC", definition: "Known only by a small group." },
    { word: "FASTIDIOUS", definition: "Very picky; hard to please." },
    { word: "BELLIGERENT", definition: "Aggressive or ready to fight." },
    { word: "EQUANIMITY", definition: "Calmness under stress." },
    { word: "HEGEMONY", definition: "Dominance or control over others." },
    { word: "PERFUNCTORY", definition: "Done quickly without care." },
    { word: "OBSTINATE", definition: "Stubborn and unwilling to change." },
    { word: "SARDONIC", definition: "Mocking in a bitter way." },
    { word: "RECALCITRANT", definition: "Refusing to obey rules." },
    { word: "SAGACIOUS", definition: "Wise and good at judging." },
    { word: "INTRANSIGENT", definition: "Refusing to compromise." },
    { word: "ANACHRONISTIC", definition: "Out of its proper time period." },
    { word: "PULCHRITUDE", definition: "Physical beauty." },
    { word: "DISPARATE", definition: "Very different; not related." },
    { word: "MENDACIOUS", definition: "Lying; not truthful." },
    { word: "INDEFATIGABLE", definition: "Never getting tired." },
    { word: "EXTEMPORANEOUS", definition: "Spoken or done without preparation." },
    { word: "QUINTESSENTIAL", definition: "The purest example of something." },
    { word: "CONFLAGRATION", definition: "A large, destructive fire." },
    { word: "INSCRUTABLE", definition: "Impossible to understand." },
    { word: "PUGNACIOUS", definition: "Eager to fight or argue." },
    { word: "IMPETUOUS", definition: "Acting quickly without thinking." },
    { word: "INELUCTABLE", definition: "Unavoidable." },
    { word: "SUPERCILIOUS", definition: "Behaving as if better than others." },
    { word: "GRANDILOQUENT", definition: "Using fancy or exaggerated language." },
    { word: "LUGUBRIOUS", definition: "Sad and gloomy." },
    { word: "INEFFABLE", definition: "Too great to be described with words." },
    { word: "OBSEQUIOUS", definition: "Too eager to please or obey." },
    { word: "VICISSITUDE", definition: "A sudden change, usually unpleasant." },
    { word: "ABSTRUSE", definition: "Difficult to understand." },
    { word: "RECONDITE", definition: "Little-known; obscure." },
    { word: "CACOPHONY", definition: "Harsh, unpleasant mixture of sounds." },
    { word: "PHLEGMATIC", definition: "Calm and not easily excited." },
    { word: "OBDURATE", definition: "Very stubborn." },
    { word: "INIMICAL", definition: "Harmful or unfriendly." },
    { word: "PERSPICACIOUS", definition: "Very smart; able to notice details." },
    { word: "MUNIFICENT", definition: "Extremely generous." },
    { word: "PARSIMONIOUS", definition: "Very unwilling to spend money." },
    { word: "IMPLACABLE", definition: "Cannot be calmed or stopped." },
    { word: "SYCOPHANT", definition: "Someone who flatters to gain favor." },
    { word: "ASSIDUOUS", definition: "Persistent and hardworking." },
    { word: "INSIDIOUS", definition: "Sneaky and harmful." },
    { word: "PERIPATETIC", definition: "Traveling from place to place." },
    { word: "QUERULOUS", definition: "Always complaining." },
    { word: "REPLETE", definition: "Completely filled." },
    { word: "TREPIDATION", definition: "Fear or worry." },
    { word: "AMBIVALENT", definition: "Having mixed feelings." },
    { word: "JUXTAPOSE", definition: "To place side by side for comparison." },
    { word: "IMPROVIDENT", definition: "Not planning for the future." },
    { word: "EXECRABLE", definition: "Extremely bad." },
    { word: "OBVIATE", definition: "To remove a need or problem." },
    { word: "VITRIOLIC", definition: "Extremely harsh or bitter." },
    { word: "PUSILLANIMOUS", definition: "Cowardly." },
    // User Added Words (31-60)
    { word: "ERRATIC", phonetic: "/ɪˈrætɪk/", definition: "Unpredictable.", sentence: "His driving was ____." },
    { word: "EXACERBATE", phonetic: "/ɪɡˈzæsərbeɪt/", definition: "To make worse.", sentence: "Stress can ____ the pain." },
    { word: "FEASIBLE", phonetic: "/ˈfiːzəbl/", definition: "Possible or doable.", sentence: "The plan is ____." },
    { word: "FERVENT", phonetic: "/ˈfɜːrvənt/", definition: "Very passionate." },
    { word: "FRIVOLOUS", phonetic: "/ˈfrɪvələs/", definition: "Not serious; unimportant." },
    { word: "GALVANIZE", phonetic: "/ˈɡælvənaɪz/", definition: "To inspire to take action." },
    { word: "GRAVITATE", phonetic: "/ˈɡrævɪteɪt/", definition: "To be drawn toward something." },
    { word: "IMMINENT", phonetic: "/ˈɪmɪnənt/", definition: "About to happen." },
    { word: "IMPARTIAL", phonetic: "/ɪmˈpɑːrʃl/", definition: "Fair, not biased." },
    { word: "IMPLICIT", phonetic: "/ɪmˈplɪsɪt/", definition: "Implied, not directly stated." },
    { word: "INCESSANT", phonetic: "/ɪnˈsɛsnt/", definition: "Nonstop." },
    { word: "INCREDULOUS", phonetic: "/ɪnˈkrɛdʒələs/", definition: "Unable to believe." },
    { word: "INDOLENT", phonetic: "/ˈɪndələnt/", definition: "Lazy." },
    { word: "INSINUATE", phonetic: "/ɪnˈsɪnjueɪt/", definition: "To hint something negative." },
    { word: "INSTIGATE", definition: "To start or provoke." },
    { word: "INTREPID", definition: "Brave, fearless." },
    { word: "JUDICIOUS", definition: "Wise, sensible." },
    { word: "LUCID", definition: "Clear and easy to understand." },
    { word: "MEDIOCRE", definition: "Average, not very good." },
    { word: "MITIGATE", definition: "To reduce the effect." },
    { word: "NOVEL", definition: "New and original." },
    { word: "OBSOLETE", definition: "Outdated." },
    { word: "OMNIPRESENT", definition: "Present everywhere." },
    { word: "PERPLEX", definition: "To confuse." },
    { word: "PRAGMATIC", definition: "Practical." },
    { word: "PROLIFIC", definition: "Highly productive." },
    { word: "REITERATE", definition: "To repeat." },
    { word: "RESILIENT", definition: "Able to recover quickly." },
    { word: "SCRUTINIZE", definition: "To examine closely." },
    { word: "TANGIBLE", definition: "Something you can touch or handle." }
  ]
};

// --- Sound Utility ---

const SoundManager = {
  ctx: null as AudioContext | null,
  init: () => {
    if (!SoundManager.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        SoundManager.ctx = new AudioCtx();
      }
    }
    if (SoundManager.ctx?.state === 'suspended') {
      SoundManager.ctx.resume().catch(() => {});
    }
    return SoundManager.ctx;
  },
  playWin: () => {
    const ctx = SoundManager.init();
    if (!ctx) return;
    
    // Applause (Filtered White Noise)
    const bufferSize = ctx.sampleRate * 2.0; 
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 1000;
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, ctx.currentTime);
    noiseGain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2.0);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();
    
    // Victory Chime
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => { 
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05 + (i * 0.08));
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + (i * 0.08));
        osc.stop(ctx.currentTime + 1.5);
    });
  },
  playError: () => {
    const ctx = SoundManager.init();
    if (!ctx) return;
    
    // Buzzer Sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(60, ctx.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }
};

// --- Styles ---

const styles = `
  :root {
    --bg-color: #2e8b57; /* Sea Green / Felt Green */
    --tile-color: #f4e7d1;
    --tile-shadow: #d9cba8;
    --wood-color: #8b5a2b;
    --wood-dark: #5c3a1b;
    --text-main: #ffffff;
    --accent: #f9a825;
    --danger: #e57373;
    --tab-inactive: rgba(0,0,0,0.3);
    --tab-active: rgba(255,255,255,0.2);
    --spelling-bg: #fff9c4;
  }

  body {
    margin: 0;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: var(--bg-color);
    color: var(--text-main);
    display: flex;
    justify-content: center;
    min-height: 100vh;
    overflow-x: hidden;
  }

  .app-container {
    width: 100%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px;
    box-sizing: border-box;
  }

  /* Navigation */
  .nav-tabs {
    display: flex;
    width: 100%;
    margin-bottom: 20px;
    background: var(--tab-inactive);
    border-radius: 12px;
    padding: 5px;
    gap: 5px;
  }
  
  .nav-tab {
    flex: 1;
    text-align: center;
    padding: 10px;
    cursor: pointer;
    border-radius: 8px;
    font-weight: bold;
    color: rgba(255,255,255,0.7);
    transition: all 0.2s;
  }
  
  .nav-tab.active {
    background: var(--tab-active);
    color: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }

  /* Header & Score */
  .header {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-bottom: 20px;
    background: rgba(0, 0, 0, 0.2);
    padding: 15px 20px;
    border-radius: 12px;
    backdrop-filter: blur(5px);
    box-sizing: border-box;
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
  }

  .game-title {
    font-size: 1.5rem;
    font-weight: 800;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
    letter-spacing: 1px;
    color: var(--accent);
  }

  .score-container {
    text-align: right;
  }

  .score-board {
    font-size: 1.2rem;
    font-weight: bold;
    color: white;
  }

  .high-score {
    font-size: 0.8rem;
    color: var(--accent);
    margin-top: 2px;
    font-weight: 600;
  }

  .level-selector {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 0.9rem;
    color: rgba(255,255,255,0.8);
    flex-wrap: wrap;
  }

  .level-select {
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.2);
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
  }

  .level-select:focus {
    outline: none;
    border-color: var(--accent);
  }

  /* SCRABBLE MODE STYLES */
  .definition-card {
    background: white;
    color: #333;
    padding: 25px;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    margin-bottom: 30px;
    width: 100%;
    text-align: center;
    position: relative;
    min-height: 100px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    box-sizing: border-box;
  }

  .definition-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #888;
    margin-bottom: 10px;
  }

  .definition-text {
    font-size: 1.2rem;
    line-height: 1.5;
    font-weight: 500;
  }

  .board-area {
    display: flex;
    gap: 8px;
    margin-bottom: 30px;
    flex-wrap: wrap;
    justify-content: center;
    min-height: 60px;
  }

  .slot {
    width: 48px;
    height: 48px;
    background: rgba(0,0,0,0.15);
    border-radius: 6px;
    border: 2px solid rgba(255,255,255,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .slot.filled {
    border-color: transparent;
    background: transparent;
  }

  .tile {
    width: 46px;
    height: 46px;
    background: var(--tile-color);
    border-radius: 6px;
    box-shadow: 0 4px 0 var(--tile-shadow), 0 5px 5px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    color: #333;
    user-select: none;
    transform: translateY(0);
    transition: transform 0.1s, box-shadow 0.1s;
    cursor: pointer;
    z-index: 2;
  }
  
  .tile.locked {
    filter: brightness(0.95);
    cursor: default;
  }

  .tile:active {
    transform: translateY(4px);
    box-shadow: 0 0 0 var(--tile-shadow), 0 0 0 rgba(0,0,0,0);
  }

  .tile-letter {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1;
  }

  .tile-score {
    position: absolute;
    bottom: 2px;
    right: 3px;
    font-size: 0.6rem;
    font-weight: 600;
  }

  .rack-container {
    background: linear-gradient(to bottom, var(--wood-color), var(--wood-dark));
    padding: 15px 15px 20px;
    border-radius: 6px;
    box-shadow: 0 10px 20px rgba(0,0,0,0.4);
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
    width: fit-content;
    min-width: 300px;
    min-height: 80px;
    align-items: center;
    margin-bottom: 30px;
    position: relative;
    box-sizing: border-box;
  }
  
  .rack-container::after {
    content: '';
    position: absolute;
    bottom: -10px;
    left: 10px;
    right: 10px;
    height: 10px;
    background: rgba(0,0,0,0.3);
    border-radius: 50%;
    filter: blur(5px);
    z-index: -1;
  }

  /* SPELLING GAME STYLES */
  .spelling-container {
    background: var(--spelling-bg);
    border-radius: 12px;
    padding: 30px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 8px 16px rgba(0,0,0,0.2);
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
  }

  .spelling-container.won {
    background: #d cedc8;
  }
  
  .spelling-container.error {
    animation: shake 0.5s;
    border: 2px solid var(--danger);
  }

  @keyframes shake {
    0% { transform: translate(1px, 1px) rotate(0deg); }
    10% { transform: translate(-1px, -2px) rotate(-1deg); }
    20% { transform: translate(-3px, 0px) rotate(1deg); }
    30% { transform: translate(3px, 2px) rotate(0deg); }
    40% { transform: translate(1px, -1px) rotate(1deg); }
    50% { transform: translate(-1px, 2px) rotate(-1deg); }
    60% { transform: translate(-3px, 1px) rotate(0deg); }
    70% { transform: translate(3px, 1px) rotate(-1deg); }
    80% { transform: translate(-1px, -1px) rotate(1deg); }
    90% { transform: translate(1px, 2px) rotate(0deg); }
    100% { transform: translate(1px, -2px) rotate(-1deg); }
  }

  .audio-btn-large {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: var(--wood-color);
    border: 3px solid #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    margin-bottom: 15px;
    transition: transform 0.1s, background 0.2s;
  }

  .audio-btn-large:active {
    transform: scale(0.95);
  }
  
  .audio-btn-large:hover {
    background: var(--wood-dark);
  }

  .audio-icon {
    font-size: 2rem;
    color: white;
  }

  .word-image-container {
    width: 200px;
    height: 200px;
    background: rgba(255,255,255,0.5);
    border-radius: 12px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 4px solid #fff;
    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    position: relative;
    flex-shrink: 0;
  }
  
  .word-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .image-placeholder {
    font-size: 3rem;
    opacity: 0.5;
  }

  .phonetic-display {
    font-family: 'Lucida Sans Unicode', 'Arial Unicode MS', 'sans-serif';
    font-size: 1.2rem;
    color: #5d4037;
    background: rgba(255, 255, 255, 0.4);
    padding: 4px 12px;
    border-radius: 12px;
    margin-bottom: 25px;
    font-style: italic;
  }

  .spelling-input {
    width: 100%;
    max-width: 300px;
    padding: 15px;
    font-size: 2rem;
    text-align: center;
    border: none;
    border-bottom: 3px solid var(--wood-color);
    background: transparent;
    color: var(--wood-dark);
    font-family: 'Courier New', monospace;
    font-weight: bold;
    letter-spacing: 5px;
    outline: none;
    text-transform: uppercase;
    margin-bottom: 20px;
  }

  .spelling-input::placeholder {
    color: rgba(0,0,0,0.2);
    letter-spacing: 0;
  }

  .hint-section {
    width: 100%;
    text-align: center;
    margin-bottom: 20px;
    min-height: 60px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .hint-text {
    color: var(--wood-dark);
    font-style: italic;
    font-size: 1.1rem;
    background: rgba(255,255,255,0.5);
    padding: 10px;
    border-radius: 8px;
    max-width: 90%;
  }

  .word-reveal {
    font-size: 2rem;
    color: var(--bg-color);
    font-weight: bold;
    margin-bottom: 20px;
    text-shadow: 1px 1px 0 #fff;
  }

  /* Buttons & Controls */
  .controls {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
    justify-content: center;
    width: 100%;
  }

  .btn {
    padding: 12px 24px;
    border: none;
    border-radius: 25px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.1s, opacity 0.2s;
    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .btn:active {
    transform: scale(0.95);
  }

  .btn-primary {
    background: var(--accent);
    color: #3e2700;
  }
  
  .btn-secondary {
    background: #ffffff;
    color: var(--wood-dark);
    border: 1px solid var(--wood-color);
  }
  
  .btn-hint {
    background: #ffb74d;
    color: #4e342e;
  }
  
  .btn-audio-small {
    background: var(--wood-color);
    color: white;
    padding: 8px 16px;
    font-size: 0.9rem;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .message {
    height: 20px;
    margin-bottom: 10px;
    color: var(--accent);
    font-weight: bold;
    text-align: center;
  }

  .loader {
    width: 30px;
    height: 30px;
    border: 4px solid #fff;
    border-bottom-color: transparent;
    border-radius: 50%;
    animation: rotation 1s linear infinite;
    margin: 40px auto;
  }

  @keyframes rotation {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .api-warning {
    background: #ff5252;
    color: white;
    padding: 10px;
    border-radius: 8px;
    margin-top: 20px;
    text-align: center;
    max-width: 400px;
  }
  
  .shuffle-btn {
    position: absolute;
    right: -40px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: rgba(255,255,255,0.6);
    cursor: pointer;
    font-size: 1.5rem;
  }
  
  .shuffle-btn:hover {
    color: white;
  }
  
  .seen-count {
    position: absolute;
    bottom: -25px;
    right: 0;
    font-size: 0.7rem;
    color: rgba(255,255,255,0.5);
  }
  
  /* Multiplayer Styles */
  .lobby-card {
      background: white;
      border-radius: 12px;
      padding: 30px;
      width: 100%;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      color: #333;
      text-align: center;
  }

  .lobby-input {
      width: 100%;
      padding: 12px;
      font-size: 1.2rem;
      border: 2px solid #ccc;
      border-radius: 8px;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 3px;
      box-sizing: border-box;
  }

  .lobby-code {
      font-size: 3rem;
      font-weight: 800;
      letter-spacing: 5px;
      color: var(--wood-color);
      margin: 10px 0;
      user-select: all;
  }

  .player-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 100%;
      margin-bottom: 20px;
  }

  .player-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f0f0f0;
      padding: 8px 15px;
      border-radius: 8px;
      font-weight: bold;
  }

  .player-row.active {
      background: var(--accent);
      color: #3e2700;
      border: 2px solid #fff;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  }
  
  .opponent-view {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 2px dashed rgba(255,255,255,0.3);
      width: 100%;
      text-align: center;
      opacity: 0.7;
  }

  @keyframes pop {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }
  
  .win-anim {
    animation: pop 0.3s ease-in-out;
  }
`;

// --- Types ---

interface Tile {
  id: string;
  letter: string;
  value: number;
  isHint?: boolean;
}

// Scrabble Game Types
interface ScrabbleState {
  word: string;
  definition: string;
  placedTiles: (Tile | null)[];
  rackTiles: Tile[];
  status: 'loading' | 'playing' | 'won' | 'error';
  score: number;
  message: string;
  seenWords: string[];
  imageUrl?: string;
}

interface SpellingState {
    data: SpellingWordData | null;
    input: string;
    status: 'loading' | 'playing' | 'won' | 'error';
    message: string;
    showDefinition: boolean;
    showSentence: boolean;
}

// --- Logic Helpers ---

function shuffleArray<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

function generateTiles(word: string): Tile[] {
  return word.toUpperCase().split('').map((char, index) => ({
    id: `${char}-${index}-${Math.random()}`,
    letter: char,
    value: SCRABBLE_SCORES[char] || 0
  }));
}

// Pollinations.ai Image Generator (No API Key Required)
const getPollinationsImage = (word: string) => {
    // Generate a consistent but distinct seed-like effect or just use word
    // "nologo=true" removes the watermark
    // "cartoon illustration" style
    return `https://image.pollinations.ai/prompt/cartoon%20illustration%20of%20${word}%20simple%20vector%20art%20white%20background%20educational?width=400&height=400&nologo=true&seed=${Math.floor(Math.random()*1000)}`;
}

// --- Components ---

const ScrabbleGame = ({ difficulty, onScoreUpdate }: { difficulty: Difficulty, onScoreUpdate: (points: number) => void }) => {
  const [state, setState] = useState<ScrabbleState>({
    word: '',
    definition: '',
    placedTiles: [],
    rackTiles: [],
    status: 'loading',
    score: 0,
    message: '',
    seenWords: []
  });

  const seenWordsRef = useRef<string[]>([]);

  const fetchWord = useCallback(async () => {
    setState(prev => ({ ...prev, status: 'loading', message: '', placedTiles: [], rackTiles: [], word: '', definition: '', imageUrl: undefined }));
    
    // Attempt Gemini API first
    if (process.env.API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const model = difficulty === 'Hard' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';
        
        const prompt = `
          Pick a single random English word and its definition.
          Difficulty Level: ${difficulty}.
          ${difficulty === 'Easy' ? 'Word length 4-5 letters. Common everyday words.' : ''}
          ${difficulty === 'Medium' ? 'Word length 6-8 letters. Standard to Advanced vocabulary.' : ''}
          ${difficulty === 'Hard' ? 'Word length 8-15 letters. Obscure, scientific, archaic, or literary words are encouraged.' : ''}
          
          Do NOT use these words: ${seenWordsRef.current.slice(-20).join(', ')}.
          
          Return JSON format:
          {
            "word": "EXAMPLE",
            "definition": "The definition of the word."
          }
        `;

        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
             responseMimeType: 'application/json',
             responseSchema: {
               type: Type.OBJECT,
               properties: {
                 word: { type: Type.STRING },
                 definition: { type: Type.STRING }
               },
               required: ['word', 'definition']
             }
          }
        });
        
        const data = JSON.parse(response.text);
        
        if (data.word && data.definition) {
             const word = data.word.toUpperCase().trim();
             const def = data.definition;
             const tiles = generateTiles(word);
             
             seenWordsRef.current.push(word);
             
             setState(prev => ({
                ...prev,
                word: word,
                definition: def,
                placedTiles: Array(word.length).fill(null),
                rackTiles: shuffleArray(tiles),
                status: 'playing',
                score: 0,
                seenWords: [...prev.seenWords, word],
                imageUrl: getPollinationsImage(word)
             }));
             return;
        }

      } catch (e) {
        console.warn("API Error, falling back to local dictionary", e);
      }
    }

    // Fallback Logic
    await new Promise(resolve => setTimeout(resolve, 500));
    const candidates = LOCAL_DICTIONARY[difficulty];
    const available = candidates.filter(c => !seenWordsRef.current.includes(c.word));
    const pool = available.length > 0 ? available : candidates;
    const randomEntry = pool[Math.floor(Math.random() * pool.length)];
    
    const word = randomEntry.word.toUpperCase();
    const definition = randomEntry.definition;
    const tiles = generateTiles(word);
    
    seenWordsRef.current.push(word);
    
    setState(prev => ({
      ...prev,
      word: word,
      definition: definition,
      placedTiles: Array(word.length).fill(null),
      rackTiles: shuffleArray(tiles),
      status: 'playing',
      score: 0,
      seenWords: [...prev.seenWords, word],
      imageUrl: getPollinationsImage(word)
    }));

  }, [difficulty]);

  useEffect(() => {
    fetchWord();
  }, [fetchWord]);

  // Logic Handlers
  const handleRackTileClick = (tile: Tile) => {
    if (state.status !== 'playing') return;
    SoundManager.init();
    const firstEmptyIndex = state.placedTiles.findIndex(t => t === null);
    if (firstEmptyIndex === -1) return;

    const newPlaced = [...state.placedTiles];
    newPlaced[firstEmptyIndex] = tile;
    const newRack = state.rackTiles.filter(t => t.id !== tile.id);
    const currentScore = newPlaced.reduce((acc, t) => acc + (t ? t.value : 0), 0);

    setState(prev => ({ ...prev, placedTiles: newPlaced, rackTiles: newRack, score: currentScore }));
    checkWin(newPlaced, state.word);
  };

  const handlePlacedTileClick = (index: number) => {
    if (state.status !== 'playing') return;
    SoundManager.init();
    const tile = state.placedTiles[index];
    if (!tile || tile.isHint) return;

    const newPlaced = [...state.placedTiles];
    newPlaced[index] = null;
    const newRack = [...state.rackTiles, tile];
    const currentScore = newPlaced.reduce((acc, t) => acc + (t ? t.value : 0), 0);

    setState(prev => ({ ...prev, placedTiles: newPlaced, rackTiles: newRack, score: currentScore }));
  };

  const useHint = () => {
    if (state.status !== 'playing') return;
    SoundManager.init();
    
    // Penalize score immediately
    onScoreUpdate(-5);
    
    const { word, placedTiles, rackTiles } = state;
    
    // Find first incorrect or empty slot
    let targetIndex = -1;
    for (let i = 0; i < word.length; i++) {
        if (!placedTiles[i] || placedTiles[i]?.letter !== word[i]) {
            targetIndex = i;
            break;
        }
    }

    if (targetIndex === -1) return;

    const targetLetter = word[targetIndex];
    let tileToMove: Tile | undefined;
    let newRack = [...rackTiles];
    let newPlaced = [...placedTiles];
    
    // Look in rack first
    const rackIndex = newRack.findIndex(t => t.letter === targetLetter);
    if (rackIndex !== -1) {
        tileToMove = newRack[rackIndex];
        newRack.splice(rackIndex, 1);
    } else {
        // Look in placed tiles (misplaced)
        const placedIndex = newPlaced.findIndex((t, idx) => 
            t?.letter === targetLetter && (idx !== targetIndex && newPlaced[idx]?.letter !== word[idx])
        );
        if (placedIndex !== -1) {
            tileToMove = newPlaced[placedIndex]!;
            newPlaced[placedIndex] = null; 
        }
    }

    if (tileToMove) {
        const hintTile = { ...tileToMove, isHint: true };
        if (newPlaced[targetIndex]) {
            newRack.push(newPlaced[targetIndex]!); // Return existing tile to rack
        }
        newPlaced[targetIndex] = hintTile;
        
        setState(prev => ({
            ...prev,
            placedTiles: newPlaced,
            rackTiles: newRack,
            message: 'Hint Used! -5 Points'
        }));
        setTimeout(() => setState(prev => ({...prev, message: ''})), 1500);
        checkWin(newPlaced, word);
    }
  };

  const shuffleRack = () => {
    SoundManager.init();
    setState(prev => ({ ...prev, rackTiles: shuffleArray(prev.rackTiles) }));
  };

  const checkWin = (currentPlaced: (Tile | null)[], targetWord: string) => {
    if (currentPlaced.some(t => t === null)) return;
    const formedWord = currentPlaced.map(t => t?.letter).join('');
    
    if (formedWord === targetWord) {
      SoundManager.playWin();
      const wordScore = currentPlaced.reduce((acc, t) => acc + (t ? t.value : 0), 0);
      onScoreUpdate(wordScore);
      setState(prev => ({ ...prev, status: 'won', message: `Correct! +${wordScore} pts` }));
    } else {
      SoundManager.playError();
      setState(prev => ({ ...prev, message: 'Not quite...' }));
      setTimeout(() => setState(prev => ({ ...prev, message: '' })), 2000);
    }
  };

  if (state.status === 'loading') return <div className="loader"></div>;

  return (
    <>
      <div className="definition-card">
        {state.imageUrl && (
            <div className="word-image-container" style={{width: 150, height: 150, margin: '0 auto 15px'}}>
                <img src={state.imageUrl} alt="Hint" className="word-image" />
            </div>
        )}
        <div className="definition-label">Definition</div>
        <div className="definition-text">{state.definition}</div>
      </div>

      <div className="board-area">
        {state.placedTiles.map((tile, index) => (
          <div key={`slot-${index}`} className={`slot ${tile ? 'filled' : ''}`} onClick={() => handlePlacedTileClick(index)}>
            {tile && (
              <div className={`tile ${tile.isHint ? 'locked' : ''} ${state.status === 'won' ? 'win-anim' : ''}`}>
                <span className="tile-letter">{tile.letter}</span>
                <span className="tile-score">{tile.value}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="message">{state.message}</div>

      {state.status === 'won' ? (
        <div className="controls">
          <button className="btn btn-primary" onClick={fetchWord}>Next Word →</button>
        </div>
      ) : (
        <div className="rack-container">
          <button className="shuffle-btn" onClick={shuffleRack}>↻</button>
          {state.rackTiles.map((tile) => (
            <div key={tile.id} className="tile" onClick={() => handleRackTileClick(tile)}>
              <span className="tile-letter">{tile.letter}</span>
              <span className="tile-score">{tile.value}</span>
            </div>
          ))}
        </div>
      )}

      {state.status === 'playing' && (
        <div className="controls">
          <button className="btn btn-hint" onClick={useHint}>💡 Hint (-5)</button>
          <button className="btn btn-secondary" onClick={fetchWord}>Skip Word</button>
        </div>
      )}
    </>
  );
};

// --- Multiplayer Types & Component ---

interface Player {
    id: string;
    name: string;
}

interface GameState {
    players: Player[];
    words: SpellingWordData[];
    currentWordIndex: number;
    activePlayerIndex: number; // Index in players array
    phase: 'main' | 'steal'; // 'main' attempt or 'steal' attempt after failure
    timeLeft: number;
    scores: Record<string, number>;
    status: 'waiting' | 'playing' | 'gameover';
}

const MultiplayerGame = ({ difficulty }: { difficulty: Difficulty }) => {
    const [status, setStatus] = useState<'lobby' | 'hosting' | 'joining' | 'playing' | 'gameover'>('lobby');
    const [role, setRole] = useState<'host' | 'client' | null>(null);
    const [joinInput, setJoinInput] = useState('');
    const [connection, setConnection] = useState<any>(null); // For client
    const [peerId, setPeerId] = useState<string>('');
    const peerRef = useRef<any>(null);
    const hostConnectionsRef = useRef<Map<string, any>>(new Map()); // For host

    // Host Authoritative State
    const [gameState, setGameState] = useState<GameState>({
        players: [],
        words: [],
        currentWordIndex: 0,
        activePlayerIndex: 0,
        phase: 'main',
        timeLeft: 30,
        scores: {},
        status: 'waiting',
    });
    
    // Client Local Input State
    const [input, setInput] = useState('');
    const [message, setMessage] = useState('');
    const [showDef, setShowDef] = useState(false);

    // --- Voice Logic ---
    const speak = useCallback((text: string) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const coolMaleVoice = voices.find(v => v.name === "Google US English") || voices.find(v => v.lang.startsWith("en") && v.name.includes("Male"));
        if (coolMaleVoice) utterance.voice = coolMaleVoice;
        utterance.pitch = 0.8;
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }, []);

    // --- Peer Setup ---
    useEffect(() => {
        const id = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        const setupPeer = () => {
             const peer = new Peer(id, { debug: 1 });
             peerRef.current = peer;

             peer.on('open', (id) => {
                 setPeerId(id);
             });
             
             peer.on('error', (err) => {
                 console.error("Peer error:", err);
                 setMessage("Connection Error. Retrying...");
                 setTimeout(setupPeer, 2000);
             });

             peer.on('connection', (conn) => {
                 // Host Logic: Incoming Connection
                 conn.on('open', () => {
                     // Only Host handles incoming connections this way
                     if (role !== 'host' && status !== 'lobby') return; // Should likely be 'host' or transitioning

                     // Logic moved to a function to access current state via ref or state setter
                     handleNewConnection(conn, id);
                 });
             });
        };
        
        setupPeer();
        return () => peerRef.current?.destroy();
    }, []);

    // Helper to handle new connections (Host side)
    const handleNewConnection = (conn: any, myId: string) => {
         // Determine if we are hosting and if there's space
         setRole('host');
         setStatus('hosting');
         
         setGameState(prev => {
             // Limit to 4 players total (1 host + 3 clients)
             if (prev.players.length >= 4) {
                 conn.send({ type: 'ERROR', message: 'Game Full' });
                 setTimeout(() => conn.close(), 500);
                 return prev;
             }
             
             // Check if already connected (dedupe)
             if (prev.players.find(p => p.id === conn.peer)) return prev;

             const newPlayerName = `Player ${prev.players.length + 1}`;
             const newPlayer = { id: conn.peer, name: newPlayerName };
             
             // Add connection to map
             hostConnectionsRef.current.set(conn.peer, conn);

             // Listen for data from this client
             conn.on('data', (data: any) => {
                if (data.type === 'CLIENT_SUBMIT') {
                    handleWordSubmission(data.word, data.playerId);
                }
             });
             
             conn.on('close', () => {
                 // Handle disconnect? For now, simplistic approach
                 hostConnectionsRef.current.delete(conn.peer);
             });

             // Initialize host player if empty (first time)
             let currentPlayers = [...prev.players];
             if (currentPlayers.length === 0) {
                 currentPlayers.push({ id: myId, name: "Host (You)" });
             }

             const nextPlayers = [...currentPlayers, newPlayer];
             const nextScores = { ...prev.scores, [newPlayer.id]: 0, [myId]: 0 }; // Ensure host score init

             // Broadcast new state immediately
             const newState = { 
                 ...prev, 
                 players: nextPlayers,
                 scores: nextScores
             };
             
             broadcastState(newState);
             return newState;
         });
    };

    const broadcastState = (state: GameState) => {
        hostConnectionsRef.current.forEach(conn => {
            if (conn.open) {
                conn.send({ type: 'STATE_UPDATE', state: state });
            }
        });
    };

    // --- Host Logic ---
    
    // Timer Loop (Host Only)
    useEffect(() => {
        if (role !== 'host' || status !== 'playing' || gameState.status !== 'playing') return;

        const timer = setInterval(() => {
            setGameState(prev => {
                if (prev.timeLeft <= 0) {
                    // Time is up!
                    return handleTurnTimeout(prev);
                }
                const newState = { ...prev, timeLeft: prev.timeLeft - 1 };
                broadcastState(newState); // Sync timer
                return newState;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [role, status, gameState.status]);

    const handleTurnTimeout = (prevState: GameState): GameState => {
        // Switch turn if timeout
        return switchTurn(prevState, false); // false = not correct (timed out)
    };

    const switchTurn = (prev: GameState, success: boolean): GameState => {
        let nextState = { ...prev };
        const playerCount = prev.players.length;
        
        if (success) {
             // Correct answer logic
             const points = prev.phase === 'main' ? 10 : 5; // Half points for steal
             const activePlayer = prev.players[prev.activePlayerIndex];
             const winnerId = prev.phase === 'main' ? activePlayer.id : prev.players[(prev.activePlayerIndex + 1) % playerCount].id;
             
             nextState.scores = {
                 ...prev.scores,
                 [winnerId]: (prev.scores[winnerId] || 0) + points
             };
             
             // Move to next word
             nextState.currentWordIndex += 1;
             nextState.phase = 'main';
             nextState.timeLeft = 30;
             
             // Rotate active player for next word
             // The prompt implies a turn-based system. Usually, if P1 finishes (win/loss), P2 starts next.
             // If P2 stole from P1, P2 just acted. Does P2 start next word? Or P3?
             // Simplest: "Immediate player" logic suggests rotation. 
             // Logic: Active Player rotates + 1 regardless of who stole.
             nextState.activePlayerIndex = (prev.activePlayerIndex + 1) % playerCount;

             if (nextState.currentWordIndex >= nextState.words.length) {
                 nextState.status = 'gameover';
             } else {
                 speak(nextState.words[nextState.currentWordIndex].word);
             }

        } else {
            // Failure logic (Timeout or Wrong Answer)
            if (prev.phase === 'main') {
                // Activate Steal Phase
                nextState.phase = 'steal';
                // Steal turn is the NEXT player
                // activePlayerIndex stays the same, but UI shows "Steal Mode" for next player
                nextState.timeLeft = 30; 
            } else {
                // Steal failed too, move to next word
                nextState.currentWordIndex += 1;
                nextState.phase = 'main';
                nextState.timeLeft = 30;
                
                // Rotate active player
                nextState.activePlayerIndex = (prev.activePlayerIndex + 1) % playerCount;
                
                if (nextState.currentWordIndex >= nextState.words.length) {
                    nextState.status = 'gameover';
                } else {
                    speak(nextState.words[nextState.currentWordIndex].word);
                }
            }
        }
        
        broadcastState(nextState);
        return nextState;
    };

    const handleWordSubmission = (submittedWord: string, submitterId: string) => {
        setGameState(prev => {
             // Validate turn
             const playerCount = prev.players.length;
             const activeIdx = prev.activePlayerIndex;
             const stealIdx = (activeIdx + 1) % playerCount;

             let isTurn = false;
             if (prev.phase === 'main' && prev.players[activeIdx].id === submitterId) isTurn = true;
             if (prev.phase === 'steal' && prev.players[stealIdx].id === submitterId) isTurn = true;

             if (!isTurn) return prev; // Ignore invalid submissions

             const targetWord = prev.words[prev.currentWordIndex].word;
             const isCorrect = submittedWord.toUpperCase().trim() === targetWord;
             
             if (isCorrect) {
                 SoundManager.playWin();
             } else {
                 SoundManager.playError();
             }

             return switchTurn(prev, isCorrect);
        });
        
        // Reset local input if host
        if (submitterId === peerId) {
            setInput('');
            setShowDef(false);
        }
    };

    const startGameHost = () => {
        // Generate words from Medium AND Hard
        const poolMedium = LOCAL_DICTIONARY['Medium'];
        const poolHard = LOCAL_DICTIONARY['Hard'];
        const combinedPool = [...poolMedium, ...poolHard];
        
        const selected = [];
        for (let i = 0; i < 10; i++) {
            selected.push(combinedPool[Math.floor(Math.random() * combinedPool.length)]);
        }
        
        // Ensure Host is in players list properly
        const currentPlayers = [...gameState.players];
        if (currentPlayers.length === 0 || currentPlayers[0].id !== peerId) {
             // Should be there, but safeguard
             if (!currentPlayers.find(p => p.id === peerId)) {
                 currentPlayers.unshift({ id: peerId, name: "Host (You)" });
             }
        }

        // Initialize scores
        const initScores: Record<string, number> = {};
        currentPlayers.forEach(p => initScores[p.id] = 0);

        const initialState: GameState = {
            players: currentPlayers,
            words: selected,
            currentWordIndex: 0,
            activePlayerIndex: 0,
            phase: 'main',
            timeLeft: 30,
            scores: initScores,
            status: 'playing'
        };
        
        setGameState(initialState);
        setStatus('playing');
        broadcastState(initialState);
        speak(selected[0].word);
    };

    // --- Client Logic ---
    const handleJoin = () => {
        if (!joinInput) return;
        const conn = peerRef.current.connect(joinInput.toUpperCase());
        
        conn.on('open', () => {
            setConnection(conn);
            setRole('client');
            setStatus('playing'); // Switch to game view, await state
            
            conn.on('data', (data: any) => {
                if (data.type === 'STATE_UPDATE') {
                    setGameState(data.state);
                }
                if (data.type === 'ERROR') {
                    setMessage(data.message);
                    setTimeout(() => setStatus('lobby'), 2000);
                }
            });
        });
        
        conn.on('error', () => {
             setMessage("Could not connect.");
        });
    };

    const submitWordClient = () => {
        if (connection) {
            connection.send({ type: 'CLIENT_SUBMIT', word: input, playerId: peerId });
            setInput('');
            setShowDef(false);
        }
    };
    
    // --- Render Logic ---
    
    // 1. Lobby
    if (status === 'lobby') {
        return (
            <div className="lobby-card">
                <h3>Multiplayer Spelling Bee</h3>
                <p>Connect with up to 4 players!</p>
                {peerId ? (
                    <div style={{display:'flex', gap: 10, justifyContent: 'center'}}>
                        <button className="btn btn-primary" onClick={() => {
                            setRole('host');
                            setStatus('hosting');
                            // Initialize host in players list immediately
                            setGameState(prev => ({
                                ...prev, 
                                players: [{ id: peerId, name: "Host (You)" }],
                                scores: { [peerId]: 0 }
                            }));
                        }}>Host Game</button>
                        <button className="btn btn-secondary" onClick={() => setStatus('joining')}>Join Game</button>
                    </div>
                ) : (
                    <div className="loader"></div>
                )}
            </div>
        );
    }
    
    // 2. Hosting Lobby
    if (status === 'hosting') {
         return (
            <div className="lobby-card">
                <h3>Hosting Game</h3>
                <p>Share code: <span className="lobby-code" style={{fontSize: '2rem'}}>{peerId}</span></p>
                
                <div className="player-list">
                    {gameState.players.map((p, i) => (
                        <div key={p.id} className="player-row">
                            <span>{p.name}</span>
                            {p.id === peerId && <span style={{fontSize: '0.8rem', opacity: 0.7}}>HOST</span>}
                        </div>
                    ))}
                    {gameState.players.length < 2 && <div className="loader" style={{margin: '10px auto', width: 20, height: 20}}></div>}
                </div>
                
                {gameState.players.length >= 2 ? (
                     <button className="btn btn-primary" onClick={startGameHost}>Start Match ({gameState.players.length}/4)</button>
                ) : (
                     <p>Waiting for at least 1 more player...</p>
                )}
                
                <button className="btn btn-secondary" style={{marginTop: 10}} onClick={() => setStatus('lobby')}>Back</button>
            </div>
         );
    }

    // 3. Joining Lobby
    if (status === 'joining') {
         return (
            <div className="lobby-card">
                <h3>Join Game</h3>
                <input className="lobby-input" placeholder="ENTER CODE" value={joinInput} onChange={e => setJoinInput(e.target.value)} />
                <button className="btn btn-primary" style={{marginTop: 15}} onClick={handleJoin}>Connect</button>
                <div className="message">{message}</div>
                <button className="btn btn-secondary" style={{marginTop: 10}} onClick={() => setStatus('lobby')}>Back</button>
            </div>
        );
    }

    // 4. Playing Game
    if (status === 'playing') {
        
        if (gameState.status === 'gameover') {
             // Find winner
             const sortedPlayers = [...gameState.players].sort((a, b) => (gameState.scores[b.id] || 0) - (gameState.scores[a.id] || 0));
             
             return (
                <div className="spelling-container">
                    <h2>Game Over!</h2>
                    <div className="player-list">
                        {sortedPlayers.map((p, index) => (
                            <div key={p.id} className={`player-row ${index === 0 ? 'active' : ''}`}>
                                <span>{index + 1}. {p.name}</span>
                                <span>{gameState.scores[p.id] || 0} pts</span>
                            </div>
                        ))}
                    </div>
                    
                    <h3>{sortedPlayers[0].id === peerId ? "🏆 YOU WON!" : "Better luck next time!"}</h3>
                    
                    <button className="btn btn-primary" onClick={() => window.location.reload()}>Exit</button>
                </div>
            );
        }
        
        if (gameState.status === 'waiting') {
             return (
                 <div className="lobby-card">
                     <h3>Connected!</h3>
                     <p>Waiting for host to start...</p>
                     <div className="player-list">
                        {gameState.players.map(p => (
                            <div key={p.id} className="player-row">{p.name}</div>
                        ))}
                     </div>
                     <div className="loader"></div>
                 </div>
             );
        }

        const activePlayer = gameState.players[gameState.activePlayerIndex];
        const stealIdx = (gameState.activePlayerIndex + 1) % gameState.players.length;
        const stealPlayer = gameState.players[stealIdx];
        
        const isMyTurn = (gameState.phase === 'main' && activePlayer.id === peerId) || 
                         (gameState.phase === 'steal' && stealPlayer.id === peerId);
                         
        const turnName = gameState.phase === 'main' ? activePlayer.name : `${stealPlayer.name} (STEAL)`;
        const currentWord = gameState.words[gameState.currentWordIndex];
        
        return (
            <div className="spelling-container" style={{ border: isMyTurn ? '4px solid var(--accent)' : '4px solid transparent' }}>
                {/* Scoreboard */}
                <div className="player-list" style={{display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center'}}>
                    {gameState.players.map(p => (
                        <div key={p.id} 
                             className={`player-badge`}
                             style={{
                                 background: p.id === activePlayer.id ? 'var(--accent)' : (gameState.phase === 'steal' && p.id === stealPlayer.id ? '#e57373' : 'var(--wood-color)'),
                                 color: p.id === activePlayer.id ? '#3e2700' : 'white',
                                 opacity: (gameState.phase === 'main' && p.id !== activePlayer.id) || (gameState.phase === 'steal' && p.id !== stealPlayer.id) ? 0.6 : 1
                             }}
                        >
                            {p.name}: {gameState.scores[p.id] || 0}
                        </div>
                    ))}
                </div>

                {/* Timer & Turn Indicator */}
                <div style={{
                    fontSize: '2rem', 
                    fontWeight: 'bold', 
                    color: gameState.timeLeft < 10 ? 'red' : '#333',
                    marginBottom: 10
                }}>
                    ⏱ {gameState.timeLeft}s
                </div>
                
                <div style={{
                    padding: '5px 15px', 
                    background: isMyTurn ? 'var(--accent)' : '#eee',
                    color: isMyTurn ? '#3e2700' : '#888',
                    borderRadius: 20,
                    fontWeight: 'bold',
                    marginBottom: 20
                }}>
                    {isMyTurn ? "YOUR TURN" : `${turnName}'S TURN`} 
                </div>

                <div className="word-image-container">
                     {currentWord ? (
                        <img src={getPollinationsImage(currentWord.word)} alt="Hint" className="word-image" />
                     ) : (
                         <div className="loader"></div>
                     )}
                </div>
                
                <div className="audio-btn-large" onClick={() => speak(currentWord?.word || '')} title="Play Word">
                     <span className="audio-icon">🔊</span>
                </div>

                {/* Input Area */}
                <input 
                    className="spelling-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={isMyTurn ? "SPELL IT" : "WAITING..."}
                    disabled={!isMyTurn}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && isMyTurn) {
                            role === 'host' ? handleWordSubmission(input, peerId) : submitWordClient();
                        }
                    }}
                />
                
                {showDef && <div className="hint-text" style={{marginBottom: 20}}>{currentWord?.definition}</div>}

                <div className="controls">
                    <button 
                        className="btn btn-primary" 
                        onClick={() => role === 'host' ? handleWordSubmission(input, peerId) : submitWordClient()}
                        disabled={!isMyTurn}
                    >
                        Submit
                    </button>
                    <button className="btn btn-hint" onClick={() => setShowDef(true)} disabled={showDef}>Definition</button>
                </div>
                
                <div style={{marginTop: 20, fontSize: '0.8rem', opacity: 0.6}}>
                    Word {gameState.currentWordIndex + 1} / {gameState.words.length}
                </div>
            </div>
        );
    }
    
    return <div>Loading...</div>;
};