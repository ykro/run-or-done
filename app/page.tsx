'use client';

import { useState, useTransition, useRef } from 'react';
import { toast } from 'sonner';
import { Upload, X, Camera, AlertCircle, CheckCircle, Activity, Footprints, Ruler, AlertTriangle, ArrowDown, ArrowRightFromLine, ArrowLeftFromLine, ArrowDownToLine, Info, Check, RotateCcw, Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import imageCompression from 'browser-image-compression';
import { analyzeShoes } from '@/app/actions/analyze';
import { ForensicAnalysis } from '@/lib/schemas';
import clsx from 'clsx';

const VIEWS = [
  {
    key: 'OUTSOLE',
    label: 'Outsole',
    icon: Footprints,
    description: "Bottom of the shoe showing tread wear pattern."
  },
  {
    key: 'LATERAL',
    label: 'Lateral',
    icon: ArrowRightFromLine,
    description: "Outer side of the shoe (facing away from other foot)."
  },
  {
    key: 'MEDIAL',
    label: 'Medial',
    icon: ArrowLeftFromLine,
    description: "Inner side of the shoe (facing the other foot)."
  },
  {
    key: 'HEEL',
    label: 'Heel',
    icon: ArrowDownToLine,
    description: "Back view showing heel counter and sole wear."
  },
  {
    key: 'TOP',
    label: 'Top / Upper',
    icon: ArrowDown,
    description: "Top-down view showing upper condition and toe box."
  },
] as const;

export default function Home() {
  const [images, setImages] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [analysis, setAnalysis] = useState<ForensicAnalysis | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeCameraKey, setActiveCameraKey] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!resultsRef.current) return;
    try {
      const dataUrl = await toPng(resultsRef.current, {
        backgroundColor: '#ffffff',
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `run-or-done-report.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Report downloaded!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate report image");
    }
  };

  const handleImageUpload = async (key: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error("Invalid file type. Please upload an image (JPG, PNG, WEBP, HEIC).");
      return;
    }

    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };

      const compressedFile = await imageCompression(file, options);

      // Convert to Base64 for reliable rendering in html-to-image
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPreviews(prev => ({ ...prev, [key]: base64String }));
      };
      reader.readAsDataURL(compressedFile);

      setImages(prev => ({ ...prev, [key]: compressedFile }));
      toast.success(`${key} image added`);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to process ${key} image`);
    }
  };

  const removeImage = (key: string) => {
    setImages(prev => {
      const newImages = { ...prev };
      delete newImages[key];
      return newImages;
    });
    setPreviews(prev => {
      const newPreviews = { ...prev };
      // No need to revoke object URL as we are using base64
      delete newPreviews[key];
      return newPreviews;
    });
  };

  const resetAnalysis = () => {
    setImages({});
    setPreviews({}); // Just clear base64 strings
    setAnalysis(null);
    toast.info("Ready for new analysis");
  };

  const handleSubmit = () => {
    if (Object.keys(images).length === 0) {
      toast.error("Please upload at least one image");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      Object.entries(images).forEach(([key, file]) => {
        formData.append(key, file);
      });

      const result = await analyzeShoes(formData);

      if (result.success && result.data) {
        setAnalysis(result.data);
        toast.success("Analysis complete!");
      } else {
        toast.error(result.error || "Analysis failed");
      }
    });
  };

  const startCamera = async (key: string) => {
    setCapturedImage(null);
    setCapturedBlob(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      setCameraStream(stream);
      setActiveCameraKey(key);
      setCameraOpen(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraOpen(false);
    setActiveCameraKey(null);
    setCapturedImage(null);
    setCapturedBlob(null);
  };

  const capturePhoto = () => {
    const video = document.getElementById('camera-video') as HTMLVideoElement;
    if (video) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          setCapturedBlob(blob);
          setCapturedImage(URL.createObjectURL(blob));
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const confirmPhoto = async () => {
    if (activeCameraKey && capturedBlob) {
      const file = new File([capturedBlob], `${activeCameraKey}_capture.jpg`, { type: 'image/jpeg' });
      await handleImageUpload(activeCameraKey, file);
      stopCamera();
    }
  };

  const retakePhoto = () => {
    if (capturedImage) URL.revokeObjectURL(capturedImage);
    setCapturedImage(null);
    setCapturedBlob(null);
  };

  const [dragActive, setDragActive] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(key);
    } else if (e.type === "dragleave") {
      setDragActive(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleImageUpload(key, e.dataTransfer.files[0]);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8 md:py-12 text-slate-900">
      <div className="max-w-5xl mx-auto space-y-10">

        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900">
            Run-or-Done
          </h1>
          <p className="text-slate-500 text-lg">
            AI-Powered Running Shoe Forensic Analysis
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-500" />
            How to Photograph Your Shoes
          </h2>

          <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-600">
            <div className="space-y-3">
              <h3 className="font-medium text-slate-900">General Guidelines</h3>
              <ul className="space-y-2 list-disc pl-4 marker:text-slate-400">
                <li><strong>One Shoe:</strong> Photograph only one shoe (left or right).</li>
                <li><strong>Lighting:</strong> Use bright, even lighting on a plain background.</li>
                <li><strong>Positioning:</strong> Place shoe on a <u>flat surface</u> (table or floor).</li>
                <li><strong>Camera Level:</strong> Hold camera at the <u>same level as the shoe</u> for side views (not from above).</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium text-slate-900">Required Views</h3>
              <ul className="space-y-2">
                <li className="flex gap-2">
                  <Footprints className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <span><strong>Outsole:</strong> Bottom view showing the entire tread pattern.</span>
                </li>
                <li className="flex gap-2">
                  <ArrowDownToLine className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <span><strong>Heel:</strong> Back view (camera level with shoe).</span>
                </li>
                <li className="flex gap-2">
                  <ArrowRightFromLine className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <span><strong>Lateral (Outer):</strong> Side facing away from other foot (usually has large brand logo).</span>
                </li>
                <li className="flex gap-2">
                  <ArrowLeftFromLine className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <span><strong>Medial (Inner):</strong> Arch side.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Upload Grid */}:
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5 md:gap-6">
          {VIEWS.map(({ key, label, icon: Icon, description }) => (
            <div
              key={key}
              className="relative aspect-[4/5] group"
              onDragEnter={(e) => handleDrag(e, key)}
              onDragLeave={(e) => handleDrag(e, key)}
              onDragOver={(e) => handleDrag(e, key)}
              onDrop={(e) => handleDrop(e, key)}
            >
              {previews[key] ? (
                <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-sm border border-slate-200">
                  <img
                    src={previews[key]}
                    alt={label}
                    className="w-full h-full object-cover"
                  />
                  {!isPending && (
                    <button
                      onClick={() => removeImage(key)}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2 text-center truncate">
                    {label}
                  </div>
                </div>
              ) : (
                <div className={clsx(
                  "relative flex flex-col items-center justify-between w-full h-full rounded-2xl border-2 border-dashed transition-all duration-200",
                  dragActive === key
                    ? "border-slate-900 bg-slate-100 scale-[1.02]"
                    : "border-slate-300 bg-white",
                  isPending ? "opacity-50" : "hover:bg-slate-50 hover:border-slate-400"
                )}>

                  {/* Tooltip Trigger */}
                  <div className="absolute top-2 right-2 z-10">
                    <button
                      type="button"
                      onClick={() => setActiveTooltip(activeTooltip === key ? null : key)}
                      onMouseEnter={() => setActiveTooltip(key)}
                      onMouseLeave={() => setActiveTooltip(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <Info size={16} />
                    </button>
                    {activeTooltip === key && (
                      <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-900 text-white text-xs p-2 rounded-lg shadow-xl z-20 pointer-events-none">
                        {description}
                        <div className="absolute bottom-[-4px] right-1 w-2 h-2 bg-slate-900 rotate-45"></div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center w-full mt-4 pointer-events-none">
                    <Icon className={clsx("w-10 h-10 mb-3 transition-colors", dragActive === key ? "text-slate-900" : "text-slate-400")} strokeWidth={1.5} />
                    <span className="text-xs md:text-sm text-slate-500 font-medium text-center leading-tight">{label}</span>
                    {dragActive === key && (
                      <span className="text-[10px] text-slate-400 mt-1 animate-pulse">Drop to upload</span>
                    )}
                  </div>

                  <div className="w-full mt-2 px-2 pb-2">
                    <label className={clsx(
                      "flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-slate-900 text-white cursor-pointer hover:bg-slate-800 transition-all active:scale-95 shadow-md",
                      isPending && "pointer-events-none opacity-50"
                    )}>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isPending}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(key, file);
                        }}
                      />
                      <Upload size={18} />
                      <span className="text-sm font-medium">Add Photo</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col md:flex-row justify-center gap-4">
          {!analysis ? (
            <button
              onClick={handleSubmit}
              disabled={isPending || Object.keys(images).length === 0}
              className={clsx(
                "px-8 py-4 rounded-full font-semibold text-white shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2",
                isPending ? "bg-slate-400 cursor-not-allowed" : "bg-slate-900 hover:bg-slate-800"
              )}
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Analyzing... this may take a moment</span>
                </>
              ) : (
                "Analyze Shoes"
              )}
            </button>
          ) : (
            <>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className={clsx(
                  "px-8 py-4 rounded-full font-semibold text-white shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2",
                  isPending ? "bg-slate-400 cursor-not-allowed" : "bg-slate-900 hover:bg-slate-800"
                )}
              >
                {isPending ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  "Update Analysis"
                )}
              </button>
              <button
                onClick={resetAnalysis}
                disabled={isPending}
                className="px-8 py-4 rounded-full font-semibold text-slate-700 bg-white border-2 border-slate-200 shadow-lg transition-all transform hover:scale-105 active:scale-95 hover:bg-slate-50 hover:border-slate-300"
              >
                New Analysis
              </button>

              <button
                onClick={handleDownload}
                disabled={isPending}
                className="px-8 py-4 rounded-full font-semibold text-slate-700 bg-white border-2 border-slate-200 shadow-lg transition-all transform hover:scale-105 active:scale-95 hover:bg-slate-50 hover:border-slate-300 flex items-center gap-2"
              >
                <Download size={20} />
                Download Report
              </button>
            </>
          )}
        </div>

        {/* Results */}
        {analysis && (
          <div ref={resultsRef} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-50 p-4 md:p-8 rounded-3xl">

            {/* Audit Feedback */}
            {analysis.analysis_audit.missing_views.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-900">Partial Analysis</h3>
                  <p className="text-sm text-yellow-700">
                    Missing views: {analysis.analysis_audit.missing_views.join(", ")}.
                    {analysis.analysis_audit.limitations_summary}
                  </p>
                </div>
              </div>
            )}

            {/* Verdict Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
              <div className={clsx(
                "p-6 md:w-1/3 flex flex-col justify-center items-center text-center text-white",
                analysis.verdict.status_code === 'GREEN' && "bg-emerald-500",
                analysis.verdict.status_code === 'YELLOW' && "bg-amber-500",
                analysis.verdict.status_code === 'RED' && "bg-rose-500",
                analysis.verdict.status_code === 'GRAY' && "bg-slate-500",
              )}>
                <h2 className="text-2xl font-bold mb-2">{analysis.verdict.display_title}</h2>
                <div className="text-4xl font-black mb-2">{analysis.verdict.estimated_km_left}</div>
                <p className="opacity-90">{analysis.verdict.final_prescription}</p>
              </div>
              <div className="p-6 md:w-2/3 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <div>
                    <div className="text-sm text-slate-500">Detected Model</div>
                    <div className="font-semibold text-lg">{analysis.shoe_info.detected_brand_model || "Unknown"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-500">Category</div>
                    <div className="font-medium bg-slate-100 px-3 py-1 rounded-full text-sm">
                      {analysis.shoe_info.category}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-500 mb-1">Strike Pattern</div>
                    <div className="font-medium">{analysis.biomechanics.foot_strike_detected}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500 mb-1">Pronation</div>
                    <div className="font-medium">{analysis.biomechanics.pronation_assessment}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Component Health Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Outsole */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Footprints className="w-5 h-5 text-slate-400" /> Outsole Health
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Condition Score</span>
                    <span className="font-medium">{analysis.component_health.outsole.condition_score}/100</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-slate-900 h-2 rounded-full transition-all"
                      style={{ width: `${analysis.component_health.outsole.condition_score}%` }}
                    />
                  </div>
                  <div className="pt-2">
                    <div className="text-sm font-medium mb-1">Observation</div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {analysis.component_health.outsole.technical_observation}
                    </p>
                  </div>
                </div>
              </div>

              {/* Midsole */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-slate-400" /> Midsole Status
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Life Remaining</span>
                    <span className="font-medium">{analysis.component_health.midsole.life_remaining_percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-slate-900 h-2 rounded-full transition-all"
                      style={{ width: `${analysis.component_health.midsole.life_remaining_percentage}%` }}
                    />
                  </div>
                  <div className="pt-2">
                    <div className="text-sm font-medium mb-1">Compression</div>
                    <div className="inline-block bg-slate-100 px-2 py-0.5 rounded text-xs font-medium mb-2">
                      {analysis.component_health.midsole.compression_status}
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {analysis.component_health.midsole.technical_observation}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Upper & Risks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-slate-400" /> Upper Condition
                </h3>
                <div className="mb-2">
                  <span className={clsx(
                    "px-2 py-1 rounded text-xs font-bold",
                    analysis.component_health.upper.status === 'GOOD' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  )}>
                    {analysis.component_health.upper.status}
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  {analysis.component_health.upper.observation}
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-slate-400" /> Injury Risks
                </h3>
                {analysis.biomechanics.injury_risk_factors.length > 0 ? (
                  <ul className="space-y-2">
                    {analysis.biomechanics.injury_risk_factors.map((risk, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="block w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                        {risk}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500 italic">No significant risks detected.</p>
                )}
              </div>
            </div>

            {/* Analyzed Images Thumbnails */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5 text-slate-400" /> Evidence
              </h3>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(previews).map(([key, url]) => (
                  <div key={key} className="space-y-1">
                    <div className="aspect-square rounded-lg overflow-hidden border border-slate-100 bg-slate-50 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={key} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-[10px] text-center text-slate-500 font-medium capitalize">{key.toLowerCase()}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Camera Modal */}
        {cameraOpen && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
              {capturedImage ? (
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full h-full object-contain"
                />
              ) : (
                <video
                  id="camera-video"
                  autoPlay
                  playsInline
                  ref={video => {
                    if (video && cameraStream) {
                      video.srcObject = cameraStream;
                    }
                  }}
                  className="w-full h-full object-cover"
                />
              )}

              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={stopCamera}
                  className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-8 bg-black flex justify-center pb-12 min-h-[160px]">
              {capturedImage ? (
                <div className="flex gap-8">
                  <button
                    onClick={retakePhoto}
                    className="flex flex-col items-center gap-2 text-white opacity-80 hover:opacity-100 transition-opacity"
                  >
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center border border-slate-600">
                      <RotateCcw size={28} />
                    </div>
                    <span className="text-sm font-medium">Retake</span>
                  </button>

                  <button
                    onClick={confirmPhoto}
                    className="flex flex-col items-center gap-2 text-white hover:scale-105 transition-transform"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                      <Check size={32} />
                    </div>
                    <span className="text-sm font-medium">Use Photo</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={capturePhoto}
                  className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center hover:scale-105 transition-transform"
                >
                  <div className="w-16 h-16 bg-white rounded-full active:scale-95 transition-transform" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </main >
  );
}
