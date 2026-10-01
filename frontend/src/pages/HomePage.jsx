import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Search, 
  Link as LinkIcon, 
  AlertCircle, 
  ArrowDown, 
  ArrowRight,
  Clock,
  Loader2,
  FileSearch,
  Mic,
  MicOff,
  Camera,
  X,
  Sparkles,
  Type,
  Image as ImageIcon
} from 'lucide-react';
import { searchEvidence } from '../services/api';
import VerificationPipelineModal from '../components/VerificationPipelineModal';
import CameraCaptureModal from '../components/CameraCaptureModal';

export const JURISDICTIONS = [
  { id: 'central', name: 'Central Government / India', description: 'PIB, The Gazette of India, Union Ministries' },
  { id: 'ap', name: 'Andhra Pradesh', description: 'GoAP Portals, I&PR Department' },
  { id: 'ts', name: 'Telangana', description: 'GoTS Portals, Digital Media Wing' },
  { id: 'tn', name: 'Tamil Nadu', description: 'DIPR, TNeGA Portals' },
  { id: 'an', name: 'Andaman & Nicobar Islands', description: 'UT Administration Official Gazettes' },
  { id: 'jk', name: 'Jammu & Kashmir', description: 'DIPR-J&K Official Announcements' },
];

export const LANGUAGES = [
  { id: 'en', code: 'en', name: 'English', native: 'English' },
  { id: 'te', code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { id: 'ta', code: 'ta', name: 'Tamil', native: 'தமிழ்' },
];

export const validateArticleUrl = (urlString) => {
  if (!urlString || !urlString.trim()) {
    return { valid: true, error: null };
  }
  const trimmed = urlString.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { 
        valid: false, 
        error: `Unsupported protocol "${parsed.protocol}". Only "http:" and "https:" URLs are allowed.` 
      };
    }
    return { valid: true, error: null };
  } catch {
    return { 
      valid: false, 
      error: 'Please enter a valid URL format (e.g., https://example.com/news/article).' 
    };
  }
};

