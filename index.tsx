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
    type: string; // Vowel, Consonant, Diphthong
    voiced?: boolean; // True if voiced, false if voiceless
    place?: string; // e.g., Bilabial
    manner?: string; // e.g., Stop
    examples: string[];
    description: string;
}

const PHONETICS_DATA: PhoneticEntry[] = [
    // Consonants - Stops
    { symbol: 'p', name: 'p', type: 'Consonant', voiced: false, place: 'Bilabial', manner: 'Stop', examples: ['pen', 'spin', 'tip', 'happy', 'pie'], description: 'Lips come together to block air, then release it.' },
    { symbol: 'b', name: 'b', type: 'Consonant', voiced: true, place: 'Bilabial', manner: 'Stop', examples: ['but', 'web', 'baby', 'boy', 'lab'], description: 'Like /p/, but vocal cords vibrate.' },
    { symbol: 't', name: 't', type: 'Consonant', voiced: false, place: 'Alveolar', manner: 'Stop', examples: ['two', 'sting', 'bet', 'ten', 'matter'], description: 'Tongue tip touches the ridge behind upper teeth.' },
    { symbol: 'd', name: 'd', type: 'Consonant', voiced: true, place: 'Alveolar', manner: 'Stop', examples: ['do', 'daddy', 'odd', 'dog', 'ladder'], description: 'Like /t/, but vocal cords vibrate.' },
    { symbol: 'k', name: 'k', type: 'Consonant', voiced: false, place: 'Velar', manner: 'Stop', examples: ['cat', 'kill', 'skin', 'queen', 'thick'], description: 'Back of tongue touches the soft palate.' },
    { symbol: 'g', name: 'g', type: 'Consonant', voiced: true, place: 'Velar', manner: 'Stop', examples: ['go', 'get', 'beg', 'green', 'egg'], description: 'Like /k/, but vocal cords vibrate.' },
    // Consonants - Fricatives
    { symbol: 'f', name: 'f', type: 'Consonant', voiced: false, place: 'Labiodental', manner: 'Fricative', examples: ['fool', 'enough', 'leaf', 'off', 'photo'], description: 'Top teeth touch bottom lip, air flows through.' },
    { symbol: 'v', name: 'v', type: 'Consonant', voiced: true, place: 'Labiodental', manner: 'Fricative', examples: ['voice', 'have', 'of', 'vase', 'never'], description: 'Like /f/, but vocal cords vibrate.' },
    { symbol: 'θ', name: 'theta', type: 'Consonant', voiced: false, place: 'Dental', manner: 'Fricative', examples: ['thing', 'teeth', 'with', 'thought', 'breath'], description: 'Tongue tip between teeth, air flows through.' },
    { symbol: 'ð', name: 'eth', type: 'Consonant', voiced: true, place: 'Dental', manner: 'Fricative', examples: ['this', 'breathe', 'father', 'they', 'smooth'], description: 'Like /θ/, but vocal cords vibrate.' },
    { symbol: 's', name: 's', type: 'Consonant', voiced: false, place: 'Alveolar', manner: 'Fricative', examples: ['see', 'city', 'pass', 'lesson', 'sun'], description: 'Air forces through narrow gap behind teeth.' },
    { symbol: 'z', name: 'z', type: 'Consonant', voiced: true, place: 'Alveolar', manner: 'Fricative', examples: ['zoo', 'rose', 'buzz', 'zip', 'easy'], description: 'Like /s/, but vocal cords vibrate.' },
    { symbol: 'ʃ', name: 'esh', type: 'Consonant', voiced: false, place: 'Post-alveolar', manner: 'Fricative', examples: ['she', 'sure', 'emotion', 'leash', 'ocean'], description: 'Tongue further back than /s/, lips rounded.' },
    { symbol: 'ʒ', name: 'yogh', type: 'Consonant', voiced: true, place: 'Post-alveolar', manner: 'Fricative', examples: ['pleasure', 'beige', 'vision', 'measure', 'genre'], description: 'Like /ʃ/, but vocal cords vibrate.' },
    { symbol: 'h', name: 'h', type: 'Consonant', voiced: false, place: 'Glottal', manner: 'Fricative', examples: ['ham', 'who', 'ahead', 'hi', 'house'], description: 'Air passes through open vocal cords.' },
    // Consonants - Affricates
    { symbol: 'tʃ', name: 'ch', type: 'Consonant', voiced: false, place: 'Post-alveolar', manner: 'Affricate', examples: ['chair', 'nature', 'teach', 'choose', 'watch'], description: 'Starts as /t/, releases as /ʃ/.' },
    { symbol: 'dʒ', name: 'j', type: 'Consonant', voiced: true, place: 'Post-alveolar', manner: 'Affricate', examples: ['gin', 'joy', 'edge', 'judge', 'age'], description: 'Starts as /d/, releases as /ʒ/.' },
    // Consonants - Nasals
    { symbol: 'm', name: 'm', type: 'Consonant', voiced: true, place: 'Bilabial', manner: 'Nasal', examples: ['man', 'ham', 'more', 'summer', 'room'], description: 'Lips closed, air goes through nose.' },
    { symbol: 'n', name: 'n', type: 'Consonant', voiced: true, place: 'Alveolar', manner: 'Nasal', examples: ['no', 'tin', 'know', 'funny', 'sun'], description: 'Tongue on ridge, air goes through nose.' },
    { symbol: 'ŋ', name: 'eng', type: 'Consonant', voiced: true, place: 'Velar', manner: 'Nasal', examples: ['sing', 'ring', 'finger', 'anger', 'thanks'], description: 'Back of tongue lifts, air goes through nose.' },
    // Consonants - Approximants
    { symbol: 'l', name: 'l', type: 'Consonant', voiced: true, place: 'Alveolar', manner: 'Lateral Approximant', examples: ['left', 'bell', 'table', 'like', 'feel'], description: 'Tongue touches ridge, air flows around sides.' },
    { symbol: 'r', name: 'r', type: 'Consonant', voiced: true, place: 'Alveolar', manner: 'Approximant', examples: ['run', 'very', 'bird', 'red', 'car'], description: 'Tongue curls back or bunches up.' },
    { symbol: 'w', name: 'w', type: 'Consonant', voiced: true, place: 'Velar', manner: 'Approximant', examples: ['we', 'queen', 'water', 'why', 'quick'], description: 'Lips rounded, back of tongue raises.' },
    { symbol: 'j', name: 'y', type: 'Consonant', voiced: true, place: 'Palatal', manner: 'Approximant', examples: ['yes', 'yellow', 'few', 'view', 'onion'], description: 'Tongue raises to hard palate.' },
    // Vowels - Monophthongs
    { symbol: 'iː', name: 'fleece', type: 'Vowel', voiced: true, place: 'Front Close', manner: 'Vowel', examples: ['see', 'heat', 'be', 'key', 'people'], description: 'Long vowel. Tongue high and front.' },
    { symbol: 'ɪ', name: 'kit', type: 'Vowel', voiced: true, place: 'Front Close-mid', manner: 'Vowel', examples: ['hit', 'sitting', 'gym', 'bit', 'in'], description: 'Short vowel. Slightly lower than /i:/.' },
    { symbol: 'e', name: 'dress', type: 'Vowel', voiced: true, place: 'Front Mid', manner: 'Vowel', examples: ['met', 'bed', 'bread', 'said', 'head'], description: 'Short vowel. Jaw drops slightly.' },
    { symbol: 'æ', name: 'trap', type: 'Vowel', voiced: true, place: 'Front Open', manner: 'Vowel', examples: ['cat', 'black', 'hand', 'laugh', 'apple'], description: 'Short vowel. Jaw open, tongue front.' },
    { symbol: 'ɑː', name: 'palm', type: 'Vowel', voiced: true, place: 'Back Open', manner: 'Vowel', examples: ['father', 'start', 'hard', 'car', 'heart'], description: 'Long vowel. Jaw open, tongue back.' },
    { symbol: 'ɒ', name: 'lot', type: 'Vowel', voiced: true, place: 'Back Open', manner: 'Vowel', examples: ['hot', 'rock', 'stop', 'want', 'wash'], description: 'Short vowel. Lips slightly rounded.' },
    { symbol: 'ɔː', name: 'thought', type: 'Vowel', voiced: true, place: 'Back Mid', manner: 'Vowel', examples: ['call', 'four', 'saw', 'walk', 'door'], description: 'Long vowel. Lips rounded.' },
    { symbol: 'ʊ', name: 'foot', type: 'Vowel', voiced: true, place: 'Back Close-mid', manner: 'Vowel', examples: ['put', 'could', 'book', 'look', 'good'], description: 'Short vowel. Lips rounded.' },
    { symbol: 'uː', name: 'goose', type: 'Vowel', voiced: true, place: 'Back Close', manner: 'Vowel', examples: ['blue', 'food', 'too', 'shoe', 'who'], description: 'Long vowel. Lips very rounded.' },
    { symbol: 'ʌ', name: 'strut', type: 'Vowel', voiced: true, place: 'Central Open-mid', manner: 'Vowel', examples: ['cup', 'luck', 'love', 'blood', 'up'], description: 'Short vowel. Relaxed jaw.' },
    { symbol: 'ɜː', name: 'nurse', type: 'Vowel', voiced: true, place: 'Central Mid', manner: 'Vowel', examples: ['bird', 'hurt', 'work', 'learn', 'first'], description: 'Long vowel. Neutral tongue position.' },
    { symbol: 'ə', name: 'schwa', type: 'Vowel', voiced: true, place: 'Central', manner: 'Vowel', examples: ['about', 'banana', 'the', 'sofa', 'arena'], description: 'The most common sound. Completely relaxed.' },
    // Diphthongs
    { symbol: 'eɪ', name: 'face', type: 'Diphthong', voiced: true, place: 'Moving', manner: 'Vowel', examples: ['say', 'eight', 'rain', 'break', 'day'], description: 'Glides from /e/ to /ɪ/.' },
    { symbol: 'aɪ', name: 'price', type: 'Diphthong', voiced: true, place: 'Moving', manner: 'Vowel', examples: ['my', 'sight', 'buy', 'eye', 'fly'], description: 'Glides from /a/ to /ɪ/.' },
    { symbol: 'ɔɪ', name: 'choice', type: 'Diphthong', voiced: true, place: 'Moving', manner: 'Vowel', examples: ['boy', 'join', 'toy', 'noise', 'oil'], description: 'Glides from /ɔ/ to /ɪ/.' },
    { symbol: 'uə', name: 'cure', type: 'Diphthong', voiced: true, place: 'Moving', manner: 'Vowel', examples: ['pure', 'tourist', 'cure', 'furious', 'security'], description: 'Glides from /ʊ/ to /ə/.' },
    { symbol: 'aʊ', name: 'mouth', type: 'Diphthong', voiced: true, place: 'Moving', manner: 'Vowel', examples: ['now', 'out', 'house', 'cow', 'loud'], description: 'Glides from /a/ to /ʊ/.' },
    { symbol: 'əʊ', name: 'goat', type: 'Diphthong', voiced: true, place: 'Moving', manner: 'Vowel', examples: ['no', 'go', 'stone', 'home', 'alone'], description: 'Glides from /ə/ to /ʊ/.' },
    { symbol: 'ɪə', name: 'near', type: 'Diphthong', voiced: true, place: 'Moving', manner: 'Vowel', examples: ['near', 'ear', 'here', 'clear', 'year'], description: 'Glides from /ɪ/ to /ə/.' },
    { symbol: 'eə', name: 'square', type: 'Diphthong', voiced: true, place: 'Moving', manner: 'Vowel', examples: ['hair', 'care', 'stair', 'where', 'air'], description: 'Glides from /e/ to /ə/.' }
];

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
    { word: "APPLE", phonetic: "/ˈæp.əl/", definition: "A round fruit with red or green skin and a whitish inside.", sentence: "She ate a red _____ for a snack." },
    { word: "BREAD", phonetic: "/bred/", definition: "Food made of flour, water, and yeast.", sentence: "He made a sandwich with whole wheat _____." },
    { word: "CHAIR", phonetic: "/tʃeər/", definition: "A separate seat for one person, typically with a back and four legs.", sentence: "Please sit in the _____." },
    { word: "DANCE", phonetic: "/dæns/", definition: "Move rhythmically to music.", sentence: "They like to _____ at parties." },
    { word: "HAPPY", phonetic: "/ˈhæp.i/", definition: "Feeling or showing pleasure or contentment.", sentence: "The puppy was _____ to see its owner." },
    // User Added Words (1-30) - Added Phonetics
    { word: "ABATE", phonetic: "/əˈbeɪt/", definition: "To reduce or lessen.", sentence: "The storm began to _____." },
    { word: "ABRIDGE", phonetic: "/əˈbrɪdʒ/", definition: "To shorten a text.", sentence: "He had to _____ his speech." },
    { word: "ACCENTUATE", phonetic: "/əkˈsɛntʃueɪt/", definition: "To emphasize.", sentence: "The dress helped _____ her figure." },
    { word: "AFFLUENT", phonetic: "/ˈæfluənt/", definition: "Rich, wealthy.", sentence: "They lived in an _____ neighborhood." },
    { word: "ALLUDE", phonetic: "/əˈluːd/", definition: "To indirectly refer to something.", sentence: "He did _____ to the problem." },
    { word: "AMELIORATE", phonetic: "/əˈmiːliəreɪt/", definition: "To make something better.", sentence: "Medicine can _____ pain." },
    { word: "APATHETIC", phonetic: "/ˌæpəˈθɛtɪk/", definition: "Not caring; showing little emotion.", sentence: "Voters were _____ about the election." },
    { word: "ARDUOUS", phonetic: "/ˈɑːrdʒuəs/", definition: "Very difficult or tiring.", sentence: "It was an _____ climb." },
    { word: "AUSPICIOUS", phonetic: "/ɔːˈspɪʃəs/", definition: "Favorable; showing good signs.", sentence: "It was an _____ start." },
    { word: "BANAL", phonetic: "/bəˈnɑːl/", definition: "Boring, not original.", sentence: "The conversation was _____." },
    { word: "BENIGN", phonetic: "/bɪˈnaɪn/", definition: "Harmless.", sentence: "The tumor was _____." },
    { word: "BOLSTER", phonetic: "/ˈboʊlstər/", definition: "To support or strengthen.", sentence: "We need to _____ morale." },
    { word: "CANDID", phonetic: "/ˈkændɪd/", definition: "Honest and truthful.", sentence: "To be _____, I don't like it." },
    { word: "CHRONICLE", phonetic: "/ˈkrɑːnɪkəl/", definition: "To record events in order.", sentence: "The book will _____ the war." },
    { word: "COHERENT", phonetic: "/koʊˈhɪərənt/", definition: "Clear and logical.", sentence: "He gave a _____ explanation." },
    { word: "COLLOQUIAL", phonetic: "/kəˈloʊkwiəl/", definition: "Informal language.", sentence: "It's a _____ expression." },
    { word: "CONCUR", phonetic: "/kənˈkɜːr/", definition: "To agree.", sentence: "I _____ with your opinion." },
    { word: "CONSPICUOUS", phonetic: "/kənˈspɪkjuəs/", definition: "Easily seen or noticed.", sentence: "He was _____ in a bright suit." },
    { word: "CURSORY", phonetic: "/ˈkɜːrsəri/", definition: "Quick and not detailed.", sentence: "A _____ glance." },
    { word: "DAUNTING", phonetic: "/ˈdɔːntɪŋ/", definition: "Intimidating; scary to start.", sentence: "The task was _____." },
    { word: "DEBILITATE", phonetic: "/dɪˈbɪlɪteɪt/", definition: "To weaken.", sentence: "The virus can _____ you." },
    { word: "DELINEATE", phonetic: "/dɪˈlɪnieɪt/", definition: "To describe clearly.", sentence: "The plan will _____ the steps." },
    { word: "DERIVE", phonetic: "/dɪˈraɪv/", definition: "To obtain from a source.", sentence: "We _____ pleasure from music." },
    { word: "DILIGENT", phonetic: "/ˈdɪlɪdʒənt/", definition: "Hardworking.", sentence: "She is a _____ student." },
    { word: "DISCERN", phonetic: "/dɪˈsɜːrn/", definition: "To notice or recognize.", sentence: "I could _____ a faint light." },
    { word: "DISCREET", phonetic: "/dɪˈskriːt/", definition: "Careful not to attract attention.", sentence: "Be _____ about the gift." },
    { word: "ELICIT", phonetic: "/ɪˈlɪsɪt/", definition: "To draw out (information or reaction).", sentence: "The joke failed to _____ a laugh." },
    { word: "ELUSIVE", phonetic: "/ɪˈluːsɪv/", definition: "Hard to find or catch.", sentence: "Success remained _____." },
    { word: "EMULATE", phonetic: "/ˈɛmjuleɪt/ ", definition: "To imitate to match or surpass.", sentence: "Sons often _____ their fathers." },
    { word: "ENIGMATIC", phonetic: "/ˌɛnɪɡˈmætɪk/", definition: "Mysterious.", sentence: "The Mona Lisa has an _____ smile." }
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
    { word: "ARBITRARY", phonetic: "/ˈɑːr.bə.trer.i/", definition: "Based on random choice, not reason.", sentence: "An _____ decision." },
    { word: "CONVENTIONAL", phonetic: "/kənˈven.ʃən.əl/", definition: "Normal, traditional.", sentence: "A _____ oven." },
    { word: "RELUCTANT", phonetic: "/rɪˈlʌk.tənt/", definition: "Not wanting to do something.", sentence: "He is _____ to go." },
    { word: "AMPLE", phonetic: "/ˈæm.pəl/", definition: "More than enough.", sentence: "There is _____ room." },
    { word: "BRITTLE", phonetic: "/ˈbrɪt.əl/", definition: "Easily broken.", sentence: "Dry twigs are _____." },
    { word: "PONDER", phonetic: "/ˈpɑːn.dɚ/", definition: "To think deeply.", sentence: "I need to _____ this." },
    { word: "RIGID", phonetic: "/ˈrɪdʒ.ɪd/", definition: "Not flexible.", sentence: "A _____ board." },
    { word: "TRIVIAL", phonetic: "/ˈtrɪv.i.əl/", definition: "Not important.", sentence: "A _____ mistake." },
    { word: "PROFOUND", phonetic: "/prəˈfaʊnd/", definition: "Deep or meaningful.", sentence: "A _____ silence." },
    { word: "CUMULATIVE", phonetic: "/ˈkjuː.mjə.lə.tɪv/", definition: "Increasing by adding over time.", sentence: "The _____ effect." }
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
    { word: "EQUANIMITY", phonetic: "/ˌiː.kwəˈnɪm.ə.t̬i/", definition: "Calmness under stress.", sentence: "She accepted it with _____." },
    { word: "HEGEMONY", phonetic: "/hɪˈdʒem.ə.ni/", definition: "Dominance or control over others.", sentence: "Cultural _____." },
    { word: "PERFUNCTORY", phonetic: "/pɚˈfʌŋk.tɚ.i/", definition: "Done quickly without care.", sentence: "A _____ greeting." },
    { word: "OBSTINATE", phonetic: "/ˈɑːb.stə.nət/", definition: "Stubborn and unwilling to change.", sentence: "An _____ child." },
    { word: "SARDONIC", phonetic: "/sɑːrˈdɑː.nɪk/", definition: "Mocking in a bitter way.", sentence: "A _____ smile." },
    { word: "RECALCITRANT", phonetic: "/rɪˈkæl.sɪ.trənt/", definition: "Refusing to obey rules.", sentence: "A _____ pupil." },
    { word: "SAGACIOUS", phonetic: "/səˈɡeɪ.ʃəs/", definition: "Wise and good at judging.", sentence: "A _____ leader." },
    { word: "INTRANSIGENT", phonetic: "/ɪnˈtræn.sə.dʒənt/", definition: "Refusing to compromise.", sentence: "They remained _____." },
    { word: "ANACHRONISTIC", phonetic: "/əˌnæk.rəˈnɪs.tɪk/", definition: "Out of its proper time period.", sentence: "That sword is _____." },
    { word: "PULCHRITUDE", phonetic: "/ˈpʌl.krə.tuːd/", definition: "Physical beauty.", sentence: "A woman of great _____." },
    { word: "DISPARATE", phonetic: "/ˈdɪs.pɚ.ət/", definition: "Very different; not related.", sentence: "Two _____ concepts." },
    { word: "MENDACIOUS", phonetic: "/menˈdeɪ.ʃəs/", definition: "Lying; not truthful.", sentence: "A _____ report." },
    { word: "INDEFATIGABLE", phonetic: "/ˌɪn.dɪˈfæt.ɪ.ɡə.bəl/", definition: "Never getting tired.", sentence: "An _____ worker." },
    { word: "EXTEMPORANEOUS", phonetic: "/ɪkˌstem.pəˈreɪ.ni.əs/", definition: "Spoken or done without preparation.", sentence: "An _____ speech." },
    { word: "QUINTESSENTIAL", phonetic: "/ˌkwɪn.tɪˈsen.ʃəl/", definition: "The purest example of something.", sentence: "The _____ English gentleman." },
    { word: "CONFLAGRATION", phonetic: "/ˌkɑːn.fləˈɡreɪ.ʃən/", definition: "A large, destructive fire.", sentence: "The city was destroyed by a _____." },
    { word: "INSCRUTABLE", phonetic: "/ɪnˈskruː.t̬ə.bəl/", definition: "Impossible to understand.", sentence: "An _____ face." },
    { word: "PUGNACIOUS", phonetic: "/pʌɡˈneɪ.ʃəs/", definition: "Eager to fight or argue.", sentence: "A _____ dog." },
    { word: "IMPETUOUS", phonetic: "/ɪmˈpetʃ.u.əs/", definition: "Acting quickly without thinking.", sentence: "An _____ decision." },
    { word: "INELUCTABLE", phonetic: "/ˌɪn.ɪˈlʌk.tə.bəl/", definition: "Unavoidable.", sentence: "The _____ end." },
    { word: "SUPERCILIOUS", phonetic: "/ˌsuː.pɚˈsɪl.i.əs/", definition: "Behaving as if better than others.", sentence: "A _____ waiter." },
    { word: "GRANDILOQUENT", phonetic: "/ɡrænˈdɪl.ə.kwənt/", definition: "Using fancy or exaggerated language.", sentence: "A _____ speech." },
    { word: "LUGUBRIOUS", phonetic: "/luːˈɡuː.bri.əs/", definition: "Sad and gloomy.", sentence: "A _____ expression." },
    { word: "INEFFABLE", phonetic: "/ˌɪnˈef.ə.bəl/", definition: "Too great to be described with words.", sentence: "Use _____ joy." },
    { word: "OBSEQUIOUS", phonetic: "/əbˈsiː.kwi.əs/", definition: "Too eager to please or obey.", sentence: "An _____ servant." },
    { word: "VICISSITUDE", phonetic: "/vɪˈsɪs.ə.tuːd/", definition: "A sudden change, usually unpleasant.", sentence: "The _____ of life." },
    { word: "ABSTRUSE", phonetic: "/æbˈstruːs/", definition: "Difficult to understand.", sentence: "An _____ theory." },
    { word: "RECONDITE", phonetic: "/ˈrek.ən.daɪt/", definition: "Little-known; obscure.", sentence: "A _____ subject." },
    { word: "CACOPHONY", phonetic: "/kəˈkɑː.fə.ni/", definition: "Harsh, unpleasant mixture of sounds.", sentence: "A _____ of horns." },
    { word: "PHLEGMATIC", phonetic: "/fleɡˈmæt.ɪk/", definition: "Calm and not easily excited.", sentence: "A _____ temperament." },
    { word: "OBDURATE", phonetic: "/ˈɑːb.dʊ.rət/", definition: "Very stubborn.", sentence: "He remained _____." },
    { word: "INIMICAL", phonetic: "/ɪˈnɪm.ɪ.kəl/", definition: "Harmful or unfriendly.", sentence: "Actions _____ to peace." },
    { word: "PERSPICACIOUS", phonetic: "/ˌpɝː.spəˈkeɪ.ʃəs/", definition: "Very smart; able to notice details.", sentence: "A _____ analysis." },
    { word: "MUNIFICENT", phonetic: "/mjuːˈnɪf.ə.sənt/", definition: "Extremely generous.", sentence: "A _____ donation." },
    { word: "PARSIMONIOUS", phonetic: "/ˌpɑːr.səˈmoʊ.ni.əs/", definition: "Very unwilling to spend money.", sentence: "A _____ old man." },
    { word: "IMPLACABLE", phonetic: "/ɪmˈplæk.ə.bəl/", definition: "Cannot be calmed or stopped.", sentence: "An _____ enemy." },
    { word: "SYCOPHANT", phonetic: "/ˈsɪk.ə.fænt/", definition: "Someone who flatters to gain favor.", sentence: "A brown-nosing _____." },
    { word: "ASSIDUOUS", phonetic: "/əˈsɪd.ju.əs/", definition: "Persistent and hardworking.", sentence: "An _____ student." },
    { word: "INSIDIOUS", phonetic: "/ɪnˈsɪd.i.əs/", definition: "Sneaky and harmful.", sentence: "An _____ disease." },
    { word: "PERIPATETIC", phonetic: "/ˌper.ə.pəˈtet.ɪk/", definition: "Traveling from place to place.", sentence: "A _____ teacher." },
    { word: "QUERULOUS", phonetic: "/ˈkwer.ə.ləs/", definition: "Always complaining.", sentence: "A _____ voice." },
    { word: "REPLETE", phonetic: "/rɪˈpliːt/", definition: "Completely filled.", sentence: "A room _____ with antiques." },
    { word: "TREPIDATION", phonetic: "/ˌtrep.əˈdeɪ.ʃən/", definition: "Fear or worry.", sentence: "With some _____." },
    { word: "AMBIVALENT", phonetic: "/æmˈbɪv.ə.lənt/", definition: "Having mixed feelings.", sentence: "She is _____ about the job." },
    { word: "JUXTAPOSE", phonetic: "/ˌdʒʌk.stəˈpoʊz/", definition: "To place side by side for comparison.", sentence: "To _____ two images." },
    { word: "IMPROVIDENT", phonetic: "/ɪmˈprɑː.və.dənt/", definition: "Not planning for the future.", sentence: "An _____ spender." },
    { word: "EXECRABLE", phonetic: "/ˈek.sə.krə.bəl/", definition: "Extremely bad.", sentence: "The food was _____." },
    { word: "OBVIATE", phonetic: "/ˈɑːb.vi.eɪt/", definition: "To remove a need or problem.", sentence: "This will _____ the delay." },
    { word: "VITRIOLIC", phonetic: "/ˌvɪt.riˈɑː.lɪk/", definition: "Extremely harsh or bitter.", sentence: "A _____ attack." },
    { word: "PUSILLANIMOUS", phonetic: "/ˌpjuː.səˈlæn.ə.məs/", definition: "Cowardly.", sentence: "A _____ leader." },
    // User Added Words (31-60)
    { word: "ERRATIC", phonetic: "/ɪˈrætɪk/", definition: "Unpredictable.", sentence: "His driving was ____." },
    { word: "EXACERBATE", phonetic: "/ɪɡˈzæsərbeɪt/", definition: "To make worse.", sentence: "Stress can ____ the pain." },
    { word: "FEASIBLE", phonetic: "/ˈfiːzəbl/", definition: "Possible or doable.", sentence: "The plan is ____." },
    { word: "FERVENT", phonetic: "/ˈfɜːrvənt/", definition: "Very passionate.", sentence: "A _____ supporter." },
    { word: "FRIVOLOUS", phonetic: "/ˈfrɪvələs/", definition: "Not serious; unimportant.", sentence: "A _____ lawsuit." },
    { word: "GALVANIZE", phonetic: "/ˈɡælvənaɪz/", definition: "To inspire to take action.", sentence: "The speech will _____ them." },
    { word: "GRAVITATE", phonetic: "/ˈɡrævɪteɪt/", definition: "To be drawn toward something.", sentence: "Kids _____ toward the toys." },
    { word: "IMMINENT", phonetic: "/ˈɪmɪnənt/", definition: "About to happen.", sentence: "The danger was _____." },
    { word: "IMPARTIAL", phonetic: "/ɪmˈpɑːrʃl/", definition: "Fair, not biased.", sentence: "An _____ judge." },
    { word: "IMPLICIT", phonetic: "/ɪmˈplɪsɪt/", definition: "Implied, not directly stated.", sentence: "An _____ agreement." },
    { word: "INCESSANT", phonetic: "/ɪnˈsɛsnt/", definition: "Nonstop.", sentence: "The _____ noise." },
    { word: "INCREDULOUS", phonetic: "/ɪnˈkrɛdʒələs/", definition: "Unable to believe.", sentence: "He looked _____." },
    { word: "INDOLENT", phonetic: "/ˈɪndələnt/", definition: "Lazy.", sentence: "An _____ employee." },
    { word: "INSINUATE", phonetic: "/ɪnˈsɪnjueɪt/", definition: "To hint something negative.", sentence: "What are you trying to _____?" },
    { word: "INSTIGATE", phonetic: "/ˈɪnstɪɡeɪt/", definition: "To start or provoke.", sentence: "To _____ a fight." },
    { word: "INTREPID", phonetic: "/ɪnˈtrepɪd/", definition: "Brave, fearless.", sentence: "An _____ explorer." },
    { word: "JUDICIOUS", phonetic: "/dʒuːˈdɪʃəs/", definition: "Wise, sensible.", sentence: "A _____ choice." },
    { word: "LUCID", phonetic: "/ˈluːsɪd/", definition: "Clear and easy to understand.", sentence: "A _____ explanation." },
    { word: "MEDIOCRE", phonetic: "/ˌmiːdiˈoʊkər/", definition: "Average, not very good.", sentence: "A _____ performance." },
    { word: "MITIGATE", phonetic: "/ˈmɪtɪɡeɪt/", definition: "To reduce the effect.", sentence: "To _____ the damage." },
    { word: "NOVEL", phonetic: "/ˈnɑːvəl/", definition: "New and original.", sentence: "A _____ idea." },
    { word: "OBSOLETE", phonetic: "/ˌɑːbsəˈliːt/", definition: "Outdated.", sentence: "The old machine is _____." },
    { word: "OMNIPRESENT", phonetic: "/ˌɑːmnɪˈpreznt/", definition: "Present everywhere.", sentence: "God is said to be _____." },
    { word: "PERPLEX", phonetic: "/pərˈpleks/", definition: "To confuse.", sentence: "The question did _____ him." },
    { word: "PRAGMATIC", phonetic: "/præɡˈmætɪk/", definition: "Practical.", sentence: "A _____ approach." },
    { word: "PROLIFIC", phonetic: "/prəˈlɪfɪk/", definition: "Highly productive.", sentence: "A _____ writer." },
    { word: "REITERATE", phonetic: "/riˈɪtəreɪt/", definition: "To repeat.", sentence: "Let me _____ that point." },
    { word: "RESILIENT", phonetic: "/rɪˈzɪliənt/", definition: "Able to recover quickly.", sentence: "She is very _____." },
    { word: "SCRUTINIZE", phonetic: "/ˈskruːtənaɪz/", definition: "To examine closely.", sentence: "To _____ the evidence." },
    { word: "TANGIBLE", phonetic: "/ˈtændʒəbl/", definition: "Something you can touch or handle.", sentence: "There is no _____ proof." }
  ]
};

