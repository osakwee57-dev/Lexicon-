import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { Peer, DataConnection } from 'peerjs';
import { Analytics } from '@vercel/analytics/react';

// --- Configuration & Constants ---

const SCRABBLE_SCORES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
};

type Difficulty = 'Easy' | 'Medium' | 'Hard';
type GameMode = 'scrabble' | 'spelling' | 'multiplayer' | 'phonetics';

const LEVEL_CONFIG: Record<Difficulty, { maxLevels: number, wordsPerLevel: number }> = {
    Easy: { maxLevels: 20, wordsPerLevel: 20 },
    Medium: { maxLevels: 50, wordsPerLevel: 20 },
    Hard: { maxLevels: 100, wordsPerLevel: 20 }
};

interface PhoneticEntry {
    symbol: string;
    name: string;
    type: string;
    voiced?: boolean;
    place?: string;
    manner?: string;
    examples: string[];
    description: string;
}

const PHONETICS_DATA: PhoneticEntry[] = [
    // Consonants - Stops
    { symbol: 'p', name: 'p', type: 'Consonant', voiced: false, place: 'Bilabial', manner: 'Stop', examples: ['pen', 'spin', 'tip', 'happy', 'pie'], description: 'Press your lips together to block the airflow completely, then release it with a small puff of air.' },
    { symbol: 'b', name: 'b', type: 'Consonant', voiced: true, place: 'Bilabial', manner: 'Stop', examples: ['but', 'web', 'baby', 'boy', 'lab'], description: 'Press your lips together to block air, then release. Your vocal cords must vibrate.' },
    { symbol: 't', name: 't', type: 'Consonant', voiced: false, place: 'Alveolar', manner: 'Stop', examples: ['two', 'sting', 'bet', 'ten', 'matter'], description: 'Tap the tip of your tongue against the bumpy ridge behind your upper teeth.' },
    { symbol: 'd', name: 'd', type: 'Consonant', voiced: true, place: 'Alveolar', manner: 'Stop', examples: ['do', 'daddy', 'odd', 'dog', 'ladder'], description: 'Tap your tongue tip against the ridge behind your upper teeth while vibrating your vocal cords.' },
    { symbol: 'k', name: 'k', type: 'Consonant', voiced: false, place: 'Velar', manner: 'Stop', examples: ['cat', 'kill', 'skin', 'queen', 'thick'], description: 'Raise the back of your tongue to touch the soft part of your roof (soft palate) to block air.' },
    { symbol: 'g', name: 'g', type: 'Consonant', voiced: true, place: 'Velar', manner: 'Stop', examples: ['go', 'get', 'beg', 'green', 'egg'], description: 'Raise the back of your tongue to the soft palate while vibrating your vocal cords.' },
    // Consonants - Fricatives
    { symbol: 'f', name: 'f', type: 'Consonant', voiced: false, place: 'Labiodental', manner: 'Fricative', examples: ['fool', 'enough', 'leaf', 'off', 'photo'], description: 'Lightly rest your upper teeth on your bottom lip and blow air through.' },
    { symbol: 'v', name: 'v', type: 'Consonant', voiced: true, place: 'Labiodental', manner: 'Fricative', examples: ['voice', 'have', 'of', 'vase', 'never'], description: 'Rest upper teeth on bottom lip and blow air while vibrating vocal cords.' },
    { symbol: 'θ', name: 'theta', type: 'Consonant', voiced: false, place: 'Dental', manner: 'Fricative', examples: ['thing', 'teeth', 'with', 'thought', 'breath'], description: 'Place your tongue tip slightly between your upper and lower teeth and blow air.' },
    { symbol: 'ð', name: 'eth', type: 'Consonant', voiced: true, place: 'Dental', manner: 'Fricative', examples: ['this', 'breathe', 'father', 'they', 'smooth'], description: 'Place tongue between teeth and blow air while adding voice.' },
    { symbol: 's', name: 's', type: 'Consonant', voiced: false, place: 'Alveolar', manner: 'Fricative', examples: ['see', 'city', 'pass', 'lesson', 'sun'], description: 'Place tongue tip close to the upper ridge without touching, forcing air through the narrow gap.' },
    { symbol: 'z', name: 'z', type: 'Consonant', voiced: true, place: 'Alveolar', manner: 'Fricative', examples: ['zoo', 'rose', 'buzz', 'zip', 'easy'], description: 'Same position as /s/, but using your voice to create a buzzing sound.' },
    { symbol: 'ʃ', name: 'esh', type: 'Consonant', voiced: false, place: 'Post-alveolar', manner: 'Fricative', examples: ['she', 'sure', 'emotion', 'leash', 'ocean'], description: 'Pull tongue slightly back and round your lips, blowing air like you are shushing someone.' },
    { symbol: 'ʒ', name: 'yogh', type: 'Consonant', voiced: true, place: 'Post-alveolar', manner: 'Fricative', examples: ['pleasure', 'beige', 'vision', 'measure', 'genre'], description: 'Same position as /ʃ/ but with vocal cord vibration.' },
    { symbol: 'h', name: 'h', type: 'Consonant', voiced: false, place: 'Glottal', manner: 'Fricative', examples: ['ham', 'who', 'ahead', 'hi', 'house'], description: 'Open your mouth and exhale sharply from your throat.' },
    // Consonants - Affricates
    { symbol: 'tʃ', name: 'ch', type: 'Consonant', voiced: false, place: 'Post-alveolar', manner: 'Affricate', examples: ['chair', 'nature', 'teach', 'choose', 'watch'], description: 'Start with /t/ (tongue on ridge) and release instantly into /ʃ/.' },
    { symbol: 'dʒ', name: 'j', type: 'Consonant', voiced: true, place: 'Post-alveolar', manner: 'Affricate', examples: ['gin', 'joy', 'edge', 'judge', 'age'], description: 'Start with /d/ and release instantly into /ʒ/.' },
    // Consonants - Nasals
    { symbol: 'm', name: 'm', type: 'Consonant', voiced: true, place: 'Bilabial', manner: 'Nasal', examples: ['man', 'ham', 'more', 'summer', 'room'], description: 'Close your lips and let the sound resonate through your nose.' },
    { symbol: 'n', name: 'n', type: 'Consonant', voiced: true, place: 'Alveolar', manner: 'Nasal', examples: ['no', 'tin', 'know', 'funny', 'sun'], description: 'Touch tongue to the upper ridge and let sound flow through your nose.' },
    { symbol: 'ŋ', name: 'eng', type: 'Consonant', voiced: true, place: 'Velar', manner: 'Nasal', examples: ['sing', 'ring', 'finger', 'anger', 'thanks'], description: 'Raise back of tongue to soft palate and let sound resonate in your nose.' },
    // Consonants - Approximants
    { symbol: 'l', name: 'l', type: 'Consonant', voiced: true, place: 'Alveolar', manner: 'Lateral Approximant', examples: ['left', 'bell', 'table', 'like', 'feel'], description: 'Place tongue tip on the upper ridge and let air flow around the sides of the tongue.' },
    { symbol: 'r', name: 'r', type: 'Consonant', voiced: true, place: 'Alveolar', manner: 'Approximant', examples: ['run', 'very', 'bird', 'red', 'car'], description: 'Curl the tip of your tongue back slightly without touching the roof of the mouth.' },
    { symbol: 'w', name: 'w', type: 'Consonant', voiced: true, place: 'Velar', manner: 'Approximant', examples: ['we', 'queen', 'water', 'why', 'quick'], description: 'Round your lips tightly and raise the back of your tongue.' },
    { symbol: 'j', name: 'y', type: 'Consonant', voiced: true, place: 'Palatal', manner: 'Approximant', examples: ['yes', 'yellow', 'few', 'view', 'onion'], description: 'Raise the middle of your tongue towards the hard palate, like the start of "yellow".' },
    // Vowels - Monophthongs
    { symbol: 'iː', name: 'fleece', type: 'Vowel', voiced: true, place: 'Front Close', manner: 'Vowel', examples: ['see', 'heat', 'be', 'key', 'people'], description: 'Spread lips in a smile, keep tongue high and front. A long sound.' },
    { symbol: 'ɪ', name: 'kit', type: 'Vowel', voiced: true, place: 'Front Close-mid', manner: 'Vowel', examples: ['hit', 'sitting', 'gym', 'bit', 'in'], description: 'Relax lips slightly compared to /i:/, tongue slightly lower. Short sound.' },
    { symbol: 'e', name: 'dress', type: 'Vowel', voiced: true, place: 'Front Mid', manner: 'Vowel', examples: ['met', 'bed', 'bread', 'said', 'head'], description: 'Drop jaw slightly, tongue in the middle front. Like saying "eh".' },
    { symbol: 'æ', name: 'trap', type: 'Vowel', voiced: true, place: 'Front Open', manner: 'Vowel', examples: ['cat', 'black', 'hand', 'laugh', 'apple'], description: 'Open mouth wide, tongue flat and forward.' },
    { symbol: 'ɑː', name: 'palm', type: 'Vowel', voiced: true, place: 'Back Open', manner: 'Vowel', examples: ['father', 'start', 'hard', 'car', 'part'], description: 'Open mouth wide, tongue low and back.' },
    { symbol: 'ɒ', name: 'lot', type: 'Vowel', voiced: true, place: 'Back Open', manner: 'Vowel', examples: ['hot', 'rock', 'stop', 'want', 'wash'], description: 'Round lips slightly, drop jaw. Short sound.' },
    { symbol: 'ɔː', name: 'thought', type: 'Vowel', voiced: true, place: 'Back Mid', manner: 'Vowel', examples: ['call', 'four', 'saw', 'walk', 'door'], description: 'Round lips more, tongue back. Long sound.' },
    { symbol: 'ʊ', name: 'foot', type: 'Vowel', voiced: true, place: 'Back Close-mid', manner: 'Vowel', examples: ['put', 'could', 'book', 'look', 'good'], description: 'Round lips loosely, back of tongue high. Short sound.' },
    { symbol: 'uː', name: 'goose', type: 'Vowel', voiced: true, place: 'Back Close', manner: 'Vowel', examples: ['blue', 'food', 'too', 'shoe', 'who'], description: 'Round lips tightly into a small circle, tongue high back.' },
    { symbol: 'ʌ', name: 'strut', type: 'Vowel', voiced: true, place: 'Central Open-mid', manner: 'Vowel', examples: ['cup', 'luck', 'love', 'blood', 'up'], description: 'Relax mouth completely, tongue central. A short grunt-like sound.' },
    { symbol: 'ɜː', name: 'nurse', type: 'Vowel', voiced: true, place: 'Central Mid', manner: 'Vowel', examples: ['bird', 'hurt', 'work', 'learn', 'first'], description: 'Neutral mouth position, long sound. Used in "bird".' },
    { symbol: 'ə', name: 'schwa', type: 'Vowel', voiced: true, place: 'Central', manner: 'Vowel', examples: ['about', 'banana', 'the', 'sofa', 'arena'], description: 'The "lazy" sound. Completely relax jaw and tongue. Very short.' },
    // Diphthongs
    { symbol: 'eɪ', name: 'face', type: 'Diphthong', voiced: true, place: 'Moving', manner: 'Vowel', examples: ['say', 'eight', 'rain', 'break', 'day'], description: 'Start at /e/ (dress) and glide to /ɪ/ (kit).' },
    { symbol: 'aɪ', name: 'price', type: 'Diphthong', voiced: true, place: 'Moving', manner: 'Vowel', examples: ['my', 'sight', 'buy', 'eye', 'fly'], description: 'Start at /a/ (open) and glide to /ɪ/ (kit).' },
    { symbol: 'ɔɪ', name: 'choice', type: 'Diphthong', voiced: true, place: 'Moving', manner: 'Vowel', examples: ['boy', 'join', 'toy', 'noise', 'oil'], description: 'Start at /ɔ:/ (thought) and glide to /ɪ/ (kit).' },
    { symbol: 'uə', name: 'cure', type: 'Diphthong', voiced: true, place: 'Moving', manner: 'Vowel', examples: ['pure', 'tourist', 'cure', 'furious', 'security'], description: 'Start at /ʊ/ (foot) and glide to /ə/ (schwa).' },
    { symbol: 'aʊ', name: 'mouth', type: 'Diphthong', voiced: true, place: 'Moving', manner: 'Vowel', examples: ['now', 'out', 'house', 'cow', 'loud'], description: 'Start at /a/ (open) and glide to /ʊ/ (foot).' },
    { symbol: 'əʊ', name: 'goat', type: 'Diphthong', voiced: true, place: 'Moving', manner: 'Vowel', examples: ['no', 'go', 'stone', 'home', 'alone'], description: 'Start at /ə/ (schwa) and glide to /ʊ/ (foot).' },
    { symbol: 'ɪə', name: 'near', type: 'Diphthong', voiced: true, place: 'Moving', manner: 'Vowel', examples: ['near', 'ear', 'here', 'clear', 'year'], description: 'Start at /ɪ/ (kit) and glide to /ə/ (schwa).' },
    { symbol: 'eə', name: 'square', type: 'Diphthong', voiced: true, place: 'Moving', manner: 'Vowel', examples: ['hair', 'care', 'stair', 'where', 'air'], description: 'Start at /e/ (dress) and glide to /ə/ (schwa).' }
];