export default function HomePage() {
  const navigate = useNavigate();

  // Controlled form state
  const [headline, setHeadline] = useState('');
  const [newsUrl, setNewsUrl] = useState('');
  const [jurisdiction, setJurisdiction] = useState('Central Government / India');
  const [language, setLanguage] = useState('English');
  const [capturedImage, setCapturedImage] = useState(null);

  // Microphone state
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const recognitionRef = useRef(null);

  // Camera modal state
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Input tab mode ('type', 'speak', 'camera')
  const [activeInputMode, setActiveInputMode] = useState('type');

  // Validation & Submission state
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState(null);

  const MAX_HEADLINE_LENGTH = 350;

  const scrollToWorkspace = () => {
    const el = document.getElementById('verify-workspace');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleHeadlineChange = (e) => {
    const value = e.target.value;
    if (value.length <= MAX_HEADLINE_LENGTH) {
      setHeadline(value);
      if (formErrors.headline) {
        setFormErrors(prev => ({ ...prev, headline: null }));
      }
    }
  };

  const handleUrlChange = (e) => {
    const value = e.target.value;
    setNewsUrl(value);
    if (formErrors.url) {
      setFormErrors(prev => ({ ...prev, url: null }));
    }
  };

  // 1. Microphone Speech Recognition Handler
  const startSpeechRecognition = () => {
    setSpeechError(null);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser. Please type or upload an image.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language.toLowerCase().includes('telugu') ? 'te-IN' : language.toLowerCase().includes('tamil') ? 'ta-IN' : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setActiveInputMode('speak');
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setHeadline(transcript.trim().slice(0, MAX_HEADLINE_LENGTH));
          if (formErrors.headline) {
            setFormErrors(prev => ({ ...prev, headline: null }));
          }
        }
      };

      recognition.onerror = (event) => {
        console.warn('[SpeechRecognition] Error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setSpeechError('Microphone access denied. Please grant microphone permissions in your browser.');
        } else if (event.error === 'no-speech') {
          setSpeechError('No speech detected. Please try speaking again.');
        } else {
          setSpeechError(`Speech error: ${event.error}. Please try again.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('[SpeechRecognition] Init error:', err);
      setIsListening(false);
      setSpeechError('Unable to start microphone. Please verify device permissions.');
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  // Toggle Microphone
  const toggleMicrophone = () => {
    if (isListening) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  };

  // 2. Camera Capture Callback
  const handleCameraCapture = (imageDataUrl, extractedText) => {
    setCapturedImage(imageDataUrl);
    setActiveInputMode('camera');
    
    if (extractedText && extractedText.trim()) {
      setHeadline(extractedText.trim().slice(0, MAX_HEADLINE_LENGTH));
      if (formErrors.headline) {
        setFormErrors(prev => ({ ...prev, headline: null }));
      }
    } else if (!headline.trim()) {
      setHeadline('Captured news image statement for verification');
    }
  };

  const handleRemoveImage = () => {
    setCapturedImage(null);
  };

  // Form Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Stop listening if active
    if (isListening) {
      stopSpeechRecognition();
    }

    const errors = {};
    if (!headline.trim()) {
      errors.headline = 'Please enter, speak, or capture a claim to verify.';
    }

    if (newsUrl.trim()) {
      const urlCheck = validateArticleUrl(newsUrl);
      if (!urlCheck.valid) {
        errors.url = urlCheck.error;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setSubmissionFeedback({
        type: 'error',
        message: 'Please resolve the highlighted validation errors before submitting.',
      });
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    const langCode = language.toLowerCase().includes('telugu') ? 'te' : language.toLowerCase().includes('tamil') ? 'ta' : 'en';

    try {
      const result = await searchEvidence({
        claim: headline.trim(),
        jurisdiction: jurisdiction,
        language: langCode,
        country: 'IN',
        size: 15,
      });

      await new Promise(res => setTimeout(res, 800));

      setIsSubmitting(false);

      if (result && result.success) {
        navigate('/results', {
          state: {
            headline: headline.trim(),
            url: newsUrl.trim(),
            newsUrl: newsUrl.trim(),
            jurisdiction: jurisdiction,
            language: language,
            capturedImage: capturedImage,
            submittedAt: new Date().toISOString(),
            ...result.data,
            evidenceResults: result.data.results || [],
            evidenceTotal: result.data.total_found || 0,
            evidenceCount: result.data.results_count || 0,
            providerTookMs: result.data.took_ms,
            provider: result.data.provider || 'free_news_api',
            warning: result.data.warning,
            status: 'Evidence Retrieved',
          },
        });
      } else {
        navigate('/results', {
          state: {
            headline: headline.trim(),
            url: newsUrl.trim(),
            newsUrl: newsUrl.trim(),
            jurisdiction: jurisdiction,
            language: language,
            capturedImage: capturedImage,
            submittedAt: new Date().toISOString(),
            evidenceResults: [],
            evidenceTotal: 0,
            evidenceCount: 0,
            evidenceError: result?.error || 'Verification request failed',
            errorCode: result?.code,
            status: 'Provider Error',
          },
        });
      }
    } catch (err) {
      setIsSubmitting(false);
      setSubmissionFeedback({
        type: 'error',
        message: err.message || 'An error occurred while connecting to the evidence service.',
      });
    }
  };

  return (
    <div className="space-y-16 py-10 bg-slate-50">
      <VerificationPipelineModal isOpen={isSubmitting} claim={headline} jurisdiction={jurisdiction} />
      <CameraCaptureModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCameraCapture} />

      {/* 1. HERO SECTION */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-7 relative">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold shadow-sm">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>Evidence before belief.</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-[#1E3A8A] max-w-4xl mx-auto leading-tight">
          Just Ask <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-teal-600 to-indigo-700">
            We Prove It!
          </span>
        </h1>

        <p className="text-slate-600 text-base sm:text-xl max-w-2xl mx-auto leading-relaxed font-normal">
          TruthLens analyzes claims against official sources, trusted news organizations, and existing fact checks.
        </p>

        <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={scrollToWorkspace}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl btn-primary font-bold text-sm shadow-md cursor-pointer"
          >
            <span>Verify a Claim</span>
            <ArrowDown className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/results')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-800 font-bold text-sm cursor-pointer shadow-sm"
          >
            <span>View Verification Results</span>
            <ArrowRight className="w-4 h-4 text-blue-600" />
          </button>
        </div>
      </section>

      {/* 2. PROCESS EXPLANATION CARDS */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-1.5">
          <h2 className="text-xs uppercase tracking-widest font-bold text-[#0F766E] font-mono">
            EVIDENCE-FIRST METHODOLOGY
          </h2>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#1E3A8A]">
            How TruthLens Operates
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card-clean card-clean-hover rounded-2xl p-7 space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-black text-base">
              01
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#1E3A8A]">1. Submit a Claim</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Type text, speak using your microphone, or capture a claim image with your camera to begin evidence analysis.
              </p>
            </div>
          </div>

          <div className="card-clean card-clean-hover rounded-2xl p-7 space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-black text-base">
              02
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#1E3A8A]">2. Retrieve Evidence</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Queries Google Fact Check Tools, Free News search corpus, and official state gazettes (PIB, GoAP, GoTS, TN DIPR) for primary source records.
              </p>
            </div>
          </div>

          <div className="card-clean card-clean-hover rounded-2xl p-7 space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-700 font-black text-base">
              03
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#1E3A8A]">3. Evaluate &amp; Score</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Determines stance (Supported, Contradicted, Misleading, Insufficient), generates 5–8 factual points, and computes an Evidence Support Score.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. VERIFICATION INPUT WORKSPACE WITH MICROPHONE & CAMERA */}
      <section id="verify-workspace" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg">
          {/* Header & Input Mode Indicators */}
          <div className="border-b border-slate-200 px-8 py-5 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-[#1E3A8A] font-bold text-base">
              <FileSearch className="w-5 h-5 text-blue-600" />
              <span>Claim Submission Console</span>
            </div>

            {/* Input Modes Toolbar */}
            <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveInputMode('type')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                  activeInputMode === 'type' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Type claim statement"
              >
                <Type className="w-3.5 h-3.5" />
                <span>Type Text</span>
              </button>

              <button
                type="button"
                onClick={toggleMicrophone}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  isListening
                    ? 'bg-rose-600 text-white animate-pulse'
                    : activeInputMode === 'speak'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Speak claim using microphone"
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-rose-500" />}
                <span>{isListening ? 'Stop' : '🎤 Speak'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeInputMode === 'camera' && capturedImage
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Capture image with camera"
              >
                <Camera className="w-3.5 h-3.5 text-teal-600" />
                <span>📷 Camera</span>
              </button>
            </div>
          </div>

          {/* Feedback Banner */}
          {submissionFeedback && (
            <div
              className={`px-8 py-3.5 border-b text-xs flex items-center justify-between ${
                submissionFeedback.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="font-semibold">{submissionFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setSubmissionFeedback(null)}
                className="text-xs opacity-75 hover:opacity-100 underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Speech Error Alert Banner */}
          {speechError && (
            <div className="px-8 py-3 bg-rose-50 border-b border-rose-200 text-xs text-rose-800 flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{speechError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSpeechError(null)}
                className="text-xs opacity-75 hover:opacity-100 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* 1. Headline / Core Claim Input with Voice & Camera Integration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="headline-input" className="block text-xs font-bold text-[#1E3A8A] uppercase tracking-wider">
                  Headline / Core Claim <span className="text-rose-600">*</span>
                </label>
                <div className="flex items-center gap-3">
                  {isListening && (
                    <span className="flex items-center gap-1.5 text-xs text-rose-600 font-bold font-mono animate-pulse">
                      <Mic className="w-3.5 h-3.5 animate-bounce" />
                      <span>Listening...</span>
                    </span>
                  )}
                  <span className={`text-[11px] font-mono ${headline.length >= MAX_HEADLINE_LENGTH ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                    {headline.length} / {MAX_HEADLINE_LENGTH}
                  </span>
                </div>
              </div>

              <div className="relative flex items-center">
                <input
                  id="headline-input"
                  type="text"
                  placeholder="Enter, speak, or capture the news headline to verify..."
                  value={headline}
                  onChange={handleHeadlineChange}
                  disabled={isSubmitting}
                  className={`w-full bg-slate-50 border rounded-xl pl-4 pr-24 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-all ${
                    formErrors.headline
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-600'
                  }`}
                />

                {/* Inline Quick Action Buttons: Mic & Camera */}
                <div className="absolute right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={toggleMicrophone}
                    title={isListening ? 'Stop recording speech' : 'Speak claim via microphone'}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${
                      isListening
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'text-slate-500 hover:text-blue-600 hover:bg-slate-200/60'
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    title="Capture claim image via camera"
                    className="p-2 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {formErrors.headline && (
                <p className="text-xs text-rose-600 flex items-center gap-1.5 pt-0.5 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{formErrors.headline}</span>
                </p>
              )}
            </div>

            {/* Captured Image Preview Display */}
            {capturedImage && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4 animate-fadeIn shadow-xs">
                <div className="flex items-center gap-3">
                  <img
                    src={capturedImage}
                    alt="Captured claim"
                    className="w-16 h-12 object-cover rounded-xl border border-slate-300 shadow-sm"
                  />
                  <div className="space-y-0.5 text-xs">
                    <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
                      <span>Captured Image Attached</span>
                    </span>
                    <span className="text-[11px] text-slate-500 block font-mono">
                      Image metadata &amp; visual text will be passed to evidence analysis
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Remove captured image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Jurisdiction & Language Selection Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label htmlFor="jurisdiction-select" className="block text-xs font-bold text-[#1E3A8A] uppercase tracking-wider">
                  Target Jurisdiction
                </label>
                <select
                  id="jurisdiction-select"
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-blue-600"
                >
                  {JURISDICTIONS.map((j) => (
                    <option key={j.id} value={j.name}>
                      {j.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="language-select" className="block text-xs font-bold text-[#1E3A8A] uppercase tracking-wider">
                  Target Language
                </label>
                <select
                  id="language-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-blue-600"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name} ({l.native})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Article URL (Optional) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="url-input" className="block text-xs font-bold text-[#1E3A8A] uppercase tracking-wider flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Article URL <span className="text-slate-500 font-normal lowercase">(optional)</span></span>
                </label>
                <span className="text-[11px] text-slate-400 font-mono">Must begin with http:// or https://</span>
              </div>
              <input
                id="url-input"
                type="text"
                placeholder="https://example.com/news/article"
                value={newsUrl}
                onChange={handleUrlChange}
                disabled={isSubmitting}
                className={`w-full bg-slate-50 border rounded-xl px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 font-mono text-xs focus:outline-none focus:bg-white transition-all ${
                  formErrors.url
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-200'
                    : 'border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-600'
                }`}
              />
              {formErrors.url && (
                <p className="text-xs text-rose-600 flex items-center gap-1.5 pt-0.5 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{formErrors.url}</span>
                </p>
              )}
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>Verification routes through automated evidence retrieval &amp; scoring.</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl btn-primary font-bold text-sm cursor-pointer shadow-md"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Claim...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>🔍 Verify Claim</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* 4. PRODUCT PHILOSOPHY & TRUST */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 rounded-3xl bg-white border border-slate-200 space-y-3 shadow-sm">
          <div className="flex items-center gap-2.5 text-[#1E3A8A] font-extrabold text-base">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span>Product Philosophy &amp; Verification Integrity</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
            TruthLens is designed around <span className="text-[#1E3A8A] font-bold">evidence retrieval and explainability</span> rather than asking an AI model to render ungrounded opinions. Every assessment links directly to cited official documentation, verifiable gazettes, and reputable news records.
          </p>
          <div className="text-xs text-[#0F766E] font-mono font-bold pt-1">
            "Evidence first, explanation second."
          </div>
        </div>
      </section>
    </div>
  );
}
