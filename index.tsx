import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- Configuration & Constants ---

const SCRABBLE_SCORES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
};

type Difficulty = 'Easy' | 'Medium' | 'Hard';
type GameMode = 'scrabble' | 'spelling';

// Fallback Dictionary for Offline/Error Mode (Scrabble)
interface WordEntry {
  word: string;
  definition: string;
}

const LOCAL_DICTIONARY: Record<Difficulty, WordEntry[]> = {
  Easy: [
    { word: "APPLE", definition: "A round fruit with red or green skin and a whitish inside." },
    { word: "BREAD", definition: "Food made of flour, water, and yeast." },
    { word: "CHAIR", definition: "A separate seat for one person, typically with a back and four legs." },
    { word: "DANCE", definition: "Move rhythmically to music." },
    { word: "HAPPY", definition: "Feeling or showing pleasure or contentment." }
  ],
  Medium: [
    { word: "BRIDGE", definition: "A structure carrying a road across a river." },
    { word: "CANYON", definition: "A deep gorge, typically one with a river flowing through it." },
    { word: "GALAXY", definition: "A system of millions or billions of stars." },
    { word: "HARBOR", definition: "A place on the coast where vessels may find shelter." },
    { word: "MAGNET", definition: "A material that exhibits properties of magnetism." }
  ],
  Hard: [
    { word: "ECLIPSE", definition: "An obscuring of the light from one celestial body by another." },
    { word: "GLACIER", definition: "A slowly moving mass of ice formed by the accumulation of snow." },
    { word: "LABYRINTH", definition: "A complicated irregular network of passages; a maze." },
    { word: "PHOENIX", definition: "A mythical bird that regenerates from its own ashes." },
    { word: "SYMPHONY", definition: "An elaborate musical composition for full orchestra." }
  ]
};

// Fallback Dictionary for Offline/Error Mode (Spelling)
interface SpellingWordData {
    word: string;
    definition: string;
    sentence: string;
    phonetic: string;
}

