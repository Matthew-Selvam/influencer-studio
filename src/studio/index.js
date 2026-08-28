// ─────────────────────────────────────────────────────────────────────────────
// Character Studio — FanFlow's "media.generate.*" provider, browser-side.
//
// A clean capability surface over the generation + prompt utilities that the
// app already has (Higgsfield OAuth is per-browser, so media generation must
// stay here — FanFlow's backend delegates media requests to this module via
// MediaRequested events on the bus).
//
// Usage:
//   import { studioRun, studioCapabilities } from '../studio'
//   const url = await studioRun('media.generate.image', { prompt, referenceImage })
//
// Pages keep importing the raw utils directly (no breakage); this facade is the
// canonical integration surface for FanFlow and future plugins.
// ─────────────────────────────────────────────────────────────────────────────

import { generateThreeImages, generateSingleImage, generateNImages, generateVideo, generatePosePreviews } from '../utils/higgsfieldGenerate'
import { generateImageWS, trainInfluencerLora } from '../utils/wavespeedGenerate'
import { buildPhotoStudioPrompt, randomParams, getPoses, getOutfitPresets, getOutfitPrompt, LOCATIONS, TIMES, VIBES, EXPRESSIONS, ASPECTS } from '../utils/photoStudioPrompt'
import { buildDirectPrompt, buildThreeVariationPrompts, getBackstoryContext } from '../utils/systemPrompt'
import { buildInfluencerSheetPrompt, buildCharSheetPrompt } from '../utils/charSheetPrompt'
import { analyzeBackstory } from '../utils/backstoryAnalysis'
import { downloadImage, compressImage } from '../utils/imageUtils'

const CAPABILITIES = {
  // ── Media generation ─────────────────────────────────────────────────────
  'media.generate.image': (p) => generateSingleImage({
    prompt: p.prompt,
    aspectRatio: p.aspectRatio,
    resolution: p.resolution,
    referenceImage: p.referenceImage,
    outfitImage: p.outfitImage,
    onProgress: p.onProgress,
    pendingKey: p.pendingKey,
    onJobIds: p.onJobIds,
    isCancelled: p.isCancelled,
  }),
  'media.generate.image.batch': (p) => generateNImages({
    prompt: p.prompt,
    count: p.count,
    aspectRatio: p.aspectRatio,
    resolution: p.resolution,
    referenceImage: p.referenceImage,
    outfitImage: p.outfitImage,
    closeUpImage1: p.closeUpImage1,
    closeUpImage2: p.closeUpImage2,
    propImages: p.propImages,
    onProgress: p.onProgress,
    onResult: p.onResult,
    isCancelled: p.isCancelled,
    pendingKey: p.pendingKey,
  }),
  'media.generate.image.triple': (p) => generateThreeImages({
    prompts: p.prompts,
    aspectRatio: p.aspectRatio,
    model: p.model,
    faceRef: p.faceRef,
    styleRef: p.styleRef,
    physicalDesc: p.physicalDesc,
    faceRefNote: p.faceRefNote,
    styleRefNote: p.styleRefNote,
    onProgress: p.onProgress,
    onPartialResults: p.onPartialResults,
  }),
  'media.generate.video': (p) => generateVideo({
    prompt: p.prompt,
    aspectRatio: p.aspectRatio,
    duration: p.duration,
    count: p.count,
    referenceImages: p.referenceImages,
    audioRef: p.audioRef,
    startFrameUrl: p.startFrameUrl,
    model: p.model,
    resolution: p.resolution,
    onProgress: p.onProgress,
    onPartialResults: p.onPartialResults,
    isCancelled: p.isCancelled,
    pendingKey: p.pendingKey,
  }),
  'media.generate.pose-previews': (p) => generatePosePreviews(p.influencer, p.onPoseComplete, { stance: p.stance }),

  // ── Secondary providers ──────────────────────────────────────────────────
  'media.generate.image.wavespeed': (p) => generateImageWS({
    prompt: p.prompt,
    model: p.model,
    loraUrl: p.loraUrl,
    triggerWord: p.triggerWord,
    aspectRatio: p.aspectRatio,
    seed: p.seed,
    onProgress: p.onProgress,
  }),
  'media.train.lora': (p) => trainInfluencerLora({
    imageZipUrl: p.imageZipUrl,
    triggerWord: p.triggerWord,
    steps: p.steps,
    baseModel: p.baseModel,
    onProgress: p.onProgress,
  }),

  // ── Prompt construction ──────────────────────────────────────────────────
  'prompt.photo-studio': (p) => buildPhotoStudioPrompt(p),
  'prompt.random-params': (p) => randomParams(),
  'prompt.influencer-images': (p) => buildThreeVariationPrompts(p.d, p.aspectRatio, p.model),
  'prompt.direct': (p) => buildDirectPrompt(p.d, p.forcePose, p.options, p.aspectRatio),
  'prompt.backstory-context': (p) => getBackstoryContext(p.physicalDesc, p.backstory),
  'prompt.influencer-sheet': (p) => buildInfluencerSheetPrompt(p.influencer),
  'prompt.brand-sheet': (p) => buildCharSheetPrompt(p.brand, p.category, p.productDesc, p.angles),

  // ── Analysis ─────────────────────────────────────────────────────────────
  'analysis.backstory': (p) => analyzeBackstory(p.backstory, p.physicalDesc),

  // ── Assets ───────────────────────────────────────────────────────────────
  'asset.download': (p) => downloadImage(p.src, p.filename),
  'asset.compress': (p) => compressImage(p.dataUrl, p.maxPx, p.quality),
}

/** Run a Character Studio capability. Throws on unknown capabilities. */
export function studioRun(capability, params = {}) {
  const fn = CAPABILITIES[capability]
  if (!fn) throw new Error(`Unknown Character Studio capability: "${capability}"`)
  return fn(params)
}

/** List every capability this studio provides (mirrors FanFlow's registry). */
export function studioCapabilities() {
  return Object.keys(CAPABILITIES)
}

// Re-export the catalogs so integrations (FanFlow chat, future plugins) can
// build prompts without importing the raw prompt module.
export const studioCatalogs = { LOCATIONS, TIMES, VIBES, EXPRESSIONS, ASPECTS }
export { getPoses, getOutfitPresets, getOutfitPrompt }