interface WordEntry {
  word: string;
  phonetic: string;
  definition: string;
  sentence: string;
}

interface SpellingWordData {
  word: string;
  phonetic: string;
  definition: string;
  sentence: string;
  imageUrl?: string;
}

const LOCAL_DICTIONARY: Record<Difficulty, WordEntry[]> = {
  Easy: [
    { word: "CAT", phonetic: "/kæt/", definition: "A small animal kept as a pet.", sentence: "The _____ meowed loudly." },
    { word: "DOG", phonetic: "/dɒɡ/", definition: "A loyal animal often kept as a pet.", sentence: "The _____ barked at the stranger." },
    { word: "SUN", phonetic: "/sʌn/", definition: "The star that gives light and heat.", sentence: "The _____ shines brightly today." },
    { word: "MOON", phonetic: "/muːn/", definition: "The natural light seen at night.", sentence: "The _____ is full tonight." },
    { word: "SKY", phonetic: "/skaɪ/", definition: "The space above the earth.", sentence: "The _____ is very blue." },
    { word: "BOOK", phonetic: "/bʊk/", definition: "Pages with written or printed words.", sentence: "I read a good _____." },
    { word: "PEN", phonetic: "/pen/", definition: "A tool for writing.", sentence: "Use a _____ to sign your name." },
    { word: "CUP", phonetic: "/kʌp/", definition: "A small container for drinking.", sentence: "Would you like a _____ of tea?" },
    { word: "HAT", phonetic: "/hæt/", definition: "Something worn on the head.", sentence: "Put on your _____." },
    { word: "BAG", phonetic: "/bæɡ/", definition: "Used to carry things.", sentence: "My _____ is heavy." },
    { word: "BALL", phonetic: "/bɔːl/", definition: "A round object used in games.", sentence: "Kick the _____." },
    { word: "TREE", phonetic: "/triː/", definition: "A tall plant with branches.", sentence: "The _____ has green leaves." },
    { word: "CAR", phonetic: "/kɑːr/", definition: "A vehicle with four wheels.", sentence: "We drive the _____ to work." },
    { word: "BUS", phonetic: "/bʌs/", definition: "A large vehicle for passengers.", sentence: "I take the _____ to school." },
    { word: "ROAD", phonetic: "/rəʊd/", definition: "A path for cars and people.", sentence: "Look both ways before crossing the _____." },
    { word: "HOUSE", phonetic: "/haʊs/", definition: "A place where people live.", sentence: "They bought a new _____." },
    { word: "DOOR", phonetic: "/dɔːr/", definition: "Used to enter or leave a room.", sentence: "Close the _____ behind you." },
    { word: "CHAIR", phonetic: "/tʃeə(r)/", definition: "Furniture for sitting.", sentence: "Sit on the _____." },
    { word: "TABLE", phonetic: "/ˈteɪbəl/", definition: "Furniture with a flat top.", sentence: "Dinner is on the _____." },
    { word: "BED", phonetic: "/bed/", definition: "Used for sleeping.", sentence: "It is time to go to _____." },
    { word: "WATER", phonetic: "/ˈwɔːtə(r)/", definition: "A clear liquid we drink.", sentence: "Drink plenty of _____." },
    { word: "FOOD", phonetic: "/fuːd/", definition: "What people eat.", sentence: "We need _____ to survive." },
    { word: "MILK", phonetic: "/mɪlk/", definition: "A white drink from animals.", sentence: "Cows produce _____." }
  ],
  Medium: [
     { word: "BRIDGE", phonetic: "/brɪdʒ/", definition: "A structure carrying a road across a river.", sentence: "We drove across the Golden Gate _____." },
    { word: "CANYON", phonetic: "/ˈkæn.jən/", definition: "A deep gorge, typically one with a river flowing through it.", sentence: "The Grand _____ is huge." },
    { word: "GALAXY", phonetic: "/ˈɡæl.ək.si/", definition: "A system of millions or billions of stars.", sentence: "Our solar system is in the Milky Way _____." },
    { word: "HARBOR", phonetic: "/ˈhɑːr.bər/", definition: "A place on the coast where vessels may find shelter.", sentence: "The boats were docked in the _____." },
    { word: "MAGNET", phonetic: "/ˈmæɡ.nət/", definition: "A material that exhibits properties of magnetism.", sentence: "He used a _____ to pick up the nails." },
    { word: "AMBIGUOUS", phonetic: "/æmˈbɪɡ.ju.əs/", definition: "Not clear; can have more than one meaning.", sentence: "The ending was _____." },
    { word: "PLAUSIBLE", phonetic: "/ˈplɑː.zə.bəl/", definition: "Seems possible or believable.", sentence: "A _____ excuse." },
    { word: "INEVITABLE", phonetic: "/ˌɪnˈev.ə.t̬ə.bəl/", definition: "Cannot be avoided.", sentence: "War seemed _____." },
    { word: "METICULOUS", phonetic: "/məˈtɪk.jə.ləs/", definition: "Very careful with details.", sentence: "He is _____ about cleaning." },
    { word: "TEDIOUS", phonetic: "/ˈtiː.di.əs/", definition: "Boring and long.", sentence: "A _____ lecture." },
    { word: "HOSTILE", phonetic: "/ˈhɑː.stəl/", definition: "Unfriendly or aggressive.", sentence: "A _____ environment." },
    { word: "SUBTLE", phonetic: "/ˈsʌt.əl/", definition: "Not obvious.", sentence: "A _____ hint." },
    { word: "INFER", phonetic: "/ɪnˈfɝː/", definition: "To conclude from clues.", sentence: "I _____ you are busy." },
    { word: "MUNDANE", phonetic: "/mʌnˈdeɪn/", definition: "Ordinary, not exciting.", sentence: "A _____ routine." },
    { word: "REFRAIN", phonetic: "/rɪˈfreɪn/", definition: "To stop yourself from doing something.", sentence: "Please _____ from talking." },
    { word: "ADEQUATE", phonetic: "/ˈæd.ə.kwət/", definition: "Good enough.", sentence: "The food was _____." },
    { word: "ARBITRARY", phonetic: "/ˈɑːr.bə.trer.i/", definition: "Based on random choice, not reason.", sentence: "An _____ decision." }
  ],
  Hard: [
    { word: "ECLIPSE", phonetic: "/ɪˈklɪps/", definition: "An obscuring of the light from one celestial body by another.", sentence: "The solar _____ darkened the sky." },
    { word: "GLACIER", phonetic: "/ˈɡleɪ.ʃər/", definition: "A slowly moving mass of ice formed by the accumulation of snow.", sentence: "The _____ carved the valley over centuries." },
    { word: "LABYRINTH", phonetic: "/ˈlæb.ə.rɪnθ/", definition: "A complicated irregular network of passages; a maze.", sentence: "Minos built a _____ to hold the Minotaur." },
    { word: "PHOENIX", phonetic: "/ˈfiː.nɪks/", definition: "A mythical bird that regenerates from its own ashes.", sentence: "Like a _____, the city rose from the ruins." },
    { word: "SYMPHONY", phonetic: "/ˈsɪm.fə.ni/", definition: "An elaborate musical composition for full orchestra.", sentence: "Beethoven's Ninth _____ is a masterpiece." },
    { word: "OBFUSCATE", phonetic: "/ˈɑːb.fə.skeɪt/", definition: "To make something unclear.", sentence: "Do not _____ the issue." },
    { word: "PERNICIOUS", phonetic: "/pɚˈnɪʃ.əs/", definition: "Harmful in a subtle way.", sentence: "A _____ influence." },
    { word: "UBIQUITOUS", phonetic: "/juːˈbɪk.wə.t̬əs/", definition: "Found everywhere.", sentence: "Smartphones are _____." },
    { word: "EPHEMERAL", phonetic: "/əˈfem.ɚ.əl/", definition: "Lasting for a very short time.", sentence: "Fame is often _____." },
    { word: "MAGNANIMOUS", phonetic: "/mæɡˈnæn.ə.məs/", definition: "Very generous and forgiving.", sentence: "A _____ gesture." },
    { word: "ESOTERIC", phonetic: "/ˌes.əˈter.ɪk/", definition: "Known only by a small group.", sentence: "An _____ hobby." },
    { word: "FASTIDIOUS", phonetic: "/fæsˈtɪd.i.əs/", definition: "Very picky; hard to please.", sentence: "He is _____ about food." },
    { word: "BELLIGERENT", phonetic: "/bəˈlɪdʒ.ɚ.ənt/", definition: "Aggressive or ready to fight.", sentence: "A _____ attitude." },
    { word: "EQUANIMITY", phonetic: "/ˌiː.kwəˈnɪm.ə.t̬i/", definition: "Calmness under stress.", sentence: "She accepted it with _____." }
  ]
};

