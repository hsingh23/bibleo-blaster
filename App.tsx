import React, { useState, useRef, useEffect, useCallback } from 'react';
import Confetti from 'react-confetti';
import mammoth from 'mammoth';
import Lottie from 'lottie-react';
import { analyzeBibliography, extractTextFromImage } from './services/geminiService';
import { AnalysisResult, AppStatus } from './types';
import CitationCard from './components/CitationCard';

// Regex to find sections - Updated to handle Markdown bold/italics (e.g. **Works Cited**)
const BIBLIOGRAPHY_REGEX = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:[\*_~]*)(?:Bibliography|References|Works Cited|Sources)(?:[\*_~]*)(?:\s*:)?\s*(?:\n|$)/i;
const FOOTNOTES_REGEX = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:[\*_~]*)(?:Notes|Footnotes|Endnotes)(?:[\*_~]*)(?:\s*:)?\s*(?:\n|$)/i;

const FUN_LOADING_MESSAGES = [
  "Scanning for missing commas... 🧐",
  "Beep boop... looking for Ibid... 🤖",
  "Consulting the library ghosts... 👻",
  "Teaching the robot Chicago style... 📚",
  "Hunting down rogue periods... 🔍",
  "Charging the citation lasers... ⚡",
  "Asking the librarian for help... 🤫",
  "Deciphering your hieroglyphics... 📜",
  "Fueling up the rocket ship... 🚀",
  "Polishing the footnotes... ✨"
];

const ROCKET_ANIMATION_URL = "https://assets9.lottiefiles.com/packages/lf20_96bovdur.json";