const SPELLING_LOCAL_DICTIONARY: Record<Difficulty, SpellingWordData[]> = {
    Easy: [
        { word: "TIGER", phonetic: "/ˈtaɪɡər/", definition: "A very large solitary cat with a yellow-brown coat striped with black.", sentence: "The ____ roared loudly in the zoo." },
        { word: "RIVER", phonetic: "/ˈrɪvər/", definition: "A large natural stream of water flowing in a channel to the sea.", sentence: "We went fishing in the ____." },
        { word: "CLOUD", phonetic: "/klaʊd/", definition: "A visible mass of condensed water vapor floating in the atmosphere.", sentence: "The sun was hidden behind a dark ____." },
        { word: "PIZZA", phonetic: "/ˈpiːtsə/", definition: "A dish of Italian origin consisting of a flat, round base of dough.", sentence: "We ordered a pepperoni ____ for dinner." },
        { word: "MUSIC", phonetic: "/ˈmjuːzɪk/", definition: "Vocal or instrumental sounds (or both) combined in such a way as to produce beauty of form.", sentence: "She loves listening to classical ____." },
        { word: "WATER", phonetic: "/ˈwɔːtər/", definition: "A colorless, transparent, odorless liquid that forms the seas, lakes, rivers, and rain.", sentence: "He drank a glass of cold ____." },
        { word: "HOUSE", phonetic: "/haʊs/", definition: "A building for human habitation.", sentence: "They live in a big white ____ on the corner." },
        { word: "SMILE", phonetic: "/smaɪl/", definition: "A pleased, kind, or amused facial expression.", sentence: "She greeted us with a warm ____." }
    ],
    Medium: [
        { word: "JOURNEY", phonetic: "/ˈdʒɜːrni/", definition: "An act of traveling from one place to another.", sentence: "The ____ to the mountain top took three days." },
        { word: "MYSTERY", phonetic: "/ˈmɪstəri/", definition: "Something that is difficult or impossible to understand or explain.", sentence: "The disappearance of the cookies remains a ____." },
        { word: "ISLAND", phonetic: "/ˈaɪlənd/", definition: "A piece of land surrounded by water.", sentence: "They took a boat to the tropical ____." },
        { word: "RHYTHM", phonetic: "/ˈrɪðəm/", definition: "A strong, regular, repeated pattern of movement or sound.", sentence: "The dancer moved to the ____ of the drums." },
        { word: "VACUUM", phonetic: "/ˈvækjuːm/", definition: "A space entirely devoid of matter.", sentence: "Space is essentially a ____." },
        { word: "GUITAR", phonetic: "/ɡɪˈtɑːr/", definition: "A stringed musical instrument played by plucking or strumming.", sentence: "He played a song on his acoustic ____." },
        { word: "CAMERA", phonetic: "/ˈkæmrə/", definition: "A device for recording visual images in the form of photographs, film, or video signals.", sentence: "She took a picture with her new ____." },
        { word: "FOREST", phonetic: "/ˈfɔːrɪst/", definition: "A large area covered chiefly with trees and undergrowth.", sentence: "Bears live deep in the ____." }
    ],
    Hard: [
        { word: "PHARAOH", phonetic: "/ˈfeəroʊ/", definition: "A ruler in ancient Egypt.", sentence: "The ____ ordered the construction of a pyramid." },
        { word: "CONSCIENCE", phonetic: "/ˈkɒnʃəns/", definition: "An inner feeling or voice viewed as acting as a guide to the rightness or wrongness of one's behavior.", sentence: "His ____ wouldn't let him lie." },
        { word: "QUARANTINE", phonetic: "/ˈkwɔːrəntiːn/", definition: "A state, period, or place of isolation in which people or animals that have arrived from elsewhere or been exposed to infectious or contagious disease are placed.", sentence: "The astronauts were put in ____ after returning to Earth." },
        { word: "HIEROGLYPH", phonetic: "/ˈhaɪərəɡlɪf/", definition: "A stylized picture of an object representing a word, syllable, or sound, as found in ancient Egyptian writing.", sentence: "The archaeologist deciphered the ancient ____." },
        { word: "CHRYSANTHEMUM", phonetic: "/krɪˈsænθəməm/", definition: "A popular plant of the daisy family, having brightly colored ornamental flowers.", sentence: "She planted a yellow ____ in the garden." },
        { word: "SOLILOQUY", phonetic: "/səˈlɪləkwi/", definition: "An act of speaking one's thoughts aloud when by oneself or regardless of any hearers.", sentence: "Hamlet's famous ____ begins with 'To be, or not to be'." },
        { word: "LIEUTENANT", phonetic: "/lɛfˈtɛnənt/", definition: "A deputy or substitute acting for a superior.", sentence: "The ____ took command when the captain fell ill." }
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
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: var(--wood-color);
    border: 4px solid #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 6px 12px rgba(0,0,0,0.3);
    margin-bottom: 10px;
    transition: transform 0.1s, background 0.2s;
  }

  .audio-btn-large:active {
    transform: scale(0.95);
  }
  
  .audio-btn-large:hover {
    background: var(--wood-dark);
  }

  .audio-icon {
    font-size: 3rem;
    color: white;
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
    background: rgba(255,255,255,0.2);
    color: white;
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
    setState(prev => ({ ...prev, status: 'loading', message: '', placedTiles: [], rackTiles: [], word: '', definition: '' }));
    
    // Attempt Gemini API first
    if (process.env.API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const model = difficulty === 'Hard' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';
        
        // Use full lexicon prompt for "5 million words" feel
        const prompt = `
          Pick a single random English word and its definition.
          Source Material: The entire English lexicon (approx 5 million words). 
          Instructions:
          - Access the full breadth of the English language.
          - Do not limit yourself to common words unless difficulty is Easy.
          - Ensure extreme variety. Avoid repeating common words.
          
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
                seenWords: [...prev.seenWords, word]
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
      seenWords: [...prev.seenWords, word]
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

const SpellingGame = ({ difficulty, onScoreUpdate }: { difficulty: Difficulty, onScoreUpdate: (points: number) => void }) => {
    const [state, setState] = useState<SpellingState>({
        data: null,
        input: '',
        status: 'loading',
        message: '',
        showDefinition: false,
        showSentence: false
    });
    
    const inputRef = useRef<HTMLInputElement>(null);

    // Preload voices to ensure they are available
    useEffect(() => {
        const loadVoices = () => { window.speechSynthesis.getVoices(); };
        loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
             window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);
    
    const speak = (text: string, rate = 0.8) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Force get voices (sometimes helps with lazy loading in browsers)
        const voices = window.speechSynthesis.getVoices();
        
        // Priority: African accents (South Africa 'en-ZA' or Nigeria 'en-NG')
        const africanVoice = voices.find(v => v.lang === 'en-ZA' || v.lang === 'en-NG');

        // Fallback: Generic Male Voices
        const maleVoice = voices.find(v => v.name.includes("Google UK English Male")) 
                       || voices.find(v => v.name.includes("Daniel")) 
                       || voices.find(v => v.name.toLowerCase().includes("male") && v.lang.startsWith("en"));

        if (africanVoice) {
            utterance.voice = africanVoice;
            utterance.pitch = 0.5; // Deep, serious tone for 'Wakandan' feel
            utterance.rate = rate * 0.9; // Measured, deliberate pace
        } else if (maleVoice) {
            utterance.voice = maleVoice;
            utterance.pitch = 0.6; // Deep pitch for 'dark' male voice fallback
            utterance.rate = rate;
        }

        utterance.lang = 'en-US'; // Default if voice specific lang fails, though voice obj usually overrides
        
        window.speechSynthesis.speak(utterance);
    };

    const fetchWord = useCallback(async () => {
        setState(s => ({ 
            ...s, 
            status: 'loading', 
            message: '', 
            data: null, 
            input: '', 
            showDefinition: false, 
            showSentence: false 
        }));

        // Try API first if Key is available
        if (process.env.API_KEY) {
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const model = 'gemini-2.5-flash';
                
                const prompt = `
                    Generate a random English word for a spelling bee.
                    Source: Access the complete English language corpus (approx 5 million words).
                    
                    Difficulty: ${difficulty}.
                    ${difficulty === 'Easy' ? 'Common words, clear pronunciation, 4-6 letters.' : ''}
                    ${difficulty === 'Medium' ? 'Less common words, 6-9 letters. Avoid overly simple words.' : ''}
                    ${difficulty === 'Hard' ? 'Complex, obscure, scientific, or literary words. 8+ letters. Tap into the full depth of the dictionary.' : ''}
                    
                    Return JSON format:
                    {
                        "word": "STRING",
                        "phonetic": "STRING (IPA format, e.g. /kæt/)",
                        "definition": "STRING",
                        "sentence": "A sentence containing the word, but replace the word itself with '________'."
                    }
                `;

                const response = await ai.models.generateContent({
                    model,
                    contents: prompt,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                word: { type: Type.STRING },
                                phonetic: { type: Type.STRING },
                                definition: { type: Type.STRING },
                                sentence: { type: Type.STRING }
                            },
                            required: ['word', 'phonetic', 'definition', 'sentence']
                        }
                    }
                });
                
                const data = JSON.parse(response.text);
                
                setState(s => ({
                    ...s,
                    data: {
                        word: data.word.trim().toUpperCase(),
                        phonetic: data.phonetic || '',
                        definition: data.definition,
                        sentence: data.sentence
                    },
                    status: 'playing',
                }));
                
                setTimeout(() => {
                    if (data.word) speak(data.word.trim());
                }, 800);
                
                return; // Exit if successful

            } catch (e) {
                console.warn("API failed or not available, switching to offline mode.", e);
            }
        }

        // Fallback: Offline Mode
        await new Promise(r => setTimeout(r, 600)); // Simulate loading for better UX
        const pool = SPELLING_LOCAL_DICTIONARY[difficulty];
        const randomItem = pool[Math.floor(Math.random() * pool.length)];

        setState(s => ({
            ...s,
            data: randomItem,
            status: 'playing'
        }));
        
        setTimeout(() => {
            speak(randomItem.word);
        }, 800);

    }, [difficulty]);

    useEffect(() => {
        fetchWord();
    }, [fetchWord]);

    const handlePlayWord = () => {
        if (!state.data) return;
        speak(state.data.word);
        inputRef.current?.focus();
    };

    const handlePlaySentence = () => {
        if (!state.data) return;
        setState(s => ({...s, showSentence: true}));
        speak(state.data.sentence, 0.9);
    };

    const handleSubmit = () => {
        if (!state.data) return;
        
        const cleanInput = state.input.trim().toUpperCase();
        if (cleanInput === state.data.word) {
            SoundManager.playWin();
            const score = Math.max(10, state.data.word.length * 2 - (state.showDefinition ? 5 : 0));
            onScoreUpdate(score);
            setState(s => ({ ...s, status: 'won', message: `Correct! +${score} pts` }));
        } else {
            SoundManager.playError();
            // Trigger visual shake
            const container = document.querySelector('.spelling-container');
            container?.classList.add('error');
            setTimeout(() => container?.classList.remove('error'), 500);
            
            setState(s => ({ ...s, message: 'Try again!' }));
            setTimeout(() => setState(s => ({ ...s, message: '' })), 2000);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSubmit();
    };
    
    const handleShowDefinition = () => {
        if (state.showDefinition) return;
        onScoreUpdate(-5);
        setState(s => ({...s, showDefinition: true, message: 'Definition revealed (-5 pts)'}));
        setTimeout(() => setState(s => ({...s, message: ''})), 2000);
    };

    const handleLetterHint = () => {
        if (!state.data || state.status !== 'playing') return;
        
        const target = state.data.word;
        const current = state.input.toUpperCase();
        
        let idx = 0;
        // Find the first character that doesn't match or the end of the input
        while (idx < current.length && idx < target.length && current[idx] === target[idx]) {
            idx++;
        }

        if (idx >= target.length) return; // Word is already fully correct or longer

        const chars = current.split('');
        chars[idx] = target[idx];
        const newInput = chars.join('');

        onScoreUpdate(-3);
        setState(s => ({
            ...s,
            input: newInput,
            message: 'Letter Hint (-3 pts)'
        }));
        setTimeout(() => setState(s => ({...s, message: ''})), 1500);
        inputRef.current?.focus();
    };

    if (state.status === 'loading') return <div className="loader"></div>;
    if (state.status === 'error') return (
        <div className="api-warning">
            {state.message} <br/>
            <button className="btn btn-secondary" style={{marginTop: 10}} onClick={fetchWord}>Retry</button>
        </div>
    );

    return (
        <div className={`spelling-container ${state.status === 'won' ? 'won' : ''}`}>
            
            {state.status === 'won' ? (
                <div className="word-reveal">
                    {state.data?.word}
                </div>
            ) : (
                <>
                  <div className="audio-btn-large" onClick={handlePlayWord} title="Play Word">
                       <span className="audio-icon">🔊</span>
                  </div>
                  {state.data?.phonetic && (
                      <div className="phonetic-display">
                          {state.data.phonetic}
                      </div>
                  )}
                </>
            )}
            
            {state.status !== 'won' && (
                <input 
                    ref={inputRef}
                    className="spelling-input"
                    type="text" 
                    value={state.input} 
                    onChange={(e) => setState(s => ({...s, input: e.target.value}))}
                    onKeyDown={handleKeyDown}
                    placeholder="TYPE HERE"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                />
            )}

            <div className="hint-section">
                {state.showDefinition && (
                    <div className="hint-text">{state.data?.definition}</div>
                )}
                {state.showSentence && !state.showDefinition && (
                     <div className="hint-text">"{state.data?.sentence}"</div>
                )}
            </div>
            
            <div className="message">{state.message}</div>

            <div className="controls">
                {state.status === 'won' ? (
                     <button className="btn btn-primary" onClick={fetchWord}>Next Word →</button>
                ) : (
                    <>
                     <button className="btn btn-primary" onClick={handleSubmit}>Check Spelling</button>
                     <button className="btn btn-audio-small" onClick={handlePlaySentence}>🗣️ Read Sentence</button>
                     <button className="btn btn-hint" onClick={handleLetterHint}>🔤 Letter (-3)</button>
                     <button className="btn btn-hint" onClick={handleShowDefinition} disabled={state.showDefinition}>📖 Define (-5)</button>
                     <button className="btn btn-secondary" onClick={fetchWord}>Skip</button>
                    </>
                )}
            </div>
        </div>
    );
}

const App = () => {
  const [view, setView] = useState<GameMode>('scrabble');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [totalScore, setTotalScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('lexicon_highscore');
    if (stored) setHighScore(parseInt(stored, 10));
  }, []);

  const updateScore = (points: number) => {
      const newScore = totalScore + points;
      setTotalScore(newScore);
      if (newScore > highScore) {
          setHighScore(newScore);
          localStorage.setItem('lexicon_highscore', newScore.toString());
      }
  };

  const handleDifficultyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDifficulty(e.target.value as Difficulty);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app-container">
        
        <header className="header">
          <div className="header-top">
             <div className="game-title">LEXICON</div>
             <div className="score-container">
                <div className="score-board">Score: {totalScore}</div>
                <div className="high-score">Best: {highScore}</div>
             </div>
          </div>
          
          <div className="level-selector">
             <span>Difficulty:</span>
             <select className="level-select" value={difficulty} onChange={handleDifficultyChange}>
               <option value="Easy">Easy</option>
               <option value="Medium">Medium</option>
               <option value="Hard">Hard</option>
             </select>
          </div>
        </header>

        <div className="nav-tabs">
            <div className={`nav-tab ${view === 'scrabble' ? 'active' : ''}`} onClick={() => setView('scrabble')}>
                Definition Game
            </div>
            <div className={`nav-tab ${view === 'spelling' ? 'active' : ''}`} onClick={() => setView('spelling')}>
                Spelling Bee
            </div>
        </div>

        {view === 'scrabble' ? (
            <ScrabbleGame difficulty={difficulty} onScoreUpdate={updateScore} />
        ) : (
            <SpellingGame difficulty={difficulty} onScoreUpdate={updateScore} />
        )}

      </div>
    </>
  );
};

const root = createRoot(document.getElementById('app')!);
root.render(<App />);