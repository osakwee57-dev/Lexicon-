import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { Peer } from 'peerjs';

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
    { word: "MAGNET", definition: "A material that exhibits properties of magnetism." },
    // User Added Words
    { word: "AMBIGUOUS", definition: "Not clear; can have more than one meaning." },
    { word: "CONCUR", definition: "To agree." },
    { word: "PLAUSIBLE", definition: "Seems possible or believable." },
    { word: "INEVITABLE", definition: "Cannot be avoided." },
    { word: "METICULOUS", definition: "Very careful with details." },
    { word: "TEDIOUS", definition: "Boring and long." },
    { word: "FEASIBLE", definition: "Possible to do." },
    { word: "DILIGENT", definition: "Hardworking." },
    { word: "VIVID", definition: "Clear and bright." },
    { word: "CANDID", definition: "Honest and direct." },
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
    { word: "IRRATIONAL", definition: "Not logical." },
    { word: "BRITTLE", definition: "Easily broken." },
    { word: "PONDER", definition: "To think deeply." },
    { word: "VIABLE", definition: "Workable; able to succeed." },
    { word: "ERRATIC", definition: "Unpredictable." },
    { word: "RIGID", definition: "Not flexible." },
    { word: "TRIVIAL", definition: "Not important." },
    { word: "PROFOUND", definition: "Deep or meaningful." },
    { word: "CUMULATIVE", definition: "Increasing by adding over time." },
    { word: "IMMINENT", definition: "About to happen soon." }
  ],
  Hard: [
    { word: "ECLIPSE", definition: "An obscuring of the light from one celestial body by another." },
    { word: "GLACIER", definition: "A slowly moving mass of ice formed by the accumulation of snow." },
    { word: "LABYRINTH", definition: "A complicated irregular network of passages; a maze." },
    { word: "PHOENIX", definition: "A mythical bird that regenerates from its own ashes." },
    { word: "SYMPHONY", definition: "An elaborate musical composition for full orchestra." },
    // 60 New Hard Words
    { word: "OBFUSCATE", definition: "To make something unclear." },
    { word: "PERNICIOUS", definition: "Harmful in a subtle way." },
    { word: "UBIQUITOUS", definition: "Found everywhere." },
    { word: "EPHEMERAL", definition: "Lasting for a very short time." },
    { word: "VOCIFEROUS", definition: "Loud and forceful." },
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
    { word: "INTREPID", definition: "Fearless and brave." },
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
    { word: "PUSILLANIMOUS", definition: "Cowardly." }
  ]
};