// --- Shared Types & Helpers ---

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
  phonetic?: string; // Added field
}

interface SpellingState {
    data: SpellingWordData | null;
    input: string;
    status: 'loading' | 'playing' | 'won' | 'error';
    message: string;
    showDefinition: boolean;
    showSentence: boolean;
}

const SoundManager = {
  ctx: null as AudioContext | null,
  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
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
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 8, background: '#eee', position: 'relative' }}>
             {isRevealed ? (
                 <img 
                    src={src} 
                    onLoad={() => setLoaded(true)}
                    style={{
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                        opacity: loaded ? 1 : 0,
                        transition: 'opacity 0.3s'
                    }}
                />
             ) : (
                <div style={{width: '100%', height: '100%', display: 'flex', flexWrap: 'wrap'}}>
                    {tiles.map((tileIndex, i) => {
                        const row = Math.floor(tileIndex / 3);
                        const col = tileIndex % 3;
                        return (
                            <div key={i} style={{
                                width: '33.33%',
                                height: '33.33%',
                                backgroundImage: `url(${src})`,
                                backgroundPosition: `${col * 50}% ${row * 50}%`,
                                backgroundSize: '300% 300%',
                                boxSizing: 'border-box',
                                border: '1px solid #fff'
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

    return (
        <div className="phonetics-container">
            <h3 style={{textAlign: 'center', marginBottom: 20, color: 'var(--wood-dark)'}}>English Phonetic Reference</h3>
            <p style={{textAlign: 'center', marginBottom: 20, fontSize: '0.9rem', color: '#555'}}>Tap a symbol to see articulation details.</p>
            
            <div className="phonetics-grid">
                {PHONETICS_DATA.map((sound, idx) => (
                    <button 
                        key={idx} 
                        className={`phonetic-btn ${sound.type.toLowerCase()}`}
                        onClick={() => setSelectedSound(sound)}
                    >
                        {sound.symbol}
                    </button>
                ))}
            </div>

            {selectedSound && (
                <div className="modal-overlay" onClick={() => setSelectedSound(null)}>
                    <div className="definition-card modal-content" onClick={e => e.stopPropagation()}>
                        <h2 style={{fontSize: '3rem', margin: '0 0 10px 0', color: 'var(--accent)'}}>{selectedSound.symbol}</h2>
                        <div className="definition-label">{selectedSound.type}</div>
                        
                        <div style={{display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 15, flexWrap: 'wrap'}}>
                            <span className="badge">{selectedSound.voiced ? "Voiced 🔊" : "Voiceless 🔇"}</span>
                            {selectedSound.place && <span className="badge">{selectedSound.place}</span>}
                            {selectedSound.manner && <span className="badge">{selectedSound.manner}</span>}
                        </div>

                        <p className="definition-text" style={{fontSize: '1rem', marginBottom: 20}}>
                            {selectedSound.description}
                        </p>

                        <div style={{width: '100%', background: '#f5f5f5', padding: 10, borderRadius: 8}}>
                            <div className="definition-label" style={{marginBottom: 5}}>Examples</div>
                            <div style={{display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center'}}>
                                {selectedSound.examples.map((ex, i) => (
                                    <span key={i} style={{fontWeight: 'bold', color: 'var(--wood-dark)'}}>{ex}</span>
                                ))}
                            </div>
                        </div>

                        <button className="btn btn-secondary" style={{marginTop: 20}} onClick={() => setSelectedSound(null)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const ScrabbleGame = ({ difficulty, onScoreUpdate }: { difficulty: Difficulty, onScoreUpdate: (points: number) => void }) => {
  const [level, setLevel] = useState(1);
  const [wordProgress, setWordProgress] = useState(0);

  // Load level from storage
  useEffect(() => {
    const savedLevel = localStorage.getItem(`scrabble_level_${difficulty}`);
    const savedProgress = localStorage.getItem(`scrabble_progress_${difficulty}`);
    if (savedLevel) setLevel(parseInt(savedLevel));
    if (savedProgress) setWordProgress(parseInt(savedProgress));
  }, [difficulty]);

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
  const { maxLevels, wordsPerLevel } = LEVEL_CONFIG[difficulty];

  const fetchWord = useCallback(async () => {
    setState(prev => ({ ...prev, status: 'loading', message: '', placedTiles: [], rackTiles: [], word: '', definition: '', imageUrl: undefined, phonetic: undefined }));
    
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
            "phonetic": "/.../",
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
                 phonetic: { type: Type.STRING },
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
             const phonetic = data.phonetic;
             const tiles = generateTiles(word);
             
             seenWordsRef.current.push(word);
             
             setState(prev => ({
                ...prev,
                word: word,
                definition: def,
                phonetic: phonetic,
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
      phonetic: randomEntry.phonetic,
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

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newLevel = parseInt(e.target.value);
      setLevel(newLevel);
      setWordProgress(0);
      localStorage.setItem(`scrabble_level_${difficulty}`, newLevel.toString());
      localStorage.setItem(`scrabble_progress_${difficulty}`, '0');
      // Trigger a fresh word fetch
      setTimeout(fetchWord, 0); 
  };

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
    onScoreUpdate(-5);
    const { word, placedTiles, rackTiles } = state;
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
    const rackIndex = newRack.findIndex(t => t.letter === targetLetter);
    if (rackIndex !== -1) {
        tileToMove = newRack[rackIndex];
        newRack.splice(rackIndex, 1);
    } else {
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
            newRack.push(newPlaced[targetIndex]!);
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

  const handleLevelProgress = () => {
      let nextProgress = wordProgress + 1;
      let nextLevel = level;
      
      if (nextProgress >= wordsPerLevel) {
          nextLevel = Math.min(level + 1, maxLevels);
          nextProgress = 0;
      }
      
      setLevel(nextLevel);
      setWordProgress(nextProgress);
      localStorage.setItem(`scrabble_level_${difficulty}`, nextLevel.toString());
      localStorage.setItem(`scrabble_progress_${difficulty}`, nextProgress.toString());
  };

  const checkWin = (currentPlaced: (Tile | null)[], targetWord: string) => {
    if (currentPlaced.some(t => t === null)) return;
    const formedWord = currentPlaced.map(t => t?.letter).join('');
    if (formedWord === targetWord) {
      SoundManager.playWin();
      const wordScore = currentPlaced.reduce((acc, t) => acc + (t ? t.value : 0), 0);
      onScoreUpdate(wordScore);
      handleLevelProgress();
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
      <div className="level-bar">
          <div className="level-info">
              <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                  <span>Level</span>
                  <select 
                    value={level} 
                    onChange={handleLevelChange}
                    className="level-select-inline"
                  >
                    {Array.from({length: maxLevels}, (_, i) => i + 1).map(l => (
                        <option key={l} value={l}> {l} </option>
                    ))}
                  </select>
                  <span>/ {maxLevels}</span>
              </div>
              <span>Word {wordProgress + 1} / {wordsPerLevel}</span>
          </div>
          <div className="progress-track">
              <div className="progress-fill" style={{width: `${(wordProgress / wordsPerLevel) * 100}%`}}></div>
          </div>
      </div>

      <div className="definition-card">
        {state.imageUrl && (
            <div className="word-image-container" style={{width: 150, height: 150, margin: '0 auto 15px'}}>
                <ShuffledImage src={state.imageUrl} isRevealed={state.status === 'won'} />
            </div>
        )}
        <div className="definition-label">Definition</div>
        <div className="definition-text">{state.definition}</div>
        {state.phonetic && (
            <div className="phonetic-display" style={{marginTop: 10}}>
                {state.phonetic}
            </div>
        )}
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
  const [level, setLevel] = useState(1);
  const [wordProgress, setWordProgress] = useState(0);
  
  // Load level from storage
  useEffect(() => {
    const savedLevel = localStorage.getItem(`spelling_level_${difficulty}`);
    const savedProgress = localStorage.getItem(`spelling_progress_${difficulty}`);
    if (savedLevel) setLevel(parseInt(savedLevel));
    if (savedProgress) setWordProgress(parseInt(savedProgress));
  }, [difficulty]);

  const { maxLevels, wordsPerLevel } = LEVEL_CONFIG[difficulty];

  const [state, setState] = useState<SpellingState>({
    data: null,
    input: '',
    status: 'loading',
    message: '',
    showDefinition: false,
    showSentence: false
  });

  const seenWordsRef = useRef<string[]>([]);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name === "Google US English") || voices.find(v => v.lang.startsWith("en"));
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }, []);

  const fetchWord = useCallback(async () => {
    setState(prev => ({ ...prev, status: 'loading', message: '', input: '', showDefinition: false, showSentence: false, data: null }));

    if (process.env.API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const model = difficulty === 'Hard' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';
        
        const prompt = `
          Pick a single random English word for a spelling bee.
          Difficulty Level: ${difficulty}.
          ${difficulty === 'Easy' ? 'Word length 4-6 letters. Common words.' : ''}
          ${difficulty === 'Medium' ? 'Word length 6-10 letters. Standard vocabulary.' : ''}
          ${difficulty === 'Hard' ? 'Word length 10+ letters. Advanced, obscure, or tricky spelling words.' : ''}

          Do NOT use these words: ${seenWordsRef.current.slice(-20).join(', ')}.

          Return JSON format:
          {
            "word": "EXAMPLE",
            "phonetic": "/.../",
            "definition": "The definition...",
            "sentence": "A sentence using the word."
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
                 phonetic: { type: Type.STRING },
                 definition: { type: Type.STRING },
                 sentence: { type: Type.STRING }
               },
               required: ['word', 'definition', 'sentence']
             }
          }
        });
        
        const data = JSON.parse(response.text);
        
        if (data.word) {
             const wordData: SpellingWordData = {
                word: data.word.toUpperCase().trim(),
                phonetic: data.phonetic,
                definition: data.definition,
                sentence: data.sentence,
                imageUrl: getPollinationsImage(data.word)
             };
             
             seenWordsRef.current.push(wordData.word);

             setState(prev => ({
                ...prev,
                status: 'playing',
                data: wordData
             }));
             setTimeout(() => speak(wordData.word), 500);
             return;
        }

      } catch (e) {
        console.warn("API Error", e);
      }
    }

    // Fallback
    await new Promise(resolve => setTimeout(resolve, 500));
    const candidates = LOCAL_DICTIONARY[difficulty];
    const available = candidates.filter(c => !seenWordsRef.current.includes(c.word));
    const pool = available.length > 0 ? available : candidates;
    const randomEntry = pool[Math.floor(Math.random() * pool.length)];
    
    const wordData: SpellingWordData = {
        word: randomEntry.word.toUpperCase(),
        phonetic: randomEntry.phonetic,
        definition: randomEntry.definition,
        sentence: randomEntry.sentence,
        imageUrl: getPollinationsImage(randomEntry.word)
    };
    
    seenWordsRef.current.push(wordData.word);

    setState(prev => ({
      ...prev,
      status: 'playing',
      data: wordData
    }));
    setTimeout(() => speak(wordData.word), 500);

  }, [difficulty, speak]);

  useEffect(() => {
    fetchWord();
  }, [fetchWord]);

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newLevel = parseInt(e.target.value);
      setLevel(newLevel);
      setWordProgress(0);
      localStorage.setItem(`spelling_level_${difficulty}`, newLevel.toString());
      localStorage.setItem(`spelling_progress_${difficulty}`, '0');
      setTimeout(fetchWord, 0);
  };

  const handleLevelProgress = () => {
    let nextProgress = wordProgress + 1;
    let nextLevel = level;
    
    if (nextProgress >= wordsPerLevel) {
        nextLevel = Math.min(level + 1, maxLevels);
        nextProgress = 0;
    }
    
    setLevel(nextLevel);
    setWordProgress(nextProgress);
    localStorage.setItem(`spelling_level_${difficulty}`, nextLevel.toString());
    localStorage.setItem(`spelling_progress_${difficulty}`, nextProgress.toString());
  };

  const checkWord = () => {
      SoundManager.init();
      if (!state.data) return;
      if (state.input.toUpperCase().trim() === state.data.word) {
          SoundManager.playWin();
          const points = difficulty === 'Hard' ? 15 : difficulty === 'Medium' ? 10 : 5;
          onScoreUpdate(points);
          handleLevelProgress();
          setState(prev => ({ ...prev, status: 'won', message: `Correct! +${points} pts` }));
      } else {
          SoundManager.playError();
          setState(prev => ({ ...prev, message: 'Try again!' }));
          setTimeout(() => setState(prev => ({...prev, message: ''})), 1500);
      }
  };

  if (state.status === 'loading') return <div className="loader"></div>;

  return (
    <div className={`spelling-container ${state.status === 'won' ? 'won' : ''} ${state.message === 'Try again!' ? 'error' : ''}`}>
        
        <div className="level-bar" style={{width: '100%', marginBottom: 20}}>
            <div className="level-info" style={{color: '#555'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                  <span>Level</span>
                  <select 
                    value={level} 
                    onChange={handleLevelChange}
                    className="level-select-inline"
                    style={{color: '#333', borderColor: '#999'}}
                  >
                    {Array.from({length: maxLevels}, (_, i) => i + 1).map(l => (
                        <option key={l} value={l}> {l} </option>
                    ))}
                  </select>
                  <span>/ {maxLevels}</span>
                </div>
                <span>Word {wordProgress + 1} / {wordsPerLevel}</span>
            </div>
            <div className="progress-track" style={{background: '#ddd'}}>
                <div className="progress-fill" style={{width: `${(wordProgress / wordsPerLevel) * 100}%`, background: 'var(--accent)'}}></div>
            </div>
        </div>

        <div className="word-image-container">
            {state.data?.imageUrl && <ShuffledImage src={state.data.imageUrl} isRevealed={state.status === 'won'} />}
        </div>
        
        <div className="audio-btn-large" onClick={() => speak(state.data?.word || '')}>
             <span className="audio-icon">🔊</span>
        </div>
        
        {state.data?.phonetic && (
            <div className="phonetic-display">
                {state.data.phonetic}
            </div>
        )}

        <input 
            className="spelling-input"
            value={state.input}
            onChange={e => setState(prev => ({...prev, input: e.target.value}))}
            placeholder="SPELL IT"
            disabled={state.status === 'won'}
            onKeyDown={e => e.key === 'Enter' && checkWord()}
            autoFocus
        />

        <div className="message">{state.message}</div>
        
        <div className="hint-section">
             {state.showDefinition && (
                 <div className="hint-text">
                     <strong>Def:</strong> {state.data?.definition}
                 </div>
             )}
             {state.showSentence && state.data?.sentence && (
                 <div className="hint-text" style={{marginTop: 5}}>
                     <strong>Use:</strong> "{state.data.sentence.replace(new RegExp(state.data.word, 'gi'), '_____')}"
                 </div>
             )}
        </div>

        <div className="controls">
            {state.status === 'won' ? (
                <button className="btn btn-primary" onClick={fetchWord}>Next Word →</button>
            ) : (
                <>
                    <button className="btn btn-primary" onClick={checkWord}>Submit</button>
                    <button className="btn btn-hint" onClick={() => {
                        if (!state.showDefinition) setState(prev => ({...prev, showDefinition: true}));
                        else if (!state.showSentence) setState(prev => ({...prev, showSentence: true}));
                        else speak(state.data?.word || '');
                    }}>
                        {(!state.showDefinition) ? 'Hint: Def' : (!state.showSentence) ? 'Hint: Sentence' : 'Replay Audio'}
                    </button>
                    <button className="btn btn-secondary" onClick={fetchWord}>Skip</button>
                </>
            )}
        </div>
    </div>
  );
};

const MultiplayerGame = ({ difficulty }: { difficulty: Difficulty }) => {
    const [status, setStatus] = useState<'lobby' | 'hosting' | 'joining' | 'playing' | 'gameover'>('lobby');
    const [role, setRole] = useState<'host' | 'client' | null>(null);
    const [joinInput, setJoinInput] = useState('');
    const [connection, setConnection] = useState<any>(null); // For client
    const [peerId, setPeerId] = useState<string>('');
    const peerRef = useRef<any>(null);
    const hostConnectionsRef = useRef<Map<string, any>>(new Map()); // For host

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

    // Voice Logic
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

    // Peer Setup
    useEffect(() => {
        const id = Math.random().toString(36).substring(2, 6).toUpperCase();
        const setupPeer = () => {
             const peer = new Peer(id, { debug: 1 });
             peerRef.current = peer;
             peer.on('open', (id) => setPeerId(id));
             peer.on('error', (err) => {
                 console.error("Peer error:", err);
                 setMessage("Connection Error. Retrying...");
                 setTimeout(setupPeer, 2000);
             });
             peer.on('connection', (conn) => {
                 conn.on('open', () => {
                     if (role !== 'host' && status !== 'lobby') return;
                     handleNewConnection(conn, id);
                 });
             });
        };
        setupPeer();
        return () => peerRef.current?.destroy();
    }, []);

    const handleNewConnection = (conn: any, myId: string) => {
         setRole('host');
         setStatus('hosting');
         setGameState(prev => {
             if (prev.players.length >= 4) {
                 conn.send({ type: 'ERROR', message: 'Game Full' });
                 setTimeout(() => conn.close(), 500);
                 return prev;
             }
             if (prev.players.find(p => p.id === conn.peer)) return prev;
             const newPlayerName = `Player ${prev.players.length + 1}`;
             const newPlayer = { id: conn.peer, name: newPlayerName };
             hostConnectionsRef.current.set(conn.peer, conn);
             conn.on('data', (data: any) => {
                if (data.type === 'CLIENT_SUBMIT') {
                    handleWordSubmission(data.word, data.playerId);
                }
             });
             conn.on('close', () => {
                 hostConnectionsRef.current.delete(conn.peer);
             });
             let currentPlayers = [...prev.players];
             if (currentPlayers.length === 0) {
                 currentPlayers.push({ id: myId, name: "Host (You)" });
             }
             const nextPlayers = [...currentPlayers, newPlayer];
             const nextScores = { ...prev.scores, [newPlayer.id]: 0, [myId]: 0 }; 
             const newState = { ...prev, players: nextPlayers, scores: nextScores };
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

    // Host Logic
    useEffect(() => {
        if (role !== 'host' || status !== 'playing' || gameState.status !== 'playing') return;
        const timer = setInterval(() => {
            setGameState(prev => {
                if (prev.timeLeft <= 0) {
                    return handleTurnTimeout(prev);
                }
                const newState = { ...prev, timeLeft: prev.timeLeft - 1 };
                broadcastState(newState); 
                return newState;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [role, status, gameState.status]);

    const handleTurnTimeout = (prevState: GameState): GameState => {
        return switchTurn(prevState, false);
    };

    const switchTurn = (prev: GameState, success: boolean): GameState => {
        let nextState = { ...prev };
        const playerCount = prev.players.length;
        
        if (success) {
             const points = prev.phase === 'main' ? 10 : 5;
             const activePlayer = prev.players[prev.activePlayerIndex];
             const winnerId = prev.phase === 'main' ? activePlayer.id : prev.players[(prev.activePlayerIndex + 1) % playerCount].id;
             
             const newScore = (prev.scores[winnerId] || 0) + points;
             nextState.scores = { ...prev.scores, [winnerId]: newScore };
             
             // CHECK WIN CONDITION: 100 Points
             if (newScore >= 100) {
                 nextState.status = 'gameover';
             } else {
                 nextState.currentWordIndex += 1;
                 nextState.phase = 'main';
                 nextState.timeLeft = 30;
                 nextState.activePlayerIndex = (prev.activePlayerIndex + 1) % playerCount;
                 if (nextState.currentWordIndex >= nextState.words.length) {
                     nextState.status = 'gameover'; // Fallback
                 } else {
                     speak(nextState.words[nextState.currentWordIndex].word);
                 }
             }

        } else {
            if (prev.phase === 'main') {
                nextState.phase = 'steal';
                nextState.timeLeft = 30; 
            } else {
                nextState.currentWordIndex += 1;
                nextState.phase = 'main';
                nextState.timeLeft = 30;
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
             const playerCount = prev.players.length;
             const activeIdx = prev.activePlayerIndex;
             const stealIdx = (activeIdx + 1) % playerCount;
             let isTurn = false;
             if (prev.phase === 'main' && prev.players[activeIdx].id === submitterId) isTurn = true;
             if (prev.phase === 'steal' && prev.players[stealIdx].id === submitterId) isTurn = true;

             if (!isTurn) return prev; 
             const targetWord = prev.words[prev.currentWordIndex].word;
             const isCorrect = submittedWord.toUpperCase().trim() === targetWord;
             if (isCorrect) SoundManager.playWin(); else SoundManager.playError();
             return switchTurn(prev, isCorrect);
        });
        if (submitterId === peerId) {
            setInput('');
            setShowDef(false);
        }
    };

    const startGameHost = () => {
        const poolMedium = LOCAL_DICTIONARY['Medium'];
        const poolHard = LOCAL_DICTIONARY['Hard'];
        const combinedPool = [...poolMedium, ...poolHard];
        
        // Generate enough words for a race to 100 points
        const selected = [];
        for (let i = 0; i < 100; i++) {
            selected.push(combinedPool[Math.floor(Math.random() * combinedPool.length)]);
        }
        
        const currentPlayers = [...gameState.players];
        if (currentPlayers.length === 0 || currentPlayers[0].id !== peerId) {
             if (!currentPlayers.find(p => p.id === peerId)) {
                 currentPlayers.unshift({ id: peerId, name: "Host (You)" });
             }
        }
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

    // Client Logic
    const handleJoin = () => {
        if (!joinInput) return;
        const conn = peerRef.current.connect(joinInput.toUpperCase());
        conn.on('open', () => {
            setConnection(conn);
            setRole('client');
            setStatus('playing'); 
            conn.on('data', (data: any) => {
                if (data.type === 'STATE_UPDATE') setGameState(data.state);
                if (data.type === 'ERROR') {
                    setMessage(data.message);
                    setTimeout(() => setStatus('lobby'), 2000);
                }
            });
        });
        conn.on('error', () => setMessage("Could not connect."));
    };

    const submitWordClient = () => {
        if (connection) {
            connection.send({ type: 'CLIENT_SUBMIT', word: input, playerId: peerId });
            setInput('');
            setShowDef(false);
        }
    };
    
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
                
                <div style={{margin: '20px 0', borderTop: '1px solid #ddd', paddingTop: 20}}>
                     <label style={{fontSize: '1.2rem', fontWeight: 'bold', display: 'block', marginBottom: 10, color: 'var(--accent)'}}>
                         Goal: First to 100 pts wins!
                     </label>
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

    // 3. Joining Lobby (unchanged)
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

    // 4. Playing Game (unchanged render structure, just re-rendered for context)
    if (status === 'playing') {
        if (gameState.status === 'gameover') {
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
                        <ShuffledImage src={getPollinationsImage(currentWord.word)} isRevealed={false} />
                     ) : (
                         <div className="loader"></div>
                     )}
                </div>
                
                <div className="audio-btn-large" onClick={() => speak(currentWord?.word || '')} title="Play Word">
                     <span className="audio-icon">🔊</span>
                </div>
                
                {currentWord?.phonetic && (
                    <div className="phonetic-display">
                        {currentWord.phonetic}
                    </div>
                )}

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

const styles = `
  :root {
    --bg-color: #2e8b57;
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
  body { margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: var(--bg-color); color: var(--text-main); display: flex; justify-content: center; min-height: 100vh; overflow-x: hidden; }
  .app-container { width: 100%; max-width: 600px; display: flex; flex-direction: column; align-items: center; padding: 10px; box-sizing: border-box; }
  .nav-tabs { display: flex; width: 100%; margin-bottom: 20px; background: var(--tab-inactive); border-radius: 12px; padding: 5px; gap: 5px; flex-wrap: wrap; }
  .nav-tab { flex: 1; text-align: center; padding: 10px; cursor: pointer; border-radius: 8px; font-weight: bold; color: rgba(255,255,255,0.7); transition: all 0.2s; white-space: nowrap; }
  .nav-tab.active { background: var(--tab-active); color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
  .header { width: 100%; display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px; background: rgba(0, 0, 0, 0.2); padding: 15px 20px; border-radius: 12px; backdrop-filter: blur(5px); box-sizing: border-box; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; width: 100%; }
  .game-title { font-size: 1.5rem; font-weight: 800; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); letter-spacing: 1px; color: var(--accent); }
  .score-container { text-align: right; }
  .score-board { font-size: 1.2rem; font-weight: bold; color: white; }
  .high-score { font-size: 0.8rem; color: var(--accent); margin-top: 2px; font-weight: 600; }
  .level-selector { display: flex; gap: 10px; align-items: center; font-size: 0.9rem; color: rgba(255,255,255,0.8); flex-wrap: wrap; }
  .level-select { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-family: inherit; }
  .level-select:focus { outline: none; border-color: var(--accent); }
  .definition-card { background: white; color: #333; padding: 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); margin-bottom: 30px; width: 100%; text-align: center; position: relative; min-height: 100px; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; }
  .definition-label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 2px; color: #888; margin-bottom: 10px; }
  .definition-text { font-size: 1.2rem; line-height: 1.5; font-weight: 500; }
  .board-area { display: flex; gap: 8px; margin-bottom: 30px; flex-wrap: wrap; justify-content: center; min-height: 60px; }
  .slot { width: 48px; height: 48px; background: rgba(0,0,0,0.15); border-radius: 6px; border: 2px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
  .slot.filled { border-color: transparent; background: transparent; }
  .tile { width: 46px; height: 46px; background: var(--tile-color); border-radius: 6px; box-shadow: 0 4px 0 var(--tile-shadow), 0 5px 5px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; position: relative; color: #333; user-select: none; transform: translateY(0); transition: transform 0.1s, box-shadow 0.1s; cursor: pointer; z-index: 2; }
  .tile.locked { filter: brightness(0.95); cursor: default; }
  .tile:active { transform: translateY(4px); box-shadow: 0 0 0 var(--tile-shadow), 0 0 0 rgba(0,0,0,0); }
  .tile-letter { font-size: 1.5rem; font-weight: 700; line-height: 1; }
  .tile-score { position: absolute; bottom: 2px; right: 3px; font-size: 0.6rem; font-weight: 600; }
  .rack-container { background: linear-gradient(to bottom, var(--wood-color), var(--wood-dark)); padding: 15px 15px 20px; border-radius: 6px; box-shadow: 0 10px 20px rgba(0,0,0,0.4); display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; width: fit-content; min-width: 300px; min-height: 80px; align-items: center; margin-bottom: 30px; position: relative; box-sizing: border-box; }
  .rack-container::after { content: ''; position: absolute; bottom: -10px; left: 10px; right: 10px; height: 10px; background: rgba(0,0,0,0.3); border-radius: 50%; filter: blur(5px); z-index: -1; }
  .spelling-container { background: var(--spelling-bg); border-radius: 12px; padding: 30px; width: 100%; display: flex; flex-direction: column; align-items: center; box-shadow: 0 8px 16px rgba(0,0,0,0.2); box-sizing: border-box; position: relative; overflow: hidden; }
  .spelling-container.won { background: #d cedc8; }
  .spelling-container.error { animation: shake 0.5s; border: 2px solid var(--danger); }
  @keyframes shake { 0% { transform: translate(1px, 1px) rotate(0deg); } 10% { transform: translate(-1px, -2px) rotate(-1deg); } 20% { transform: translate(-3px, 0px) rotate(1deg); } 30% { transform: translate(3px, 2px) rotate(0deg); } 40% { transform: translate(1px, -1px) rotate(1deg); } 50% { transform: translate(-1px, 2px) rotate(-1deg); } 60% { transform: translate(-3px, 1px) rotate(0deg); } 70% { transform: translate(3px, 1px) rotate(-1deg); } 80% { transform: translate(-1px, -1px) rotate(1deg); } 90% { transform: translate(1px, 2px) rotate(0deg); } 100% { transform: translate(1px, -2px) rotate(-1deg); } }
  .audio-btn-large { width: 60px; height: 60px; border-radius: 50%; background: var(--wood-color); border: 3px solid #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.3); margin-bottom: 15px; transition: transform 0.1s, background 0.2s; }
  .audio-btn-large:active { transform: scale(0.95); }
  .audio-btn-large:hover { background: var(--wood-dark); }
  .audio-icon { font-size: 2rem; color: white; }
  .word-image-container { width: 200px; height: 200px; background: rgba(255,255,255,0.5); border-radius: 12px; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 4px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.2); position: relative; flex-shrink: 0; }
  .word-image { width: 100%; height: 100%; object-fit: cover; }
  .image-placeholder { font-size: 3rem; opacity: 0.5; }
  .phonetic-display { font-family: 'Lucida Sans Unicode', 'Arial Unicode MS', 'sans-serif'; font-size: 1.2rem; color: #5d4037; background: rgba(255, 255, 255, 0.4); padding: 4px 12px; border-radius: 12px; margin-bottom: 25px; font-style: italic; }
  .spelling-input { width: 100%; max-width: 300px; padding: 15px; font-size: 2rem; text-align: center; border: none; border-bottom: 3px solid var(--wood-color); background: transparent; color: var(--wood-dark); font-family: 'Courier New', monospace; font-weight: bold; letter-spacing: 5px; outline: none; text-transform: uppercase; margin-bottom: 20px; }
  .spelling-input::placeholder { color: rgba(0,0,0,0.2); letter-spacing: 0; }
  .hint-section { width: 100%; text-align: center; margin-bottom: 20px; min-height: 60px; display: flex; flex-direction: column; justify-content: center; align-items: center; }
  .hint-text { color: var(--wood-dark); font-style: italic; font-size: 1.1rem; background: rgba(255,255,255,0.5); padding: 10px; border-radius: 8px; max-width: 90%; }
  .word-reveal { font-size: 2rem; color: var(--bg-color); font-weight: bold; margin-bottom: 20px; text-shadow: 1px 1px 0 #fff; }
  .controls { display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; width: 100%; }
  .btn { padding: 12px 24px; border: none; border-radius: 25px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: transform 0.1s, opacity 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; gap: 8px; }
  .btn:active { transform: scale(0.95); }
  .btn-primary { background: var(--accent); color: #3e2700; }
  .btn-secondary { background: #ffffff; color: var(--wood-dark); border: 1px solid var(--wood-color); }
  .btn-hint { background: #ffb74d; color: #4e342e; }
  .btn-audio-small { background: var(--wood-color); color: white; padding: 8px 16px; font-size: 0.9rem; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .message { height: 20px; margin-bottom: 10px; color: var(--accent); font-weight: bold; text-align: center; }
  .loader { width: 30px; height: 30px; border: 4px solid #fff; border-bottom-color: transparent; border-radius: 50%; animation: rotation 1s linear infinite; margin: 40px auto; }
  @keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  .api-warning { background: #ff5252; color: white; padding: 10px; border-radius: 8px; margin-top: 20px; text-align: center; max-width: 400px; }
  .shuffle-btn { position: absolute; right: -40px; top: 50%; transform: translateY(-50%); background: none; border: none; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 1.5rem; }
  .shuffle-btn:hover { color: white; }
  .seen-count { position: absolute; bottom: -25px; right: 0; font-size: 0.7rem; color: rgba(255,255,255,0.5); }
  .lobby-card { background: white; border-radius: 12px; padding: 30px; width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); color: #333; text-align: center; }
  .lobby-input { width: 100%; padding: 12px; font-size: 1.2rem; border: 2px solid #ccc; border-radius: 8px; text-align: center; text-transform: uppercase; letter-spacing: 3px; box-sizing: border-box; }
  .lobby-code { font-size: 3rem; font-weight: 800; letter-spacing: 5px; color: var(--wood-color); margin: 10px 0; user-select: all; }
  .player-list { display: flex; flex-direction: column; gap: 10px; width: 100%; margin-bottom: 20px; }
  .player-row { display: flex; justify-content: space-between; align-items: center; background: #f0f0f0; padding: 8px 15px; border-radius: 8px; font-weight: bold; }
  .player-row.active { background: var(--accent); color: #3e2700; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
  .opponent-view { margin-top: 20px; padding-top: 20px; border-top: 2px dashed rgba(255,255,255,0.3); width: 100%; text-align: center; opacity: 0.7; }
  
  /* New Styles */
  .level-bar { background: rgba(0,0,0,0.2); border-radius: 8px; padding: 10px; margin-bottom: 20px; width: 100%; box-sizing: border-box; }
  .level-info { display: flex; justify-content: space-between; font-weight: bold; color: white; margin-bottom: 5px; font-size: 0.9rem; }
  .progress-track { background: rgba(255,255,255,0.2); height: 8px; border-radius: 4px; overflow: hidden; }
  .progress-fill { height: 100%; background: var(--accent); transition: width 0.3s ease; }
  
  .phonetics-container { background: white; border-radius: 12px; padding: 20px; width: 100%; box-sizing: border-box; }
  .phonetics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)); gap: 10px; width: 100%; }
  .phonetic-btn { aspect-ratio: 1; border: 1px solid #ddd; background: #fff; font-family: sans-serif; font-size: 1.2rem; font-weight: bold; color: #333; cursor: pointer; border-radius: 8px; transition: all 0.2s; }
  .phonetic-btn:hover { transform: scale(1.1); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
  .phonetic-btn.consonant { border-bottom: 3px solid #64b5f6; }
  .phonetic-btn.vowel { border-bottom: 3px solid #81c784; }
  .phonetic-btn.diphthong { border-bottom: 3px solid #ba68c8; }
  
  .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(2px); padding: 20px; }
  .modal-content { max-width: 400px; margin: 0; animation: pop 0.3s ease-in-out; }
  .badge { display: inline-block; background: #eee; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; color: #555; font-weight: bold; }

  .level-select-inline {
      background: rgba(255,255,255,0.3);
      border: 1px solid rgba(255,255,255,0.4);
      color: inherit;
      font-family: inherit;
      font-weight: bold;
      border-radius: 4px;
      padding: 2px 5px;
      cursor: pointer;
      font-size: 0.9rem;
  }
  .level-select-inline option {
      color: #333;
      background: white;
  }

  @keyframes pop { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
  .win-anim { animation: pop 0.3s ease-in-out; }
`;

const App = () => {
  const [view, setView] = useState<GameMode>('phonetics'); // Changed default to show phonetics first as requested by "add a section before"
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
      <Analytics />
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
            <div className={`nav-tab ${view === 'phonetics' ? 'active' : ''}`} onClick={() => setView('phonetics')}>
                Sounds
            </div>
            <div className={`nav-tab ${view === 'scrabble' ? 'active' : ''}`} onClick={() => setView('scrabble')}>
                Definition Game
            </div>
            <div className={`nav-tab ${view === 'spelling' ? 'active' : ''}`} onClick={() => setView('spelling')}>
                Spelling Bee
            </div>
            <div className={`nav-tab ${view === 'multiplayer' ? 'active' : ''}`} onClick={() => setView('multiplayer')}>
                Multiplayer
            </div>
        </div>

        {view === 'phonetics' ? (
            <PhoneticsGuide />
        ) : view === 'scrabble' ? (
            <ScrabbleGame difficulty={difficulty} onScoreUpdate={updateScore} />
        ) : view === 'spelling' ? (
            <SpellingGame difficulty={difficulty} onScoreUpdate={updateScore} />
        ) : (
            <MultiplayerGame difficulty={difficulty} />
        )}

      </div>
    </>
  );
};

const root = createRoot(document.getElementById('app')!);
root.render(<App />);