// --- Shared Types & Helpers ---

const SoundManager = {
  ctx: null as AudioContext | null,
  init() {
    if (typeof window === 'undefined') return;
    try {
        if (!this.ctx) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            this.ctx = new AudioContextClass();
          }
        }
        if (this.ctx && this.ctx.state !== 'running') {
          this.ctx.resume().catch(err => console.warn("AudioContext resume failed", err));
        }
    } catch (e) {
        console.warn("Audio init failed", e);
    }
  },
  playWin() {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.frequency.setValueAtTime(523.25, this.ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);
    } catch (e) {}
  },
  playError() {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch (e) {}
  }
};

const useTextToSpeech = () => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const loadVoices = () => {
        const vs = window.speechSynthesis.getVoices();
        if (vs.length > 0) setVoices(vs);
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const speak = useCallback((text: string, rate = 0.9) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
    SoundManager.init();
    window.speechSynthesis.cancel();
    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        utterance.lang = 'en-US';
        activeUtteranceRef.current = utterance;
        const currentVoices = window.speechSynthesis.getVoices();
        const voice = currentVoices.find(v => v.name.includes("Google US English")) || 
                      currentVoices.find(v => v.lang === 'en-US') || 
                      currentVoices.find(v => v.lang.startsWith('en'));
        if (voice) utterance.voice = voice;
        utterance.onend = () => { activeUtteranceRef.current = null; };
        utterance.onerror = (e) => {
            if (e.error === 'interrupted' || e.error === 'canceled') return;
            console.error("TTS Error Detail:", e.error);
            activeUtteranceRef.current = null;
            if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        };
        try { window.speechSynthesis.speak(utterance); } catch (err) { console.error("TTS Speak Exception:", err); }
    }, 10);
  }, []);
  return speak;
};

interface Tile {
  id: string;
  letter: string;
  value: number;
  isHint?: boolean;
}

interface Player {
  id: string;
  name: string;
}

interface GameState {
  players: Player[];
  words: WordEntry[];
  currentWordIndex: number;
  activePlayerIndex: number;
  phase: 'main' | 'steal';
  timeLeft: number;
  scores: Record<string, number>;
  status: 'waiting' | 'playing' | 'gameover';
}

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
  phonetic?: string; 
  attempts: number;
}

interface SpellingState {
    data: SpellingWordData | null;
    input: string;
    status: 'loading' | 'playing' | 'won' | 'error';
    message: string;
    showDefinition: boolean;
    showSentence: boolean;
    attempts: number;
}

const generateTiles = (word: string): Tile[] => {
  return word.split('').map((char, index) => ({
    id: `${char}-${index}-${Math.random().toString(36).substr(2, 9)}`,
    letter: char.toUpperCase(),
    value: SCRABBLE_SCORES[char.toUpperCase()] || 0,
    isHint: false
  }));
};

const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const getPollinationsImage = (word: string): string => {
  return `https://image.pollinations.ai/prompt/minimalist%20illustration%20of%20${encodeURIComponent(word)}?width=300&height=300&nologo=true`;
};

