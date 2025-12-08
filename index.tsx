import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- Configuration & Constants ---

const SCRABBLE_SCORES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
};

type Difficulty = 'Easy' | 'Medium' | 'Hard';
type GameMode = 'scrabble' | 'crossword';

// Fallback Dictionary for Offline/Error Mode
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

  /* CROSSWORD MODE STYLES */
  .crossword-grid {
    display: grid;
    gap: 2px;
    background: #000;
    padding: 4px;
    border-radius: 4px;
    margin-bottom: 20px;
    box-shadow: 0 8px 16px rgba(0,0,0,0.3);
  }

  .cw-cell {
    width: 36px;
    height: 36px;
    background: white;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cw-cell.black {
    background: #000;
  }
  
  .cw-cell input {
    width: 100%;
    height: 100%;
    border: none;
    text-align: center;
    font-size: 1.2rem;
    font-weight: bold;
    text-transform: uppercase;
    background: transparent;
    padding: 0;
    color: #000;
    font-family: inherit;
    border-radius: 0;
  }

  .cw-cell input:focus {
    background: #e3f2fd;
    outline: none;
  }

  .cw-cell.correct input {
    background: #c8e6c9;
    color: #1b5e20;
  }

  .cw-cell.incorrect input {
    background: #ffcdd2;
  }

  .cw-clues {
    width: 100%;
    background: rgba(255,255,255,0.95);
    border-radius: 8px;
    padding: 15px;
    box-sizing: border-box;
    color: #333;
    max-height: 250px;
    overflow-y: auto;
  }

  .cw-clue-section-title {
    font-weight: bold;
    font-size: 0.9rem;
    color: var(--wood-dark);
    border-bottom: 2px solid var(--accent);
    margin-bottom: 8px;
    padding-bottom: 2px;
  }

  .cw-clue-item {
    font-size: 0.9rem;
    margin-bottom: 6px;
    line-height: 1.3;
  }

  .cw-clue-item strong {
    color: var(--wood-color);
  }

  .cw-current-clue {
    background: var(--accent);
    color: #3e2700;
    padding: 10px;
    border-radius: 8px;
    margin-bottom: 15px;
    text-align: center;
    font-weight: bold;
    width: 100%;
    box-sizing: border-box;
    box-shadow: 0 4px 6px rgba(0,0,0,0.2);
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

// Crossword Game Types
interface CrosswordData {
  grid: (string | null)[][]; // char or null (block)
  clues: {
    across: Record<string, string>; // number -> text
    down: Record<string, string>;
  };
  numbers: (number | null)[][]; // numbers for cells
}

interface CrosswordState {
  puzzle: CrosswordData | null;
  userGrid: string[][]; // User inputs
  status: 'loading' | 'playing' | 'won' | 'error';
  message: string;
  currentClue: string;
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
        
        // Use Longman Advanced Dictionary style vocabulary
        const prompt = `
          Pick a single random English word and its definition from a vocabulary of 300,000+ words (Longman Advanced Dictionary style).
          Difficulty Level: ${difficulty}.
          ${difficulty === 'Easy' ? 'Word length 4-5 letters. Common words.' : ''}
          ${difficulty === 'Medium' ? 'Word length 6-7 letters. Standard vocabulary.' : ''}
          ${difficulty === 'Hard' ? 'Word length 8-12 letters. Complex, academic, or obscure words.' : ''}
          
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
        console.error("API Error, falling back to local dictionary", e);
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

const CrosswordGame = ({ difficulty, onScoreUpdate }: { difficulty: Difficulty, onScoreUpdate: (points: number) => void }) => {
    const [state, setState] = useState<CrosswordState>({
        puzzle: null,
        userGrid: [],
        status: 'loading',
        message: '',
        currentClue: 'Tap a box to start'
    });

    const gridSize = difficulty === 'Easy' ? 5 : difficulty === 'Medium' ? 7 : 8;
    const inputsRef = useRef<(HTMLInputElement | null)[][]>([]);

    const fetchPuzzle = useCallback(async () => {
        setState(s => ({ ...s, status: 'loading', message: '', puzzle: null }));

        if (!process.env.API_KEY) {
            setState(s => ({ ...s, status: 'error', message: 'API Key required for Crossword Mode' }));
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const model = 'gemini-2.5-flash';
            
            const prompt = `
                Generate a ${gridSize}x${gridSize} crossword puzzle.
                Difficulty: ${difficulty}.
                
                Requirements:
                1. "grid": A list of ${gridSize} strings. Each string represents a row. Use uppercase letters for words and '.' (dot) for black squares.
                2. Ensure words are valid English words.
                3. "across": A list of clues for words reading across. Each item has "number" and "clue".
                4. "down": A list of clues for words reading down. Each item has "number" and "clue".
                5. Numbering must follow standard crossword rules based on the grid layout.
            `;

            const response = await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            grid: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                                description: "The rows of the grid using letters and dots."
                            },
                            across: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        number: { type: Type.INTEGER },
                                        clue: { type: Type.STRING }
                                    }
                                }
                            },
                            down: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        number: { type: Type.INTEGER },
                                        clue: { type: Type.STRING }
                                    }
                                }
                            }
                        },
                        required: ['grid', 'across', 'down']
                    }
                }
            });
            
            const data = JSON.parse(response.text);
            
            // Parse Grid - ensure it is square and robust
            const rawGrid = data.grid || [];
            const parsedGrid: (string|null)[][] = [];

            for (let i = 0; i < gridSize; i++) {
                const rowStr = (rawGrid[i] || "").padEnd(gridSize, ".").substring(0, gridSize).toUpperCase();
                const rowArr = rowStr.split('').map((char: string) => (char === '.' || char === ' ') ? null : char);
                parsedGrid.push(rowArr);
            }
            
            // Generate Numbers Logic (Standard Crossword Numbering)
            const numbers = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));
            let currentNumber = 1;
            
            for(let r=0; r<gridSize; r++) {
                for(let c=0; c<gridSize; c++) {
                    if(parsedGrid[r][c] !== null) {
                        const isAcrossStart = (c === 0 || parsedGrid[r][c-1] === null) && (c+1 < gridSize && parsedGrid[r][c+1] !== null);
                        const isDownStart = (r === 0 || parsedGrid[r-1][c] === null) && (r+1 < gridSize && parsedGrid[r+1][c] !== null);
                        
                        if (isAcrossStart || isDownStart) {
                            numbers[r][c] = currentNumber++;
                        }
                    }
                }
            }

            // Map Clues to Dictionary
            const clues = {
                across: {} as Record<string, string>,
                down: {} as Record<string, string>
            };
            
            if (data.across) data.across.forEach((item: any) => clues.across[item.number] = item.clue);
            if (data.down) data.down.forEach((item: any) => clues.down[item.number] = item.clue);

            const initialUserGrid = parsedGrid.map((row) => row.map(cell => cell === null ? null : ""));

            setState({
                puzzle: { grid: parsedGrid, clues, numbers },
                userGrid: initialUserGrid,
                status: 'playing',
                message: '',
                currentClue: 'Tap a white box to type'
            });

        } catch (e) {
            console.error(e);
            setState(s => ({ ...s, status: 'error', message: 'Failed to generate puzzle. Please try again.' }));
        }

    }, [difficulty, gridSize]);

    useEffect(() => {
        fetchPuzzle();
    }, [fetchPuzzle]);

    const handleInput = (r: number, c: number, val: string) => {
        const char = val.slice(-1).toUpperCase();
        const newUserGrid = [...state.userGrid];
        newUserGrid[r] = [...newUserGrid[r]];
        newUserGrid[r][c] = char;
        
        setState(s => ({ ...s, userGrid: newUserGrid }));

        // Auto-advance focus (simple right-to-left)
        if (char && c < gridSize - 1 && state.puzzle?.grid[r][c+1] !== null) {
            inputsRef.current[r][c+1]?.focus();
        }
    };

    const handleFocus = (r: number, c: number) => {
        if (!state.puzzle) return;
        const num = state.puzzle.numbers[r][c];
        
        // Simple heuristic to show relevant clue
        // If it has a number, show that. If not, look left or up to find the "parent" number.
        let clueText = "";
        
        // Try to find across clue for this cell
        let cPtr = c;
        while(cPtr >= 0 && state.puzzle.grid[r][cPtr] !== null) {
            const n = state.puzzle.numbers[r][cPtr];
            if (n && state.puzzle.clues.across[n]) {
                clueText = `${n} Across: ${state.puzzle.clues.across[n]}`;
                break;
            }
            cPtr--;
        }

        // If no across, or just to vary, try down? 
        // For simplicity in this mini-UI, we prioritize Across, then Down if Across not found.
        if (!clueText) {
             let rPtr = r;
             while(rPtr >= 0 && state.puzzle.grid[rPtr][c] !== null) {
                 const n = state.puzzle.numbers[rPtr][c];
                 if (n && state.puzzle.clues.down[n]) {
                     clueText = `${n} Down: ${state.puzzle.clues.down[n]}`;
                     break;
                 }
                 rPtr--;
             }
        }
        
        if (clueText) setState(s => ({ ...s, currentClue: clueText }));
    };

    const checkPuzzle = () => {
        if (!state.puzzle) return;
        
        let correctCount = 0;
        let totalCount = 0;
        let isComplete = true;

        for(let r=0; r<gridSize; r++) {
            for(let c=0; c<gridSize; c++) {
                if (state.puzzle.grid[r][c] !== null) {
                    totalCount++;
                    if (state.userGrid[r][c] !== state.puzzle.grid[r][c]) {
                        isComplete = false;
                    } else {
                        correctCount++;
                    }
                }
            }
        }

        if (isComplete) {
            SoundManager.playWin();
            onScoreUpdate(50); // Bonus for puzzle
            setState(s => ({ ...s, status: 'won', message: 'Puzzle Solved! +50 pts' }));
        } else {
            SoundManager.playError();
            setState(s => ({ ...s, message: `${correctCount}/${totalCount} letters correct` }));
        }
    };

    if (state.status === 'loading') return <div className="loader"></div>;
    if (state.status === 'error') return (
        <div className="api-warning">
            {state.message} <br/>
            <button className="btn btn-secondary" style={{marginTop: 10}} onClick={fetchPuzzle}>Retry</button>
        </div>
    );

    return (
        <div style={{width: '100%'}}>
            <div className="cw-current-clue">
                {state.currentClue}
            </div>

            <div className="crossword-grid" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
                {state.puzzle?.grid.map((row, r) => 
                    row.map((cell, c) => {
                        const isBlack = cell === null;
                        const num = state.puzzle?.numbers[r][c];
                        const isCorrect = state.status === 'won' || (state.userGrid[r][c] && state.userGrid[r][c] === cell); 
                        
                        const finalClass = state.status === 'won' ? 'correct' : '';
                        
                        return (
                            <div key={`${r}-${c}`} className={`cw-cell ${isBlack ? 'black' : ''} ${finalClass}`}>
                                {!isBlack && (
                                    <>
                                        {num && <span style={{position:'absolute', top:1, left:1, fontSize: '0.6rem', color:'#666'}}>{num}</span>}
                                        <input
                                            ref={el => {
                                                if (!inputsRef.current[r]) inputsRef.current[r] = [];
                                                inputsRef.current[r][c] = el;
                                            }}
                                            type="text"
                                            maxLength={1}
                                            value={state.userGrid[r][c]}
                                            onChange={(e) => handleInput(r, c, e.target.value)}
                                            onFocus={() => handleFocus(r,c)}
                                            disabled={state.status === 'won'}
                                        />
                                    </>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            <div className="cw-clues">
                <div className="cw-clue-section-title">ACROSS</div>
                {state.puzzle && Object.entries(state.puzzle.clues.across).map(([num, text]) => (
                    <div key={`a-${num}`} className="cw-clue-item"><strong>{num}.</strong> {text}</div>
                ))}
                <div className="cw-clue-section-title" style={{marginTop: 15}}>DOWN</div>
                {state.puzzle && Object.entries(state.puzzle.clues.down).map(([num, text]) => (
                    <div key={`d-${num}`} className="cw-clue-item"><strong>{num}.</strong> {text}</div>
                ))}
            </div>

            <div className="controls" style={{marginTop: 20}}>
                {state.status === 'won' ? (
                     <button className="btn btn-primary" onClick={fetchPuzzle}>New Puzzle</button>
                ) : (
                    <>
                     <button className="btn btn-primary" onClick={checkPuzzle}>Check Puzzle</button>
                     <button className="btn btn-secondary" onClick={fetchPuzzle}>Skip</button>
                    </>
                )}
            </div>
            
            <div className="message">{state.message}</div>
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
            <div className={`nav-tab ${view === 'crossword' ? 'active' : ''}`} onClick={() => setView('crossword')}>
                Crossword
            </div>
        </div>

        {view === 'scrabble' ? (
            <ScrabbleGame difficulty={difficulty} onScoreUpdate={updateScore} />
        ) : (
            <CrosswordGame difficulty={difficulty} onScoreUpdate={updateScore} />
        )}

      </div>
    </>
  );
};

const root = createRoot(document.getElementById('app')!);
root.render(<App />);