// Validation helper moved outside to avoid closure staleness and relaxed
const isValidKeyFormat = (key: string) => {
  // Google API keys start with AIza. 
  // We perform a loose length check to be robust against slight variations.
  return key.trim().startsWith('AIza') && key.trim().length >= 30;
};

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [hasValidKey, setHasValidKey] = useState(false);
  
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [loadingMsg, setLoadingMsg] = useState(FUN_LOADING_MESSAGES[0]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Animation state
  const [rocketAnimation, setRocketAnimation] = useState<any>(null);

  useEffect(() => {
    // Check local storage on mount
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey && isValidKeyFormat(storedKey)) {
      setApiKey(storedKey);
      setHasValidKey(true);
    }
    
    // Fetch the animation JSON once on mount
    fetch(ROCKET_ANIMATION_URL)
      .then(res => res.json())
      .then(data => setRocketAnimation(data))
      .catch(err => console.error("Failed to load animation", err));
  }, []);

  // Rotate loading messages
  useEffect(() => {
    let interval: number;
    if (status === AppStatus.ANALYZING_TEXT || status === AppStatus.FETCHING_AI || status === AppStatus.READING_IMAGE) {
      interval = window.setInterval(() => {
        setLoadingMsg(FUN_LOADING_MESSAGES[Math.floor(Math.random() * FUN_LOADING_MESSAGES.length)]);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [status]);

  const saveApiKey = () => {
    const cleanedKey = apiKey.trim();
    if (isValidKeyFormat(cleanedKey)) {
      localStorage.setItem('gemini_api_key', cleanedKey);
      setApiKey(cleanedKey);
      setHasValidKey(true);
      setErrorMsg(null);
    } else {
      setErrorMsg("That doesn't look like a valid API key. It should start with 'AIza'.");
    }
  };

  const resetApiKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setHasValidKey(false);
    setResult(null);
    setInputText('');
    setStatus(AppStatus.IDLE);
    setErrorMsg(null);
  };

  const handleReview = useCallback(async () => {
    if (!inputText.trim()) {
      setErrorMsg("Please paste your report or drop a file first.");
      return;
    }

    setStatus(AppStatus.ANALYZING_TEXT);
    setErrorMsg(null);
    setResult(null);
    setShowConfetti(false);

    let bibText = '';
    let notesText = '';
    let bodyText = '';

    const bibMatch = inputText.match(BIBLIOGRAPHY_REGEX);
    const notesMatch = inputText.match(FOOTNOTES_REGEX);

    if (!bibMatch && !notesMatch) {
       setStatus(AppStatus.ERROR);
       setErrorMsg("I couldn't find a 'Bibliography' or 'Notes' section! Make sure you title them clearly so I know where to look! 🕵️");
       return;
    }

    const bibIndex = bibMatch?.index;
    const notesIndex = notesMatch?.index;

    // Define start positions (after the header)
    const bibContentStart = bibIndex !== undefined ? bibIndex + bibMatch![0].length : -1;
    const notesContentStart = notesIndex !== undefined ? notesIndex + notesMatch![0].length : -1;

    // Extract Bibliography
    if (bibContentStart !== -1) {
      // If notes come after bib, cut bib there. Otherwise go to end.
      const end = (notesIndex !== undefined && notesIndex > bibContentStart) ? notesIndex : inputText.length;
      bibText = inputText.slice(bibContentStart, end).trim();
    }

    // Extract Notes
    if (notesContentStart !== -1) {
      // If bib comes after notes, cut notes there. Otherwise go to end.
      const end = (bibIndex !== undefined && bibIndex > notesContentStart) ? bibIndex : inputText.length;
      notesText = inputText.slice(notesContentStart, end).trim();
    }

    // Body text is everything before the first detected section
    let splitIndex = inputText.length;
    if (bibIndex !== undefined) splitIndex = Math.min(splitIndex, bibIndex);
    if (notesIndex !== undefined) splitIndex = Math.min(splitIndex, notesIndex);
    bodyText = inputText.slice(0, splitIndex).toLowerCase();

    if ((bibText.length + notesText.length) > 50000) {
       setStatus(AppStatus.ERROR);
       setErrorMsg("Whoa, that's a huge paper! The citations section is too long (>50k characters). Can you trim it down?");
       return;
    }

    try {
      setStatus(AppStatus.FETCHING_AI);
      
      const analysis = await analyzeBibliography(bibText || "", notesText || null, apiKey);
      
      const reviewsWithCrossCheck = analysis.bibliographyReviews.map(review => {
        let found = false;
        if (review.primaryAuthor) {
          const authorName = review.primaryAuthor.toLowerCase();
          found = bodyText.includes(authorName);
        }
        return { ...review, foundInText: found };
      });

      const finalResult: AnalysisResult = {
        ...analysis,
        bibliographyReviews: reviewsWithCrossCheck,
        footnoteReviews: analysis.footnoteReviews || [] 
      };

      setResult(finalResult);
      setStatus(AppStatus.COMPLETE);

      if (analysis.overallScore >= 90) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (err: any) {
      setStatus(AppStatus.ERROR);
      if (err.message === "INVALID_API_KEY") {
        setErrorMsg("Uh oh! Your API Key seems broken. Check it and try again!");
      } else {
        setErrorMsg(err.message || "My brain hurts! Something went wrong.");
      }
    }
  }, [inputText, apiKey]);

  // Global Keyboard Shortcut Listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        // Only trigger if we have text and aren't already processing
        if (inputText.trim() && (status === AppStatus.IDLE || status === AppStatus.COMPLETE || status === AppStatus.ERROR)) {
           e.preventDefault();
           handleReview();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleReview, inputText, status]);


  const handleClear = () => {
    setInputText('');
    setStatus(AppStatus.IDLE);
    setResult(null);
    setErrorMsg(null);
    setShowConfetti(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadExample = () => {
    setInputText(`
The History of Space Travel
By Alex Student

Humanity has always dreamed of the stars. Early rocketry pioneers laid the groundwork [1]. 
The Cold War accelerated these developments significantly [2]. 
Von Braun was instrumental in the US space program [3].
He wrote extensively about his experiences [4].
However, other historians argue that the Soviet contribution was equally vital [5].
Later, Von Braun clarified his stance [6].

## Notes
1. Walter A. McDougall, The Heavens and the Earth: A Political History of the Space Age (New York: Basic Books, 1985), 20.
2. Asif A. Siddiqi, Challenge to Apollo: The Soviet Union and the Space Race, 1945-1974 (Washington, DC: NASA, 2000), 45.
3. Michael J. Neufeld, Von Braun: Dreamer of Space, Engineer of War (New York: Vintage Books, 2007), 100.
4. Ibid.
5. Siddiqi, Challenge to Apollo, 60.
6. Neufeld, "Von Braun," 102.
7. McDougall, Heavens and the Earth, 25.

## Bibliography
McDougall, Walter A. "The Heavens and the Earth: A Political History of the Space Age." New York: Basic Books, 1985.
Neufeld, Michael J. Von Braun: Dreamer of Space, Engineer of War. New York: Vintage Books, 2007.
Siddiqi, Asif A. Challenge to Apollo: The Soviet Union and the Space Race, 1945-1974. Washington, DC: NASA 2000.
    `);
  };

  const processFile = async (file: File) => {
    setErrorMsg(null);
    
    if (file.type.startsWith('image/')) {
      setStatus(AppStatus.READING_IMAGE);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = (event.target?.result as string).split(',')[1];
        try {
          const extractedText = await extractTextFromImage(base64Data, file.type, apiKey);
          setInputText((prev) => prev ? prev + "\n\n" + extractedText : extractedText);
          setStatus(AppStatus.IDLE);
        } catch (err: any) {
          setStatus(AppStatus.ERROR);
           if (err.message === "INVALID_API_KEY") {
            setErrorMsg("Your API Key seems to be invalid or expired. Please update it.");
          } else {
            setErrorMsg(err.message);
          }
        }
      };
      reader.readAsDataURL(file);
    } 
    else if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      file.name.endsWith('.docx')
    ) {
      setStatus(AppStatus.READING_IMAGE); // Reusing status for "Processing"
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          // @ts-ignore - mammoth is loaded via importmap/cdn
          const result = await mammoth.extractRawText({ arrayBuffer });
          const text = result.value;
          
          if (result.messages.length > 0) {
            console.log("Mammoth messages:", result.messages);
          }
          
          setInputText((prev) => prev ? prev + "\n\n" + text : text);
          setStatus(AppStatus.IDLE);
        } catch (err: any) {
          setStatus(AppStatus.ERROR);
          setErrorMsg("Could not read DOCX file. " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    }
    else if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setInputText((prev) => prev ? prev + "\n\n" + text : text);
      };
      reader.readAsText(file);
    } 
    else {
      setErrorMsg("I can't read that file! Please use .docx, .txt, .md, or images.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      e.preventDefault();
      await processFile(file);
    }
  };

  if (!hasValidKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
         <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl p-8 border-4 border-sky-100 transform rotate-1 transition-transform hover:rotate-0">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4 animate-bounce">🤖</div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">BiblioBlaster Setup</h1>
              <p className="text-slate-500 font-medium">You need a magic key to start the engine!</p>
            </div>

            <div className="bg-sky-50 p-5 rounded-xl mb-6 border-2 border-sky-100">
               <h3 className="font-bold text-sky-800 mb-2 uppercase tracking-wide text-xs">How to get your Free Key:</h3>
               <ol className="list-decimal list-inside space-y-2 text-sm text-sky-900 font-medium">
                 <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline font-bold text-sky-600 hover:text-sky-500">Google AI Studio</a>.</li>
                 <li>Click <strong>"Create API Key"</strong>.</li>
                 <li>Choose <strong>"Create API key in new project"</strong>.</li>
                 <li>Copy the key (it starts with <code>AIza</code>).</li>
               </ol>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Paste Key Here:</label>
                <input 
                  type="password" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveApiKey();
                    }
                  }}
                  placeholder="AIza..."
                  className="w-full p-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-sky-100 focus:border-sky-500 font-mono text-sm outline-none transition-all"
                />
              </div>

              {errorMsg && (
                <div className="text-rose-600 text-sm bg-rose-50 p-3 rounded-lg border-2 border-rose-100 font-bold">
                  {errorMsg}
                </div>
              )}

              <button 
                onClick={saveApiKey}
                className="w-full bg-sky-500 hover:bg-sky-600 text-white font-black text-lg py-4 rounded-xl transition-all shadow-lg hover:shadow-sky-200 hover:-translate-y-1 active:translate-y-0"
              >
                Start Blasting! 🚀
              </button>
            </div>
         </div>
      </div>
    );
  }

  // Check if we are in a loading state
  const isLoading = status === AppStatus.READING_IMAGE || status === AppStatus.FETCHING_AI || status === AppStatus.ANALYZING_TEXT;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 overflow-x-hidden font-sans bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
      {showConfetti && <Confetti recycle={false} numberOfPieces={500} colors={['#0ea5e9', '#10b981', '#f59e0b', '#f43f5e']} gravity={0.2} />}

      {/* FULL SCREEN LOADING OVERLAY */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-4 animate-fade-in">
           <div className="w-full max-w-2xl">
             {rocketAnimation ? (
               <Lottie 
                 animationData={rocketAnimation} 
                 loop={true} 
                 className="w-full h-96 object-contain"
               />
             ) : (
                // Fallback if animation JSON fails to load
               <div className="w-48 h-48 mx-auto border-8 border-slate-100 border-t-sky-500 rounded-full animate-spin mb-8"></div>
             )}
           </div>
           
           <h2 className="text-3xl md:text-4xl font-black text-slate-800 text-center mt-6 animate-pulse">
             {loadingMsg}
           </h2>
           <p className="text-slate-400 font-bold mt-2 uppercase tracking-widest text-sm">
             Processing your citations...
           </p>
        </div>
      )}
      
      {/* Header */}
      <header className="bg-white border-b-4 border-sky-500 p-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-4xl bg-sky-100 w-14 h-14 flex items-center justify-center rounded-xl shadow-inner">🤖</div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800">BiblioBlaster <span className="text-sky-500">3000</span></h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Chicago Style Checker</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden md:inline-flex text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg items-center gap-2 border border-slate-200">
                <span>Shortcuts:</span>
                <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 shadow-sm text-slate-600">Cmd</kbd> + <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 shadow-sm text-slate-600">Enter</kbd>
             </div>
             <button onClick={resetApiKey} className="text-xs font-bold text-slate-400 hover:text-sky-600 underline px-2 py-1 transition-colors">
               Change Key
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        
        {/* Intro / Instructions */}
        {status === AppStatus.IDLE && (
          <div className="mb-8 bg-white p-6 rounded-2xl shadow-lg border-2 border-slate-100">
            <h2 className="text-xl font-black mb-4 text-slate-800 flex items-center gap-2">
              <span>Ready to Check?</span>
              <span className="text-2xl">🧐</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-600">
               <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                 <strong className="text-sky-700 block text-lg mb-1">1. Paste or Drop</strong>
                 <p>Text, Word docs (.docx), or images of your bibliography.</p>
               </div>
               <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                 <strong className="text-emerald-700 block text-lg mb-1">2. Headers Matter</strong>
                 <p>Ensure you have "Bibliography" and/or "Notes" sections.</p>
               </div>
               <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                 <strong className="text-amber-700 block text-lg mb-1">3. Get Feedback</strong>
                 <p>I'll check formatting, Ibid usage, and missing references.</p>
               </div>
            </div>
            <div className="mt-6 pt-4 border-t-2 border-dashed border-slate-100 text-center">
              <button 
                onClick={loadExample} 
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-sky-600 font-bold bg-slate-50 hover:bg-sky-50 px-4 py-2 rounded-lg transition-colors"
              >
                <span>🧪</span> Try the "History of Space" Example
              </button>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div 
          className={`relative mb-8 group transition-all duration-300 ${isDragging ? 'scale-[1.02] rotate-1' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 bg-sky-500 bg-opacity-90 rounded-2xl z-20 flex flex-col items-center justify-center pointer-events-none backdrop-blur-sm animate-pulse">
              <span className="text-6xl mb-4 animate-bounce">📂</span>
              <p className="text-3xl font-black text-white">DROP IT LIKE IT'S HOT!</p>
            </div>
          )}

          <div className={`
             absolute -inset-1 bg-gradient-to-r from-sky-400 to-emerald-400 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200
             ${status !== AppStatus.IDLE && status !== AppStatus.COMPLETE && status !== AppStatus.ERROR ? 'animate-pulse opacity-75' : ''}
          `}></div>

          <div className="relative">
            <textarea
              className="w-full h-80 p-8 rounded-2xl border-2 border-slate-200 bg-white focus:border-sky-400 focus:ring-4 focus:ring-sky-100 transition-all resize-none font-mono text-sm leading-relaxed text-slate-700 shadow-xl outline-none"
              placeholder="Paste your report text here, or drag & drop a .docx file..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onPaste={handlePaste}
              disabled={isLoading}
            />
            
            {inputText && !isLoading && (
              <button 
                onClick={handleClear}
                className="absolute top-4 right-4 bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-500 rounded-xl p-2 transition-colors z-10"
                title="Clear text"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-center mb-12">
          <button
            onClick={handleReview}
            disabled={isLoading || (!inputText && status === AppStatus.IDLE)}
            className={`
              px-16 py-5 rounded-2xl font-black text-xl shadow-xl transform transition-all active:scale-95 active:translate-y-1
              disabled:opacity-50 disabled:cursor-not-allowed
              ${(status === AppStatus.IDLE || status === AppStatus.COMPLETE || status === AppStatus.ERROR)
                ? 'bg-sky-500 hover:bg-sky-400 text-white hover:shadow-2xl hover:-translate-y-1' 
                : 'bg-slate-200 text-slate-400'
              }
            `}
          >
             ANALYZE REPORT 🚀
          </button>
        </div>

        {/* Error State */}
        {status === AppStatus.ERROR && (
          <div className="bg-rose-50 border-l-8 border-rose-500 text-rose-800 p-6 rounded-r-xl mb-8 shadow-sm flex items-start gap-4" role="alert">
            <span className="text-3xl">🤕</span>
            <div>
              <p className="font-black text-lg">Ouch!</p>
              <p className="font-medium">{errorMsg}</p>
              {errorMsg?.includes("API Key") && (
                <button 
                  onClick={resetApiKey}
                  className="mt-3 text-sm font-bold bg-white px-4 py-2 rounded border border-rose-200 shadow-sm hover:shadow hover:bg-rose-50 transition-all"
                >
                  Fix API Key
                </button>
              )}
            </div>
          </div>
        )}

        {/* Results Area */}
        {status === AppStatus.COMPLETE && result && (
          <div ref={resultsRef} className="animate-fade-in pb-12">
            
            {/* Score Card */}
            <div className="bg-slate-800 text-white rounded-3xl p-10 mb-10 text-center shadow-2xl relative overflow-hidden border-b-8 border-slate-900">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
              
              <div className="relative z-10">
                <div className="inline-block bg-slate-700/50 rounded-full px-6 py-2 mb-4 backdrop-blur-sm">
                  <span className="text-sky-300 font-bold tracking-widest uppercase text-xs">Biblio-Score</span>
                </div>
                
                <h2 className="text-6xl md:text-8xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400 drop-shadow-lg">
                  {result.overallScore}
                </h2>
                
                <p className="text-2xl text-slate-200 font-bold max-w-2xl mx-auto leading-relaxed">
                  "{result.summaryMessage}"
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Footnotes Column */}
              <div>
                <div className="flex items-center gap-3 mb-6 border-b-2 border-slate-200 pb-3">
                   <div className="bg-emerald-100 text-emerald-600 w-10 h-10 flex items-center justify-center rounded-xl text-xl">🦶</div>
                   <h3 className="text-2xl font-black text-slate-800">Footnotes</h3>
                   <span className="ml-auto bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-full text-sm">
                     {result.footnoteReviews.length}
                   </span>
                </div>
                {result.footnoteReviews.length > 0 ? (
                  <div className="space-y-4">
                    {result.footnoteReviews.map((review, index) => (
                      <CitationCard key={`note-${index}`} review={review} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 bg-slate-100 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 italic">
                    No footnotes found in this section.
                  </div>
                )}
              </div>

              {/* Bibliography Column */}
              <div>
                 <div className="flex items-center gap-3 mb-6 border-b-2 border-slate-200 pb-3">
                    <div className="bg-sky-100 text-sky-600 w-10 h-10 flex items-center justify-center rounded-xl text-xl">📚</div>
                    <h3 className="text-2xl font-black text-slate-800">Bibliography</h3>
                    <span className="ml-auto bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-full text-sm">
                     {result.bibliographyReviews.length}
                   </span>
                 </div>
                 {result.bibliographyReviews.length > 0 ? (
                   <div className="space-y-4">
                    {result.bibliographyReviews.map((review, index) => (
                      <CitationCard key={`bib-${index}`} review={review} />
                    ))}
                  </div>
                 ) : (
                  <div className="text-center p-8 bg-slate-100 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 italic">
                    No bibliography found in this section.
                  </div>
                 )}
              </div>
            </div>

            <div className="text-center border-t-2 border-slate-200 pt-12">
              <button 
                onClick={handleClear}
                className="bg-white border-2 border-slate-200 hover:border-sky-400 text-slate-600 hover:text-sky-600 font-black px-10 py-4 rounded-2xl transition-all hover:-translate-y-1 shadow-sm hover:shadow-md text-lg flex items-center gap-2 mx-auto"
              >
                <span>🔄</span> Check Another Paper
              </button>
            </div>

          </div>
        )}

      </main>
    </div>
  );
};

export default App;