const ShuffledImage = ({ src, isRevealed }: { src: string, isRevealed: boolean }) => {
    const [loaded, setLoaded] = useState(false);
    useEffect(() => { setLoaded(false); }, [src]);
    const [tiles, setTiles] = useState<number[]>([]);

    useEffect(() => {
        const indices = Array.from({ length: 9 }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        setTiles(indices);
    }, [src]);

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 12, background: '#f1f5f9', position: 'relative', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)' }}>
             {isRevealed ? (
                 <img 
                    src={src} 
                    onLoad={() => setLoaded(true)}
                    style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                        opacity: loaded ? 1 : 0, transition: 'opacity 0.5s ease-out'
                    }}
                />
             ) : (
                <div style={{width: '100%', height: '100%', display: 'flex', flexWrap: 'wrap'}}>
                    {tiles.map((tileIndex, i) => {
                        const row = Math.floor(tileIndex / 3);
                        const col = tileIndex % 3;
                        return (
                            <div key={i} style={{
                                width: '33.33%', height: '33.33%',
                                backgroundImage: `url(${src})`, backgroundPosition: `${col * 50}% ${row * 50}%`,
                                backgroundSize: '300% 300%', boxSizing: 'border-box', border: '2px solid #fff',
                                transition: 'all 0.3s ease'
                            }} />
                        );
                    })}
                </div>
             )}
        </div>
    );
};

// --- Components ---