// Fallback Dictionary for Offline/Error Mode (Spelling)
interface SpellingWordData {
    word: string;
    definition: string;
    sentence: string;
    phonetic: string;
    imageUrl?: string;
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
        { word: "FOREST", phonetic: "/ˈfɔːrɪst/", definition: "A large area covered chiefly with trees and undergrowth.", sentence: "Bears live deep in the ____." },
        // User Added Words
        { word: "AMBIGUOUS", phonetic: "/æmˈbɪɡjuəs/", definition: "Not clear; can have more than one meaning.", sentence: "The ending of the movie was ____." },
        { word: "CONCUR", phonetic: "/kənˈkɜːr/", definition: "To agree.", sentence: "I ____ with your opinion on this matter." },
        { word: "PLAUSIBLE", phonetic: "/ˈplɔːzəbl/", definition: "Seems possible or believable.", sentence: "His excuse for being late sounded ____." },
        { word: "INEVITABLE", phonetic: "/ɪˈnɛvɪtəbl/", definition: "Cannot be avoided.", sentence: "Change is ____ in life." },
        { word: "METICULOUS", phonetic: "/məˈtɪkjələs/", definition: "Very careful with details.", sentence: "She was ____ in her research." },
        { word: "TEDIOUS", phonetic: "/ˈtiːdiəs/", definition: "Boring and long.", sentence: "The data entry job was repetitive and ____." },
        { word: "FEASIBLE", phonetic: "/ˈfiːzəbl/", definition: "Possible to do.", sentence: "The plan seems perfectly ____ given our budget." },
        { word: "DILIGENT", phonetic: "/ˈdɪlɪdʒənt/", definition: "Hardworking.", sentence: "The student was ____ in her studies." },
        { word: "VIVID", phonetic: "/ˈvɪvɪd/", definition: "Clear and bright.", sentence: "She had ____ memories of her childhood." },
        { word: "CANDID", phonetic: "/ˈkændɪd/", definition: "Honest and direct.", sentence: "He gave a ____ interview about his struggles." },
        { word: "HOSTILE", phonetic: "/ˈhɒstaɪl/", definition: "Unfriendly or aggressive.", sentence: "The crowd became ____ towards the referee." },
        { word: "SUBTLE", phonetic: "/ˈsʌtl/", definition: "Not obvious.", sentence: "There was a ____ hint of lemon in the cake." },
        { word: "INFER", phonetic: "/ɪnˈfɜːr/", definition: "To conclude from clues.", sentence: "What can you ____ from this evidence?" },
        { word: "MUNDANE", phonetic: "/mʌnˈdeɪn/", definition: "Ordinary, not exciting.", sentence: "He wanted to escape his ____ daily routine." },
        { word: "REFRAIN", phonetic: "/rɪˈfreɪn/", definition: "To stop yourself from doing something.", sentence: "Please ____ from talking during the show." },
        { word: "ADEQUATE", phonetic: "/ˈædɪkwət/", definition: "Good enough.", sentence: "The food supply was ____ for the weekend trip." },
        { word: "ARBITRARY", phonetic: "/ˈɑːrbɪtrəri/", definition: "Based on random choice, not reason.", sentence: "The decision to paint it red seemed ____." },
        { word: "CONVENTIONAL", phonetic: "/kənˈvɛnʃənl/", definition: "Normal, traditional.", sentence: "He challenged ____ wisdom." },
        { word: "RELUCTANT", phonetic: "/rɪˈlʌktənt/", definition: "Not wanting to do something.", sentence: "She was ____ to leave the party so early." },
        { word: "AMPLE", phonetic: "/ˈæmpl/", definition: "More than enough.", sentence: "There is ____ time to finish the exam." },
        { word: "IRRATIONAL", phonetic: "/ɪˈræʃənl/", definition: "Not logical.", sentence: "He had an ____ fear of spiders." },
        { word: "BRITTLE", phonetic: "/ˈbrɪtl/", definition: "Easily broken.", sentence: "Dry twigs are very ____." },
        { word: "PONDER", phonetic: "/ˈpɒndər/", definition: "To think deeply.", sentence: "He sat by the lake to ____ his future." },
        { word: "VIABLE", phonetic: "/ˈvaɪəbl/", definition: "Workable; able to succeed.", sentence: "Solar power is a ____ energy source." },
        { word: "ERRATIC", phonetic: "/ɪˈrætɪk/", definition: "Unpredictable.", sentence: "The car's movement was ____ before it stopped." },
        { word: "RIGID", phonetic: "/ˈrɪdʒɪd/", definition: "Not flexible.", sentence: "The rules were too ____ to allow for exceptions." },
        { word: "TRIVIAL", phonetic: "/ˈtrɪviəl/", definition: "Not important.", sentence: "They argued over ____ details." },
        { word: "PROFOUND", phonetic: "/prəˈfaʊnd/", definition: "Deep or meaningful.", sentence: "The book had a ____ impact on my life." },
        { word: "CUMULATIVE", phonetic: "/ˈkjuːmjələtɪv/", definition: "Increasing by adding over time.", sentence: "The ____ effect of lack of sleep is dangerous." },
        { word: "IMMINENT", phonetic: "/ˈɪmɪnənt/", definition: "About to happen soon.", sentence: "Dark clouds suggested a storm was ____." }
    ],
    Hard: [
        { word: "PHARAOH", phonetic: "/ˈfeəroʊ/", definition: "A ruler in ancient Egypt.", sentence: "The ____ ordered the construction of a pyramid." },
        { word: "CONSCIENCE", phonetic: "/ˈkɒnʃəns/", definition: "An inner feeling or voice viewed as acting as a guide to the rightness or wrongness of one's behavior.", sentence: "His ____ wouldn't let him lie." },
        { word: "QUARANTINE", phonetic: "/ˈkwɔːrəntiːn/", definition: "A state, period, or place of isolation in which people or animals that have arrived from elsewhere or been exposed to infectious or contagious disease are placed.", sentence: "The astronauts were put in ____ after returning to Earth." },
        { word: "HIEROGLYPH", phonetic: "/ˈhaɪərəɡlɪf/", definition: "A stylized picture of an object representing a word, syllable, or sound, as found in ancient Egyptian writing.", sentence: "The archaeologist deciphered the ancient ____." },
        { word: "CHRYSANTHEMUM", phonetic: "/krɪˈsænθəməm/", definition: "A popular plant of the daisy family, having brightly colored ornamental flowers.", sentence: "She planted a yellow ____ in the garden." },
        { word: "SOLILOQUY", phonetic: "/səˈlɪləkwi/", definition: "An act of speaking one's thoughts aloud when by oneself or regardless of any hearers.", sentence: "Hamlet's famous ____ begins with 'To be, or not to be'." },
        { word: "LIEUTENANT", phonetic: "/lɛfˈtɛnənt/", definition: "A deputy or substitute acting for a superior.", sentence: "The ____ took command when the captain fell ill." },
        // 60 New Hard Words
        { word: "OBFUSCATE", phonetic: "/ˈɒbfʌskeɪt/", definition: "To make something unclear.", sentence: "The writer used complex words to ____ the meaning." },
        { word: "PERNICIOUS", phonetic: "/pərˈnɪʃəs/", definition: "Harmful in a subtle way.", sentence: "The ____ rumors damaged his reputation." },
        { word: "UBIQUITOUS", phonetic: "/juːˈbɪkwɪtəs/", definition: "Found everywhere.", sentence: "Smartphones have become ____ in modern society." },
        { word: "EPHEMERAL", phonetic: "/əˈfɛmərəl/", definition: "Lasting for a very short time.", sentence: "Fashion trends are often ____." },
        { word: "VOCIFEROUS", phonetic: "/voʊˈsɪfərəs/", definition: "Loud and forceful.", sentence: "The crowd was ____ in their support." },
        { word: "MAGNANIMOUS", phonetic: "/mæɡˈnænɪməs/", definition: "Very generous and forgiving.", sentence: "He was ____ in victory, shaking his opponent's hand." },
        { word: "ESOTERIC", phonetic: "/ˌɛsəˈtɛrɪk/", definition: "Known only by a small group.", sentence: "The professor's lecture was on an ____ topic." },
        { word: "FASTIDIOUS", phonetic: "/fæˈstɪdiəs/", definition: "Very picky; hard to please.", sentence: "She is ____ about keeping the house clean." },
        { word: "BELLIGERENT", phonetic: "/bəˈlɪdʒərənt/", definition: "Aggressive or ready to fight.", sentence: "The drunk man became ____." },
        { word: "EQUANIMITY", phonetic: "/ˌiːkwəˈnɪmɪti/", definition: "Calmness under stress.", sentence: "She accepted the bad news with ____." },
        { word: "HEGEMONY", phonetic: "/hɪˈdʒɛməni/", definition: "Dominance or control over others.", sentence: "The empire maintained its ____ over the region." },
        { word: "PERFUNCTORY", phonetic: "/pərˈfʌŋktəri/", definition: "Done quickly without care.", sentence: "He gave a ____ nod as he passed." },
        { word: "OBSTINATE", phonetic: "/ˈɒbstɪnət/", definition: "Stubborn and unwilling to change.", sentence: "The ____ child refused to eat his vegetables." },
        { word: "SARDONIC", phonetic: "/sɑːrˈdɒnɪk/", definition: "Mocking in a bitter way.", sentence: "He gave a ____ smile." },
        { word: "RECALCITRANT", phonetic: "/rɪˈkælsɪtrənt/", definition: "Refusing to obey rules.", sentence: "The ____ student was sent to the principal." },
        { word: "SAGACIOUS", phonetic: "/səˈɡeɪʃəs/", definition: "Wise and good at judging.", sentence: "The ____ old man gave wise advice." },
        { word: "INTRANSIGENT", phonetic: "/ɪnˈtrænsɪdʒənt/", definition: "Refusing to compromise.", sentence: "The union was ____ in its demands." },
        { word: "ANACHRONISTIC", phonetic: "/əˌnækrəˈnɪstɪk/", definition: "Out of its proper time period.", sentence: "Sword fighting in a sci-fi movie felt ____." },
        { word: "PULCHRITUDE", phonetic: "/ˈpʌlkrɪtjuːd/", definition: "Physical beauty.", sentence: "The poem described the ____ of the landscape." },
        { word: "DISPARATE", phonetic: "/ˈdɪspərət/", definition: "Very different; not related.", sentence: "They have ____ views on politics." },
        { word: "MENDACIOUS", phonetic: "/mɛnˈdeɪʃəs/", definition: "Lying; not truthful.", sentence: "The ____ report was full of errors." },
        { word: "INDEFATIGABLE", phonetic: "/ˌɪndɪˈfætɪɡəbl/", definition: "Never getting tired.", sentence: "The ____ runner kept going for miles." },
        { word: "EXTEMPORANEOUS", phonetic: "/ɪkˌstɛmpəˈreɪniəs/", definition: "Spoken or done without preparation.", sentence: "He gave an ____ speech." },
        { word: "QUINTESSENTIAL", phonetic: "/ˌkwɪntɪˈsɛnʃl/", definition: "The purest example of something.", sentence: "It was the ____ example of a romantic comedy." },
        { word: "CONFLAGRATION", phonetic: "/ˌkɒnfləˈɡreɪʃn/", definition: "A large, destructive fire.", sentence: "The ____ destroyed the entire forest." },
        { word: "INSCRUTABLE", phonetic: "/ɪnˈskruːtəbl/", definition: "Impossible to understand.", sentence: "His face was ____, showing no emotion." },
        { word: "PUGNACIOUS", phonetic: "/pʌɡˈneɪʃəs/", definition: "Eager to fight or argue.", sentence: "The ____ dog barked at everyone." },
        { word: "IMPETUOUS", phonetic: "/ɪmˈpɛtʃuəs/", definition: "Acting quickly without thinking.", sentence: "It was an ____ decision to buy the car." },
        { word: "INELUCTABLE", phonetic: "/ˌɪnɪˈlʌktəbl/", definition: "Unavoidable.", sentence: "The ____ conclusion was that they had lost." },
        { word: "SUPERCILIOUS", phonetic: "/ˌsuːpərˈsɪliəs/", definition: "Behaving as if better than others.", sentence: "The ____ waiter looked down on us." },
        { word: "GRANDILOQUENT", phonetic: "/ɡrænˈdɪləkwənt/", definition: "Using fancy or exaggerated language.", sentence: "His ____ speech bored the audience." },
        { word: "INTREPID", phonetic: "/ɪnˈtrɛpɪd/", definition: "Fearless and brave.", sentence: "The ____ explorer climbed the mountain." },
        { word: "LUGUBRIOUS", phonetic: "/luːˈɡuːbriəs/", definition: "Sad and gloomy.", sentence: "The funeral music was ____." },
        { word: "INEFFABLE", phonetic: "/ɪnˈɛfəbl/", definition: "Too great to be described with words.", sentence: "The beauty of the sunset was ____." },
        { word: "OBSEQUIOUS", phonetic: "/əbˈsiːkwiəs/", definition: "Too eager to please or obey.", sentence: "The ____ assistant agreed with everything the boss said." },
        { word: "VICISSITUDE", phonetic: "/vɪˈsɪsɪtuːd/", definition: "A sudden change, usually unpleasant.", sentence: "The ____ of life can be challenging." },
        { word: "ABSTRUSE", phonetic: "/æbˈstruːs/", definition: "Difficult to understand.", sentence: "The theory was too ____ for me to understand." },
        { word: "RECONDITE", phonetic: "/ˈrɛkəndaɪt/", definition: "Little-known; obscure.", sentence: "He had a deep knowledge of ____ facts." },
        { word: "CACOPHONY", phonetic: "/kəˈkɒfəni/", definition: "Harsh, unpleasant mixture of sounds.", sentence: "The orchestra warming up was a ____." },
        { word: "PHLEGMATIC", phonetic: "/flɛɡˈmætɪk/", definition: "Calm and not easily excited.", sentence: "He is ____ and rarely gets angry." },
        { word: "OBDURATE", phonetic: "/ˈɒbdjʊrət/", definition: "Very stubborn.", sentence: "He remained ____ despite their pleas." },
        { word: "INIMICAL", phonetic: "/ɪˈnɪmɪkl/", definition: "Harmful or unfriendly.", sentence: "High inflation is ____ to economic growth." },
        { word: "PERSPICACIOUS", phonetic: "/ˌpɜːrspɪˈkeɪʃəs/", definition: "Very smart; able to notice details.", sentence: "The ____ detective solved the case." },
        { word: "MUNIFICENT", phonetic: "/mjuːˈnɪfɪsnt/", definition: "Extremely generous.", sentence: "A ____ donation helped build the hospital." },
        { word: "PARSIMONIOUS", phonetic: "/ˌpɑːrsɪˈmoʊniəs/", definition: "Very unwilling to spend money.", sentence: "The ____ man saved every penny." },
        { word: "IMPLACABLE", phonetic: "/ɪmˈplækəbl/", definition: "Cannot be calmed or stopped.", sentence: "He has an ____ hatred for his enemy." },
        { word: "SYCOPHANT", phonetic: "/ˈsɪkəfænt/", definition: "Someone who flatters to gain favor.", sentence: "The ____ constantly praised the king." },
        { word: "ASSIDUOUS", phonetic: "/əˈsɪdjuəs/", definition: "Persistent and hardworking.", sentence: "She was an ____ student." },
        { word: "INSIDIOUS", phonetic: "/ɪnˈsɪdiəs/", definition: "Sneaky and harmful.", sentence: "The disease is ____ because it has no early symptoms." },
        { word: "PERIPATETIC", phonetic: "/ˌpɛrɪpəˈtɛtɪk/", definition: "Traveling from place to place.", sentence: "The ____ teacher worked at three different schools." },
        { word: "QUERULOUS", phonetic: "/ˈkwɛrələs/", definition: "Always complaining.", sentence: "The ____ customer complained about everything." },
        { word: "REPLETE", phonetic: "/rɪˈpliːt/", definition: "Completely filled.", sentence: "The book is ____ with interesting facts." },
        { word: "TREPIDATION", phonetic: "/ˌtrɛpɪˈdeɪʃn/", definition: "Fear or worry.", sentence: "He entered the haunted house with ____." },
        { word: "AMBIVALENT", phonetic: "/æmˈbɪvələnt/", definition: "Having mixed feelings.", sentence: "She felt ____ about the job offer." },
        { word: "JUXTAPOSE", phonetic: "/ˌdʒʌkstəˈpoʊz/", definition: "To place side by side for comparison.", sentence: "The artist likes to ____ light and dark colors." },
        { word: "IMPROVIDENT", phonetic: "/ɪmˈprɒvɪdənt/", definition: "Not planning for the future.", sentence: "The ____ spender ran out of money quickly." },
        { word: "EXECRABLE", phonetic: "/ˈɛksɪkrəbl/", definition: "Extremely bad.", sentence: "The food at that restaurant was ____." },
        { word: "OBVIATE", phonetic: "/ˈɒbvieɪt/", definition: "To remove a need or problem.", sentence: "The new software will ____ the need for manual entry." },
        { word: "VITRIOLIC", phonetic: "/ˌvɪtriˈɒlɪk/", definition: "Extremely harsh or bitter.", sentence: "The critic wrote a ____ review." },
        { word: "PUSILLANIMOUS", phonetic: "/ˌpjuːsɪˈlænɪməs/", definition: "Cowardly.", sentence: "The ____ soldier ran away from the battle." }
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
      justify-content: space-between;
      width: 100%;
      margin-bottom: 20px;
  }

  .player-badge {
      background: var(--wood-color);
      color: white;
      padding: 5px 10px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 0.8rem;
  }
  
  .player-score {
      font-size: 1.5rem;
      font-weight: bold;
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

const MultiplayerGame = ({ difficulty }: { difficulty: Difficulty }) => {
    const [status, setStatus] = useState<'lobby' | 'hosting' | 'joining' | 'playing' | 'gameover'>('lobby');
    const [role, setRole] = useState<'host' | 'client' | null>(null);
    const [gameId, setGameId] = useState('');
    const [joinInput, setJoinInput] = useState('');
    const [connection, setConnection] = useState<any>(null);
    const [peerId, setPeerId] = useState<string>('');
    const [wordList, setWordList] = useState<SpellingWordData[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [myScore, setMyScore] = useState(0);
    const [opponentScore, setOpponentScore] = useState(0);
    const peerRef = useRef<any>(null);

    // Game Logic State
    const [input, setInput] = useState('');
    const [message, setMessage] = useState('');
    const [showDef, setShowDef] = useState(false);
    
    // Voice
    const speak = (text: string) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const coolMaleVoice = voices.find(v => v.name === "Google US English") || voices.find(v => v.lang.startsWith("en") && v.name.includes("Male"));
        if (coolMaleVoice) utterance.voice = coolMaleVoice;
        utterance.pitch = 0.8;
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    };

    // Initialize Peer
    useEffect(() => {
        const id = Math.random().toString(36).substring(2, 6).toUpperCase();
        setPeerId(id);
        const peer = new Peer(id, { debug: 1 });
        peerRef.current = peer;

        peer.on('connection', (conn) => {
            setConnection(conn);
            setupConnection(conn);
            setStatus('playing');
            setRole('host');
        });
        
        return () => peer.destroy();
    }, []);

    const setupConnection = (conn: any) => {
        conn.on('data', (data: any) => {
            if (data.type === 'START_GAME') {
                setWordList(data.words);
                setCurrentIndex(0);
                setStatus('playing');
                setRole('client');
                speak("Game Started! Spell " + data.words[0].word);
            }
            if (data.type === 'SCORE_UPDATE') {
                setOpponentScore(data.score);
            }
            if (data.type === 'GAME_OVER') {
                setStatus('gameover');
            }
        });
    };

    const handleHost = () => {
        setStatus('hosting');
        setGameId(peerId);
        // Pre-generate word list
        const pool = SPELLING_LOCAL_DICTIONARY[difficulty];
        const selected = [];
        for (let i = 0; i < 5; i++) {
            selected.push(pool[Math.floor(Math.random() * pool.length)]);
        }
        setWordList(selected);
    };

    const handleJoin = () => {
        if (!joinInput) return;
        const conn = peerRef.current.connect(joinInput.toUpperCase());
        conn.on('open', () => {
            setConnection(conn);
            setupConnection(conn);
            setStatus('joining'); // Wait for host to start
        });
    };

    const startGame = () => {
        if (connection && role === 'host') {
            connection.send({ type: 'START_GAME', words: wordList });
            speak("Game Started! Spell " + wordList[0].word);
            setCurrentIndex(0);
            setStatus('playing');
        }
    };
    
    const handleSubmit = () => {
        const currentWord = wordList[currentIndex];
        if (input.trim().toUpperCase() === currentWord.word) {
            SoundManager.playWin();
            const newScore = myScore + 10 - (showDef ? 5 : 0);
            setMyScore(newScore);
            connection.send({ type: 'SCORE_UPDATE', score: newScore });
            
            if (currentIndex + 1 < wordList.length) {
                const nextIdx = currentIndex + 1;
                setCurrentIndex(nextIdx);
                setInput('');
                setShowDef(false);
                setMessage('Correct! Next Word...');
                setTimeout(() => setMessage(''), 1500);
                speak(wordList[nextIdx].word);
            } else {
                setStatus('gameover');
                connection.send({ type: 'GAME_OVER' });
            }
        } else {
            SoundManager.playError();
            setMessage("Incorrect!");
            setTimeout(() => setMessage(''), 1000);
        }
    };
    
    // Lobby UI
    if (status === 'lobby') {
        return (
            <div className="lobby-card">
                <h3>Multiplayer Spelling Bee</h3>
                <p>Connect with a friend to play!</p>
                <div style={{display:'flex', gap: 10, justifyContent: 'center'}}>
                    <button className="btn btn-primary" onClick={handleHost}>Host Game</button>
                    <button className="btn btn-secondary" onClick={() => setStatus('joining')}>Join Game</button>
                </div>
            </div>
        );
    }
    
    if (status === 'hosting') {
        return (
            <div className="lobby-card">
                <h3>Hosting Game</h3>
                <p>Share this code with your friend:</p>
                <div className="lobby-code">{gameId}</div>
                {connection ? (
                     <div style={{marginTop: 20}}>
                        <p style={{color: '#4caf50', fontWeight: 'bold'}}>Friend Connected!</p>
                        <button className="btn btn-primary" onClick={startGame}>Start Match</button>
                     </div>
                ) : (
                    <div className="loader"></div>
                )}
                 <button className="btn btn-secondary" style={{marginTop: 10}} onClick={() => setStatus('lobby')}>Cancel</button>
            </div>
        );
    }

    if (status === 'joining') {
         return (
            <div className="lobby-card">
                <h3>Join Game</h3>
                {connection ? (
                    <p>Connected! Waiting for host to start...</p>
                ) : (
                    <>
                        <input className="lobby-input" placeholder="ENTER CODE" value={joinInput} onChange={e => setJoinInput(e.target.value)} />
                        <button className="btn btn-primary" style={{marginTop: 15}} onClick={handleJoin}>Connect</button>
                    </>
                )}
                 <button className="btn btn-secondary" style={{marginTop: 10}} onClick={() => setStatus('lobby')}>Back</button>
            </div>
        );
    }

    // Game UI
    const currentWordData = wordList[currentIndex];
    
    if (status === 'gameover') {
         return (
            <div className="spelling-container">
                <h2>Game Over!</h2>
                <div className="player-list" style={{flexDirection: 'column', gap: 20, alignItems: 'center'}}>
                    <div className="player-badge" style={{fontSize: '1.5rem'}}>You: {myScore}</div>
                    <div className="player-badge" style={{fontSize: '1.5rem', background: '#555'}}>Opponent: {opponentScore}</div>
                </div>
                <h3>{myScore > opponentScore ? "🏆 YOU WON!" : myScore < opponentScore ? "💀 YOU LOST" : "🤝 DRAW"}</h3>
                <button className="btn btn-primary" onClick={() => setStatus('lobby')}>Exit</button>
            </div>
        );
    }

    return (
        <div className="spelling-container">
            <div className="player-list">
                <div>
                    <div className="player-badge">YOU</div>
                    <div className="player-score">{myScore}</div>
                </div>
                 <div>
                    <div className="player-badge" style={{background:'#555'}}>OPPONENT</div>
                    <div className="player-score">{opponentScore}</div>
                </div>
            </div>
            
             <div className="word-image-container">
                <img src={getPollinationsImage(currentWordData.word)} alt="Hint" className="word-image" />
            </div>
            
            <div className="audio-btn-large" onClick={() => speak(currentWordData.word)}>
                 <span className="audio-icon">🔊</span>
            </div>
            
             <input 
                className="spelling-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="SPELL IT"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            
            {showDef && <div className="hint-text" style={{marginBottom: 20}}>{currentWordData.definition}</div>}
            <div className="message">{message}</div>
            
            <div className="controls">
                <button className="btn btn-primary" onClick={handleSubmit}>Submit</button>
                <button className="btn btn-hint" onClick={() => setShowDef(true)} disabled={showDef}>Definition (-5)</button>
            </div>
            
            <div style={{marginTop: 20, fontSize: '0.8rem', opacity: 0.6}}>
                Round {currentIndex + 1} / {wordList.length}
            </div>
        </div>
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
    
    const speak = (text: string, rate = 0.9) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        
        const voices = window.speechSynthesis.getVoices();
        
        // "Cool Male Voice" - clear, calm, slightly deeper.
        const coolMaleVoice = voices.find(v => v.name === "Google US English") 
                           || voices.find(v => v.name === "Google UK English Male")
                           || voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("male"));

        if (coolMaleVoice) {
            utterance.voice = coolMaleVoice;
        }

        utterance.pitch = 0.8; // Slightly deeper to sound "cool"
        utterance.rate = rate; 
        utterance.lang = 'en-US';

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
                
                // 1. Get Word Data
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
                    model: 'gemini-2.5-flash',
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
                
                // 2. Generate Image (Use Pollinations for consistent illustration)
                const generatedImageUrl = getPollinationsImage(data.word);
                
                setState(s => ({
                    ...s,
                    data: {
                        word: data.word.trim().toUpperCase(),
                        phonetic: data.phonetic || '',
                        definition: data.definition,
                        sentence: data.sentence,
                        imageUrl: generatedImageUrl
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
        const imageUrl = getPollinationsImage(randomItem.word);

        setState(s => ({
            ...s,
            data: { ...randomItem, imageUrl },
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
            
            <div className="word-image-container">
                {state.data?.imageUrl ? (
                    <img src={state.data.imageUrl} alt="Hint" className="word-image" />
                ) : (
                    <span className="image-placeholder">🖼️</span>
                )}
            </div>

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
            <div className={`nav-tab ${view === 'multiplayer' ? 'active' : ''}`} onClick={() => setView('multiplayer')}>
                Multiplayer
            </div>
        </div>

        {view === 'scrabble' ? (
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