const PhoneticsGuide = () => {
    const [selectedSound, setSelectedSound] = useState<PhoneticEntry | null>(null);
    const speak = useTextToSpeech();
    const groups = PHONETICS_DATA.reduce((acc, curr) => {
        const key = curr.manner || curr.type;
        if (!acc[key]) acc[key] = [];
        acc[key].push(curr);
        return acc;
    }, {} as Record<string, PhoneticEntry[]>);
    const orderedKeys = ['Stop', 'Fricative', 'Affricate', 'Nasal', 'Approximant', 'Lateral Approximant', 'Vowel', 'Diphthong'];

    return (
        <div className="phonetics-container animate-fade-in">
            <h2 className="section-title">Phonetic Library</h2>
            <div className="phonetics-scroll">
                {orderedKeys.map(group => {
                    const items = groups[group];
                    if (!items) return null;
                    return (
                        <div key={group} className="phonetic-group">
                            <h4 className="group-title">{group}s</h4>
                            <div className="phonetics-grid">
                                {items.map((sound, idx) => (
                                    <button key={idx} className={`phonetic-card ${sound.type.toLowerCase()}`} onClick={() => setSelectedSound(sound)}>
                                        <div className="symbol">{sound.symbol}</div>
                                        <div className="name">{sound.name}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
            {selectedSound && (
                <div className="modal-overlay animate-fade-in" onClick={() => setSelectedSound(null)}>
                    <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()}>
                        <button className="close-btn" onClick={() => setSelectedSound(null)}>×</button>
                        <div className="modal-header">
                             <div className="modal-symbol-container">
                                <h2 className="modal-symbol">{selectedSound.symbol}</h2>
                                <button className="modal-audio-btn" onClick={() => speak(`${selectedSound.name}. ${selectedSound.examples[0]}.`)}>▶</button>
                             </div>
                             <div className="modal-tags">
                                <span className={`tag ${selectedSound.type.toLowerCase()}`}>{selectedSound.type}</span>
                                <span className="tag neutral">{selectedSound.place}</span>
                                <span className="tag neutral">{selectedSound.voiced ? "Voiced" : "Voiceless"}</span>
                             </div>
                        </div>
                        <div className="modal-body">
                             <div className="instruction-box">
                                <h5>How to produce it</h5>
                                <p>{selectedSound.description}</p>
                             </div>
                             <div className="examples-box">
                                <h5>Examples</h5>
                                <div className="chips">
                                    {selectedSound.examples.map((ex, i) => <span key={i} className="chip" onClick={() => speak(ex)}>{ex}</span>)}
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ScrabbleGame = ({ difficulty, onScoreUpdate }: { difficulty: Difficulty, onScoreUpdate: (points: number) => void }) => {
  const [level, setLevel] = useState(1);
  const [wordProgress, setWordProgress] = useState(0);

  useEffect(() => {
    const savedLevel = localStorage.getItem(`scrabble_level_${difficulty}`);
    const savedProgress = localStorage.getItem(`scrabble_progress_${difficulty}`);
    if (savedLevel) setLevel(parseInt(savedLevel));
    if (savedProgress) setWordProgress(parseInt(savedProgress));
  }, [difficulty]);

  const [state, setState] = useState<ScrabbleState>({
    word: '', definition: '', placedTiles: [], rackTiles: [],
    status: 'loading', score: 0, message: '', seenWords: [], attempts: 0
  });

  const seenWordsRef = useRef<string[]>([]);
  const { maxLevels, wordsPerLevel } = LEVEL_CONFIG[difficulty];

  const fetchWord = useCallback(async () => {
    setState(prev => ({ ...prev, status: 'loading', message: '', placedTiles: [], rackTiles: [], word: '', definition: '', imageUrl: undefined, phonetic: undefined, attempts: 0 }));
    if (process.env.API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const model = difficulty === 'Hard' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';
        const prompt = `Pick a random English word. Diff: ${difficulty}. Do NOT use: ${seenWordsRef.current.slice(-20).join(', ')}. JSON: { "word": "...", "phonetic": "...", "definition": "..." }`;
        const response = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { word: { type: Type.STRING }, phonetic: { type: Type.STRING }, definition: { type: Type.STRING } } } } });
        const data = JSON.parse(response.text);
        if (data.word) {
             const word = data.word.toUpperCase().trim();
             seenWordsRef.current.push(word);
             setState(prev => ({ ...prev, word, definition: data.definition, phonetic: data.phonetic, placedTiles: Array(word.length).fill(null), rackTiles: shuffleArray(generateTiles(word)), status: 'playing', score: 0, seenWords: [...prev.seenWords, word], imageUrl: getPollinationsImage(word) }));
             return;
        }
      } catch (e) { console.warn("API Error", e); }
    }
    const candidates = LOCAL_DICTIONARY[difficulty];
    const available = candidates.filter(c => !seenWordsRef.current.includes(c.word));
    const pool = available.length > 0 ? available : candidates;
    const randomEntry = pool[Math.floor(Math.random() * pool.length)];
    const word = randomEntry.word.toUpperCase();
    seenWordsRef.current.push(word);
    setState(prev => ({ ...prev, word, definition: randomEntry.definition, phonetic: randomEntry.phonetic, placedTiles: Array(word.length).fill(null), rackTiles: shuffleArray(generateTiles(word)), status: 'playing', score: 0, seenWords: [...prev.seenWords, word], imageUrl: getPollinationsImage(word) }));
  }, [difficulty]);

  useEffect(() => { fetchWord(); }, [fetchWord]);

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newLevel = parseInt(e.target.value); setLevel(newLevel); setWordProgress(0);
      localStorage.setItem(`scrabble_level_${difficulty}`, newLevel.toString());
      localStorage.setItem(`scrabble_progress_${difficulty}`, '0');
      setTimeout(fetchWord, 0); 
  };

  const checkWin = (currentPlaced: (Tile | null)[]) => {
    if (currentPlaced.some(t => t === null)) return;
    const formedWord = currentPlaced.map(t => t?.letter).join('');
    if (formedWord === state.word) {
      SoundManager.playWin();
      const wordScore = currentPlaced.reduce((acc, t) => acc + (t ? t.value : 0), 0);
      onScoreUpdate(wordScore);
      let nextProgress = wordProgress + 1;
      let nextLevel = level;
      if (nextProgress >= wordsPerLevel) { nextLevel = Math.min(level + 1, maxLevels); nextProgress = 0; }
      setLevel(nextLevel); setWordProgress(nextProgress);
      localStorage.setItem(`scrabble_level_${difficulty}`, nextLevel.toString());
      localStorage.setItem(`scrabble_progress_${difficulty}`, nextProgress.toString());
      setState(prev => ({ ...prev, status: 'won', message: `Correct! +${wordScore} pts` }));
    } else {
      SoundManager.playError();
      const newAttempts = state.attempts + 1;
      if (newAttempts >= 3) {
          const solvedTiles = generateTiles(state.word);
          setState(prev => ({ ...prev, attempts: newAttempts, placedTiles: solvedTiles, rackTiles: [], status: 'won', message: `Out of tries! Word: ${state.word}` }));
      } else {
          setState(prev => ({ ...prev, attempts: newAttempts, message: `Try Again (${3 - newAttempts} left)` }));
          setTimeout(() => setState(prev => ({ ...prev, message: '' })), 2000);
      }
    }
  };

  const handleRackTileClick = (tile: Tile) => {
    if (state.status !== 'playing') return;
    SoundManager.init();
    const firstEmptyIndex = state.placedTiles.findIndex(t => t === null);
    if (firstEmptyIndex === -1) return;
    const newPlaced = [...state.placedTiles]; newPlaced[firstEmptyIndex] = tile;
    const newRack = state.rackTiles.filter(t => t.id !== tile.id);
    const currentScore = newPlaced.reduce((acc, t) => acc + (t ? t.value : 0), 0);
    setState(prev => ({ ...prev, placedTiles: newPlaced, rackTiles: newRack, score: currentScore }));
    checkWin(newPlaced);
  };

  const handlePlacedTileClick = (index: number) => {
    if (state.status !== 'playing') return;
    SoundManager.init();
    const tile = state.placedTiles[index];
    if (!tile || tile.isHint) return;
    const newPlaced = [...state.placedTiles]; newPlaced[index] = null;
    const newRack = [...state.rackTiles, tile];
    const currentScore = newPlaced.reduce((acc, t) => acc + (t ? t.value : 0), 0);
    setState(prev => ({ ...prev, placedTiles: newPlaced, rackTiles: newRack, score: currentScore }));
  };

  return (
    <div className="animate-fade-in">
      <div className="game-status-bar">
          <div className="level-indicator"><span className="label">Level</span><select value={level} onChange={handleLevelChange}>{Array.from({length: maxLevels}, (_, i) => i + 1).map(l => <option key={l} value={l}>{l}</option>)}</select></div>
          <div className="progress-bar-container"><div className="progress-bar-fill" style={{width: `${(wordProgress / wordsPerLevel) * 100}%`}}></div></div>
          <span className="progress-text">{wordProgress + 1}/{wordsPerLevel}</span>
      </div>
      <div className="game-card">
        {state.imageUrl && <div className="image-wrapper"><ShuffledImage src={state.imageUrl} isRevealed={state.status === 'won'} /></div>}
        <div className="definition-section">
            <h3 className="section-header">Definition</h3>
            <p className="definition-body">{state.definition}</p>
            {state.phonetic && <span className="phonetic-tag">{state.phonetic}</span>}
        </div>
        <div className="slots-container">
            {state.placedTiles.map((tile, index) => (
            <div key={`slot-${index}`} className={`slot ${tile ? 'filled' : ''}`} onClick={() => handlePlacedTileClick(index)}>
                {tile && <div className={`tile ${tile.isHint ? 'hint' : ''} ${state.status === 'won' ? 'won' : ''}`}><span className="letter">{tile.letter}</span><span className="score">{tile.value}</span></div>}
            </div>
            ))}
        </div>
        <div className="feedback-message">{state.message}</div>
      </div>
      <div className="interaction-area">
          {state.status === 'won' ? <button className="btn btn-primary large" onClick={fetchWord}>Next Word →</button> : (
            <>
                <div className="rack">
                    <button className="icon-btn" onClick={() => setState(p => ({...p, rackTiles: shuffleArray(p.rackTiles)}))}>↻</button>
                    {state.rackTiles.map((tile) => <div key={tile.id} className="tile rack-tile" onClick={() => handleRackTileClick(tile)}><span className="letter">{tile.letter}</span><span className="score">{tile.value}</span></div>)}
                </div>
                {state.status === 'playing' && <div className="action-buttons"><button className="btn btn-text" onClick={fetchWord}>Skip</button></div>}
            </>
          )}
      </div>
    </div>
  );
};

const SpellingGame = ({ difficulty, onScoreUpdate }: { difficulty: Difficulty, onScoreUpdate: (points: number) => void }) => {
  const [level, setLevel] = useState(1);
  const [wordProgress, setWordProgress] = useState(0);
  const speak = useTextToSpeech();
  
  useEffect(() => {
    const savedLevel = localStorage.getItem(`spelling_level_${difficulty}`);
    const savedProgress = localStorage.getItem(`spelling_progress_${difficulty}`);
    if (savedLevel) setLevel(parseInt(savedLevel));
    if (savedProgress) setWordProgress(parseInt(savedProgress));
  }, [difficulty]);

  const { maxLevels, wordsPerLevel } = LEVEL_CONFIG[difficulty];
  const [state, setState] = useState<SpellingState>({ data: null, input: '', status: 'loading', message: '', showDefinition: false, showSentence: false, attempts: 0 });
  const seenWordsRef = useRef<string[]>([]);

  const fetchWord = useCallback(async () => {
    setState(prev => ({ ...prev, status: 'loading', message: '', input: '', showDefinition: false, showSentence: false, data: null, attempts: 0 }));
    let wordData: SpellingWordData | null = null;
    if (process.env.API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const model = difficulty === 'Hard' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';
        const prompt = `Pick random spelling word. Diff: ${difficulty}. JSON: { "word": "...", "phonetic": "...", "definition": "...", "sentence": "..." }`;
        const response = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { word: { type: Type.STRING }, phonetic: { type: Type.STRING }, definition: { type: Type.STRING }, sentence: { type: Type.STRING } } } } });
        const data = JSON.parse(response.text);
        if (data.word) wordData = { word: data.word.toUpperCase().trim(), phonetic: data.phonetic, definition: data.definition, sentence: data.sentence, imageUrl: getPollinationsImage(data.word) };
      } catch (e) { console.warn("API Error", e); }
    }
    if (!wordData) {
        const candidates = LOCAL_DICTIONARY[difficulty];
        const randomEntry = candidates[Math.floor(Math.random() * candidates.length)];
        wordData = { word: randomEntry.word.toUpperCase(), phonetic: randomEntry.phonetic, definition: randomEntry.definition, sentence: randomEntry.sentence, imageUrl: getPollinationsImage(randomEntry.word) };
    }
    seenWordsRef.current.push(wordData!.word);
    setState(prev => ({ ...prev, status: 'playing', data: wordData }));
    setTimeout(() => speak(wordData!.word), 500);
  }, [difficulty, speak]);

  useEffect(() => { fetchWord(); }, [fetchWord]);

  const checkWord = () => {
      SoundManager.init();
      if (!state.data) return;
      if (state.input.toUpperCase().trim() === state.data.word) {
          SoundManager.playWin();
          const points = difficulty === 'Hard' ? 15 : difficulty === 'Medium' ? 10 : 5;
          onScoreUpdate(points);
          let nextProgress = wordProgress + 1;
          let nextLevel = level;
          if (nextProgress >= wordsPerLevel) { nextLevel = Math.min(level + 1, maxLevels); nextProgress = 0; }
          setLevel(nextLevel); setWordProgress(nextProgress);
          localStorage.setItem(`spelling_level_${difficulty}`, nextLevel.toString());
          localStorage.setItem(`spelling_progress_${difficulty}`, nextProgress.toString());
          setState(prev => ({ ...prev, status: 'won', message: `Correct! +${points} pts` }));
      } else {
          SoundManager.playError();
          const newAttempts = state.attempts + 1;
          if (newAttempts >= 3) {
              setState(prev => ({ ...prev, attempts: newAttempts, input: state.data!.word, status: 'won', message: `Out of tries! Answer: ${state.data!.word}` }));
          } else {
              setState(prev => ({ ...prev, attempts: newAttempts, message: `Try again! (${3 - newAttempts} left)` }));
              setTimeout(() => setState(prev => ({...prev, message: ''})), 1500);
          }
      }
  };

  if (state.status === 'loading') return <div className="loader-container"><div className="loader"></div></div>;

  return (
    <div className={`animate-fade-in ${state.status === 'won' ? 'game-won' : ''}`}>
        <div className="game-status-bar">
          <div className="level-indicator"><span className="label">Level</span><select value={level} onChange={(e) => { const l = parseInt(e.target.value); setLevel(l); setWordProgress(0); localStorage.setItem(`spelling_level_${difficulty}`, l.toString()); localStorage.setItem(`spelling_progress_${difficulty}`, '0'); setTimeout(fetchWord,0); }}>{Array.from({length: maxLevels}, (_, i) => i + 1).map(l => <option key={l} value={l}>{l}</option>)}</select></div>
          <div className="progress-bar-container"><div className="progress-bar-fill" style={{width: `${(wordProgress / wordsPerLevel) * 100}%`}}></div></div>
        </div>
        <div className="game-card">
            <div className="image-wrapper">{state.data?.imageUrl && <ShuffledImage src={state.data.imageUrl} isRevealed={state.status === 'won'} />}</div>
            <button className="big-play-btn" onClick={() => speak(state.data?.word || '')}>▶</button>
            {state.data?.phonetic && <div className="phonetic-display-box" style={{ background: '#f0f9ff', padding: '10px 20px', borderRadius: '15px', color: '#0284c7', fontSize: '1.4rem', fontWeight: 'bold', fontFamily: 'serif', marginBottom: '15px', border: '1px solid #bae6fd' }}>{state.data.phonetic}</div>}
            <div className="input-group"><input className="modern-input" value={state.input} onChange={e => setState(prev => ({...prev, input: e.target.value}))} placeholder="TYPE HERE" disabled={state.status === 'won'} onKeyDown={e => e.key === 'Enter' && checkWord()} autoFocus /></div>
            <div className="feedback-message">{state.message}</div>
            <div className="hints-container">
                {(state.showDefinition || state.status === 'won') && <div className="hint-card animate-slide-up"><span className="hint-label">Definition</span><p>{state.data?.definition}</p></div>}
                {(state.showSentence || state.status === 'won') && state.data?.sentence && <div className="hint-card animate-slide-up"><span className="hint-label">Usage</span><p>"{state.data.sentence.replace(new RegExp(state.data.word, 'gi'), '_____')}"</p></div>}
            </div>
        </div>
        <div className="interaction-area">
            {state.status === 'won' ? <button className="btn btn-primary large" onClick={fetchWord}>Next Word →</button> : (
                <div className="action-buttons">
                    <button className="btn btn-primary" onClick={checkWord}>Submit</button>
                    <button className="btn btn-light" onClick={() => { if (!state.showDefinition) setState(prev => ({...prev, showDefinition: true})); else if (!state.showSentence) setState(prev => ({...prev, showSentence: true})); else speak(state.data?.word || ''); }}>{(!state.showDefinition) ? 'Hint: Def' : (!state.showSentence) ? 'Hint: Use' : 'Listen'}</button>
                    <button className="btn btn-text" onClick={fetchWord}>Skip</button>
                </div>
            )}
        </div>
    </div>
  );
};

const MultiplayerGame = ({ difficulty }: { difficulty: Difficulty }) => {
    const [status, setStatus] = useState<'lobby' | 'hosting' | 'joining' | 'playing' | 'gameover'>('lobby');
    const [role, setRole] = useState<'host' | 'client' | null>(null);
    const [joinInput, setJoinInput] = useState('');
    const [connection, setConnection] = useState<any>(null);
    const [peerId, setPeerId] = useState<string>('');
    const peerRef = useRef<any>(null);
    const hostConnectionsRef = useRef<Map<string, any>>(new Map());
    const [gameState, setGameState] = useState<GameState>({ players: [], words: [], currentWordIndex: 0, activePlayerIndex: 0, phase: 'main', timeLeft: 30, scores: {}, status: 'waiting', });
    const [input, setInput] = useState('');
    const [message, setMessage] = useState('');
    const [showDef, setShowDef] = useState(false);
    const speak = useTextToSpeech();

    useEffect(() => {
        const id = Math.random().toString(36).substring(2, 6).toUpperCase();
        const setupPeer = () => {
             const peer = new Peer(id, { debug: 1 }); peerRef.current = peer;
             peer.on('open', (id) => setPeerId(id));
             peer.on('error', (err) => { setMessage("Connection Error."); setTimeout(setupPeer, 2000); });
             peer.on('connection', (conn) => { conn.on('open', () => { if (role !== 'host' && status !== 'lobby') return; handleNewConnection(conn, id); }); });
        };
        setupPeer(); return () => peerRef.current?.destroy();
    }, []);

    const handleNewConnection = (conn: any, myId: string) => {
         setRole('host'); setStatus('hosting');
         setGameState(prev => {
             if (prev.players.length >= 4) { conn.send({ type: 'ERROR', message: 'Game Full' }); setTimeout(() => conn.close(), 500); return prev; }
             if (prev.players.find(p => p.id === conn.peer)) return prev;
             const newPlayer = { id: conn.peer, name: `Player ${prev.players.length + 1}` };
             hostConnectionsRef.current.set(conn.peer, conn);
             conn.on('data', (data: any) => { if (data.type === 'CLIENT_SUBMIT') handleWordSubmission(data.word, data.playerId); });
             conn.on('close', () => { hostConnectionsRef.current.delete(conn.peer); });
             let currentPlayers = [...prev.players];
             if (currentPlayers.length === 0) currentPlayers.push({ id: myId, name: "Host (You)" });
             const nextState = { ...prev, players: [...currentPlayers, newPlayer], scores: { ...prev.scores, [newPlayer.id]: 0, [myId]: 0 } };
             broadcastState(nextState); return nextState;
         });
    };

    const broadcastState = (state: GameState) => { hostConnectionsRef.current.forEach(conn => { if (conn.open) conn.send({ type: 'STATE_UPDATE', state: state }); }); };
    useEffect(() => {
        if (role !== 'host' || status !== 'playing' || gameState.status !== 'playing') return;
        const timer = setInterval(() => {
            setGameState(prev => {
                if (prev.timeLeft <= 0) return switchTurn(prev, false);
                const newState = { ...prev, timeLeft: prev.timeLeft - 1 };
                broadcastState(newState); return newState;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [role, status, gameState.status]);

    const switchTurn = (prev: GameState, success: boolean): GameState => {
        let nextState = { ...prev };
        const playerCount = prev.players.length;
        if (success) {
             const points = prev.phase === 'main' ? 10 : 5;
             const activePlayer = prev.players[prev.activePlayerIndex];
             const winnerId = prev.phase === 'main' ? activePlayer.id : prev.players[(prev.activePlayerIndex + 1) % playerCount].id;
             const newScore = (prev.scores[winnerId] || 0) + points;
             nextState.scores = { ...prev.scores, [winnerId]: newScore };
             if (newScore >= 100) nextState.status = 'gameover';
             else {
                 nextState.currentWordIndex += 1; nextState.phase = 'main'; nextState.timeLeft = 30;
                 nextState.activePlayerIndex = (prev.activePlayerIndex + 1) % playerCount;
                 if (nextState.currentWordIndex < nextState.words.length) speak(nextState.words[nextState.currentWordIndex].word);
             }
        } else {
            if (prev.phase === 'main') { nextState.phase = 'steal'; nextState.timeLeft = 30; }
            else {
                nextState.currentWordIndex += 1; nextState.phase = 'main'; nextState.timeLeft = 30;
                nextState.activePlayerIndex = (prev.activePlayerIndex + 1) % playerCount;
                if (nextState.currentWordIndex < nextState.words.length) speak(nextState.words[nextState.currentWordIndex].word);
            }
        }
        broadcastState(nextState); return nextState;
    };

    const handleWordSubmission = (submittedWord: string, submitterId: string) => {
        setGameState(prev => {
             const playerCount = prev.players.length; const activeIdx = prev.activePlayerIndex; const stealIdx = (activeIdx + 1) % playerCount;
             let isTurn = false;
             if (prev.phase === 'main' && prev.players[activeIdx].id === submitterId) isTurn = true;
             if (prev.phase === 'steal' && prev.players[stealIdx].id === submitterId) isTurn = true;
             if (!isTurn) return prev; 
             const isCorrect = submittedWord.toUpperCase().trim() === prev.words[prev.currentWordIndex].word;
             if (isCorrect) SoundManager.playWin(); else SoundManager.playError();
             return switchTurn(prev, isCorrect);
        });
        if (submitterId === peerId) { setInput(''); setShowDef(false); }
    };

    const startGameHost = () => {
        const combinedPool = [...LOCAL_DICTIONARY['Medium'], ...LOCAL_DICTIONARY['Hard']];
        const selected = Array.from({length: 100}, () => combinedPool[Math.floor(Math.random() * combinedPool.length)]);
        const currentPlayers = [...gameState.players];
        if (currentPlayers.length === 0 || currentPlayers[0].id !== peerId) if (!currentPlayers.find(p => p.id === peerId)) currentPlayers.unshift({ id: peerId, name: "Host (You)" });
        const initScores: Record<string, number> = {}; currentPlayers.forEach(p => initScores[p.id] = 0);
        const initialState: GameState = { players: currentPlayers, words: selected, currentWordIndex: 0, activePlayerIndex: 0, phase: 'main', timeLeft: 30, scores: initScores, status: 'playing' };
        setGameState(initialState); setStatus('playing'); broadcastState(initialState); speak(selected[0].word);
    };

    const handleJoin = () => {
        if (!joinInput) return;
        const conn = peerRef.current.connect(joinInput.toUpperCase());
        conn.on('open', () => {
            setConnection(conn); setRole('client'); setStatus('playing'); 
            conn.on('data', (data: any) => { if (data.type === 'STATE_UPDATE') setGameState(data.state); if (data.type === 'ERROR') { setMessage(data.message); setTimeout(() => setStatus('lobby'), 2000); } });
        });
        conn.on('error', () => setMessage("Could not connect."));
    };

    const submitWordClient = () => { if (connection) { connection.send({ type: 'CLIENT_SUBMIT', word: input, playerId: peerId }); setInput(''); setShowDef(false); } };
    
    if (status === 'lobby') return (
            <div className="card-center"><h2>Multiplayer</h2><p>Play live with up to 4 friends.</p>{peerId ? (<div className="btn-group vertical"><button className="btn btn-primary" onClick={() => { setRole('host'); setStatus('hosting'); setGameState(prev => ({ ...prev, players: [{ id: peerId, name: "Host (You)" }], scores: { [peerId]: 0 } })); }}>Create Room</button><button className="btn btn-light" onClick={() => setStatus('joining')}>Join Room</button></div>) : <div className="loader"></div>}</div>
    );
    if (status === 'hosting') return (<div className="card-center"><h3>Room Code</h3><div className="code-display">{peerId}</div><div className="list-container">{gameState.players.map(p => <div key={p.id} className="list-item"><span>{p.name}</span>{p.id === peerId && <span className="tag">Host</span>}</div>)}</div>{gameState.players.length >= 2 && <button className="btn btn-primary" onClick={startGameHost}>Start Match</button>}<button className="btn btn-text" onClick={() => setStatus('lobby')}>Cancel</button></div>);
    if (status === 'joining') return (<div className="card-center"><h3>Join Room</h3><input className="modern-input" placeholder="ENTER CODE" value={joinInput} onChange={e => setJoinInput(e.target.value)} /><button className="btn btn-primary" onClick={handleJoin}>Connect</button><div className="feedback-message">{message}</div><button className="btn btn-text" onClick={() => setStatus('lobby')}>Back</button></div>);

    if (status === 'playing') {
        if (gameState.status === 'gameover') {
             const sortedPlayers = [...gameState.players].sort((a, b) => (gameState.scores[b.id] || 0) - (gameState.scores[a.id] || 0));
             return (<div className="card-center"><h2>Game Over</h2><div className="leaderboard">{sortedPlayers.map((p, index) => (<div key={p.id} className={`leaderboard-item ${index === 0 ? 'winner' : ''}`}><span>{index + 1}. {p.name}</span><span>{gameState.scores[p.id] || 0} pts</span></div>))}</div><button className="btn btn-primary" onClick={() => window.location.reload()}>Exit</button></div>);
        }
        if (gameState.status === 'waiting') return <div className="card-center"><h3>Connected</h3><p>Waiting for host...</p><div className="loader"></div></div>;
        const activePlayer = gameState.players[gameState.activePlayerIndex];
        const isMyTurn = (gameState.phase === 'main' && activePlayer.id === peerId) || (gameState.phase === 'steal' && gameState.players[(gameState.activePlayerIndex + 1) % gameState.players.length].id === peerId);
        return (
            <div className={`multiplayer-game ${isMyTurn ? 'my-turn' : ''}`}>
                <div className="top-hud"><div className="timer-badge">⏱ {gameState.timeLeft}s</div><div className="turn-indicator">{isMyTurn ? "YOUR TURN" : `${activePlayer.name}'s Turn`}</div></div>
                <div className="players-scroller">{gameState.players.map(p => <div key={p.id} className={`player-pill ${p.id === activePlayer.id ? 'active' : ''}`}>{p.name}: {gameState.scores[p.id] || 0}</div>)}</div>
                <div className="game-card">
                    <div className="image-wrapper small"><ShuffledImage src={getPollinationsImage(gameState.words[gameState.currentWordIndex].word)} isRevealed={false} /></div>
                    <button className="big-play-btn" onClick={() => speak(gameState.words[gameState.currentWordIndex].word)}>▶</button>
                    <input className="modern-input" value={input} onChange={e => setInput(e.target.value)} placeholder={isMyTurn ? "SPELL IT" : "WAITING..."} disabled={!isMyTurn} onKeyDown={e => { if (e.key === 'Enter' && isMyTurn) role === 'host' ? handleWordSubmission(input, peerId) : submitWordClient(); }} />
                    {showDef && <p className="hint-text">{gameState.words[gameState.currentWordIndex].definition}</p>}
                    <div className="action-buttons"><button className="btn btn-primary" onClick={() => role === 'host' ? handleWordSubmission(input, peerId) : submitWordClient()} disabled={!isMyTurn}>Submit</button><button className="btn btn-light" onClick={() => setShowDef(true)} disabled={showDef}>Definition</button></div>
                </div>
            </div>
        );
    }
    return <div>Loading...</div>;
};

const App = () => {
    const [mode, setMode] = useState<GameMode>('phonetics');
    const [difficulty, setDifficulty] = useState<Difficulty>('Easy');
    const [score, setScore] = useState(0);

    return (
        <div className="app-shell">
             <style>{`
                :root { --primary: #7c3aed; --primary-light: #a78bfa; --primary-dark: #5b21b6; --accent: #db2777; --accent-glow: rgba(219, 39, 119, 0.4); --bg-color: #f8fafc; --surface: rgba(255, 255, 255, 0.85); --text-main: #1e293b; --text-muted: #64748b; --success: #10b981; --radius: 20px; --shadow-lg: 0 10px 30px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1); --glass: rgba(255, 255, 255, 0.65); --glass-border: rgba(255, 255, 255, 0.5); }
                * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
                body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%); color: var(--text-main); min-height: 100vh; overflow-x: hidden; }
                .app-shell { max-width: 600px; margin: 0 auto; min-height: 100vh; padding-bottom: 80px; }
                header { position: sticky; top: 0; z-index: 50; background: var(--glass); backdrop-filter: blur(20px); padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--glass-border); }
                h1 { margin: 0; font-size: 1.6rem; font-weight: 800; background: linear-gradient(135deg, var(--primary-dark), var(--accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.5px; }
                .score-pill { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; padding: 6px 14px; border-radius: 30px; font-weight: 700; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3); }
                .nav-pills { display: flex; gap: 10px; overflow-x: auto; padding: 20px; scrollbar-width: none; }
                .nav-pills::-webkit-scrollbar { display: none; }
                .nav-item { white-space: nowrap; padding: 10px 18px; border-radius: 25px; background: rgba(255, 255, 255, 0.7); color: var(--text-muted); font-weight: 600; font-size: 0.9rem; border: 1px solid white; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); backdrop-filter: blur(10px); }
                .nav-item.active { background: var(--text-main); color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.15); border-color: transparent; transform: scale(1.05); }
                .difficulty-selector { margin: 0 20px 10px; text-align: right; }
                select { background: rgba(255, 255, 255, 0.8); border: 1px solid white; padding: 6px 12px; border-radius: 12px; color: var(--primary-dark); font-size: 0.9rem; font-weight: 600; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
                .game-status-bar { display: flex; align-items: center; justify-content: space-between; padding: 0 25px; margin-bottom: 15px; color: var(--text-main); font-size: 0.9rem; font-weight: 700; }
                .progress-bar-container { flex: 1; height: 8px; background: rgba(255,255,255,0.5); margin: 0 15px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.6); }
                .progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent)); transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); border-radius: 4px; }
                .game-card { background: var(--surface); margin: 0 20px; padding: 25px; border-radius: 30px; box-shadow: var(--shadow-lg); display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; overflow: hidden; border: 1px solid var(--glass-border); backdrop-filter: blur(25px); }
                .image-wrapper { width: 150px; height: 150px; border-radius: 24px; overflow: hidden; margin-bottom: 25px; box-shadow: 0 10px 20px rgba(0,0,0,0.1); border: 4px solid white; }
                .image-wrapper.small { width: 100px; height: 100px; }
                .section-header { margin: 0 0 10px; font-size: 0.8rem; text-transform: uppercase; color: var(--primary); letter-spacing: 1.5px; font-weight: 800; }
                .definition-body { font-size: 1.15rem; line-height: 1.6; margin: 0 0 15px; color: var(--text-main); font-weight: 500; }
                .phonetic-tag { display: inline-block; background: rgba(255,255,255,0.8); padding: 5px 12px; border-radius: 12px; font-family: 'Times New Roman', serif; font-style: italic; color: var(--primary-dark); border: 1px solid rgba(0,0,0,0.05); }
                .modern-input { font-size: 2rem; text-align: center; width: 100%; border: none; border-bottom: 3px solid #cbd5e1; padding: 10px; outline: none; background: transparent; text-transform: uppercase; letter-spacing: 4px; transition: all 0.3s; color: var(--primary-dark); font-weight: 700; }
                .modern-input:focus { border-color: var(--accent); }
                .big-play-btn { width: 70px; height: 70px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--accent)); color: white; border: none; font-size: 1.8rem; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 10px 25px var(--accent-glow); margin-bottom: 25px; transition: transform 0.1s; }
                .big-play-btn:active { transform: scale(0.92); }
                .btn { border: none; padding: 14px 28px; border-radius: 16px; font-weight: 700; cursor: pointer; font-size: 1rem; transition: all 0.2s; letter-spacing: 0.5px; }
                .btn-primary { background: linear-gradient(135deg, #1e293b, #0f172a); color: white; box-shadow: 0 5px 15px rgba(30, 41, 59, 0.3); }
                .btn-primary:active { transform: scale(0.97); }
                .btn-light { background: white; color: var(--primary-dark); box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
                .btn-text { background: transparent; color: var(--text-muted); }
                .btn.large { width: 100%; font-size: 1.1rem; padding: 18px; background: linear-gradient(135deg, var(--success), #059669); color: white; box-shadow: 0 5px 15px rgba(16, 185, 129, 0.4); }
                .action-buttons { display: flex; gap: 12px; width: 100%; justify-content: center; margin-top: 25px; }
                .slots-container { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 25px 0; }
                .slot { width: 48px; height: 48px; border-radius: 12px; background: rgba(255,255,255,0.4); border: 2px dashed #cbd5e1; }
                .slot.filled { border: none; background: transparent; }
                .tile { width: 48px; height: 48px; background: white; border-radius: 12px; border-bottom: 4px solid #cbd5e1; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.3rem; color: var(--text-main); position: relative; user-select: none; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.05); transition: transform 0.1s; }
                .tile:active { transform: translateY(3px); border-bottom-width: 1px; }
                .tile.won { background: #dcfce7; border-color: #22c55e; color: #15803d; }
                .tile.hint { background: #fef3c7; border-color: #fbbf24; }
                .tile .score { position: absolute; bottom: 3px; right: 3px; font-size: 0.65rem; color: var(--text-muted); font-weight: 600; }
                .rack { display: flex; justify-content: center; gap: 8px; padding: 20px; background: rgba(255, 255, 255, 0.9); border-radius: 24px; margin: 0 20px; box-shadow: var(--shadow-lg); position: relative; backdrop-filter: blur(20px); }
                .icon-btn { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); background: #f1f5f9; width: 32px; height: 32px; border-radius: 50%; border: none; font-size: 1.1rem; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
                .icon-btn:hover { background: var(--primary-light); color: white; }
                .phonetics-container { padding: 0 20px; }
                .section-title { font-size: 2rem; font-weight: 900; margin-bottom: 5px; color: var(--primary-dark); letter-spacing: -1px; }
                .phonetic-group { margin-bottom: 30px; }
                .group-title { font-size: 0.95rem; text-transform: uppercase; color: var(--primary); margin-bottom: 12px; letter-spacing: 1.2px; font-weight: 800; }
                .phonetics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(65px, 1fr)); gap: 12px; }
                .phonetic-card { background: rgba(255, 255, 255, 0.8); border: 1px solid white; border-radius: 16px; padding: 12px 6px; display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 10px rgba(0,0,0,0.03); }
                .phonetic-card:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 10px 20px rgba(124, 58, 237, 0.15); border-color: var(--primary-light); background: white; }
                .phonetic-card .symbol { font-size: 1.5rem; font-weight: 700; color: var(--text-main); }
                .phonetic-card .name { font-size: 0.75rem; color: var(--text-muted); margin-top: 6px; font-weight: 600; }
                .modal-overlay { position: fixed; inset: 0; background: rgba(30, 41, 59, 0.6); backdrop-filter: blur(8px); display: flex; align-items: flex-end; z-index: 100; }
                .modal-content { width: 100%; background: #ffffff; border-radius: 32px 32px 0 0; padding: 35px 25px; box-shadow: 0 -10px 50px rgba(0,0,0,0.2); animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
                .modal-symbol-container { display: flex; align-items: center; gap: 20px; }
                .modal-symbol { font-size: 3.5rem; margin: 0; line-height: 1; color: var(--primary); font-weight: 800; }
                .modal-audio-btn { width: 50px; height: 50px; border-radius: 50%; background: var(--primary); color: white; border: none; font-size: 1.4rem; cursor: pointer; box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3); transition: transform 0.1s; display: flex; align-items: center; justify-content: center; }
                .modal-audio-btn:active { transform: scale(0.9); }
                .modal-tags { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
                .tag { font-size: 0.75rem; padding: 6px 12px; border-radius: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
                .tag.neutral { background: #f1f5f9; color: var(--text-muted); }
                .examples-box { margin-top: 20px; }
                .chips { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
                .chip { background: white; border: 1px solid #e2e8f0; padding: 8px 16px; border-radius: 24px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.05); transition: all 0.2s; }
                .chip:active { transform: scale(0.95); background: var(--primary-light); color: white; }
                .close-btn { position: absolute; top: 20px; right: 20px; background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 50%; font-size: 1.4rem; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
                .animate-fade-in { animation: fadeIn 0.5s ease-out; }
                .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
                .loader-container { height: 200px; display: flex; align-items: center; justify-content: center; }
                .loader { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.3); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s infinite linear; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .feedback-message { min-height: 24px; color: var(--accent); font-weight: 800; text-align: center; margin-top: 15px; font-size: 1.1rem; text-shadow: 0 1px 2px rgba(255,255,255,0.8); }
                .card-center { background: rgba(255, 255, 255, 0.9); margin: 40px 20px; padding: 35px; border-radius: 30px; text-align: center; box-shadow: var(--shadow-lg); display: flex; flex-direction: column; gap: 20px; align-items: center; backdrop-filter: blur(20px); border: 1px solid white; }
                .code-display { font-size: 3.5rem; font-weight: 900; letter-spacing: 8px; color: var(--primary); margin: 15px 0; text-shadow: 2px 2px 0px rgba(0,0,0,0.05); }
                .list-container { width: 100%; display: flex; flex-direction: column; gap: 10px; }
                .list-item { display: flex; justify-content: space-between; padding: 15px; background: white; border-radius: 12px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
             `}</style>
             <header><h1>Lexicon</h1><div className="score-pill">{score} pts</div></header>
             <nav className="nav-pills">
                <button className={`nav-item ${mode === 'phonetics' ? 'active' : ''}`} onClick={() => setMode('phonetics')}>Sounds</button>
                <button className={`nav-item ${mode === 'scrabble' ? 'active' : ''}`} onClick={() => setMode('scrabble')}>Scrabble</button>
                <button className={`nav-item ${mode === 'spelling' ? 'active' : ''}`} onClick={() => setMode('spelling')}>Spelling</button>
                <button className={`nav-item ${mode === 'multiplayer' ? 'active' : ''}`} onClick={() => setMode('multiplayer')}>Multiplayer</button>
             </nav>
             {(mode === 'scrabble' || mode === 'spelling') && (
                 <div className="difficulty-selector">
                     <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}><option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option></select>
                 </div>
             )}
             <main>
                 {mode === 'phonetics' && <PhoneticsGuide />}
                 {mode === 'scrabble' && <ScrabbleGame difficulty={difficulty} onScoreUpdate={(p) => setScore(s => s + p)} />}
                 {mode === 'spelling' && <SpellingGame difficulty={difficulty} onScoreUpdate={(p) => setScore(s => s + p)} />}
                 {mode === 'multiplayer' && <MultiplayerGame difficulty={difficulty} />}
             </main>
        </div>
    );
};

const container = document.getElementById('app');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}