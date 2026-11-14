/**
 * @fileoverview Entry point (barrel module) untuk integrasi inferensi browser CampusFix.
 *
 * Dapat digunakan langsung melalui:
 * 1. Browser ES Module + <script type="importmap"> (CDN)
 * 2. NPM Bundler (Vite / Webpack / Rollup)
 */

export {
  MODEL_INPUT_WIDTH,
  MODEL_INPUT_HEIGHT,
  LETTERBOX_PAD_RGB,
  LETTERBOX_PAD_STYLE,
  computeLetterboxGeometry,
  decodeImageSourceWithExif,
  renderLetterboxCanvas,
  canvasToModelInputTensor,
  preprocessImageForModel,
} from './preprocessing/image_preprocessor.js';

export {
  DEFAULT_MODEL_URL,
  resolveTfRuntime,
  getModelStatus,
  loadFacilityModel,
  disposeFacilityModel,
} from './model/model_loader.js';

export {
  FACILITY_CLASS_NAMES,
  MANUAL_CATEGORY_OTHER,
  ALLOWED_REPORT_CATEGORIES,
  CANDIDATE_THRESHOLDS,
  validateThresholdValue,
  evaluateThreshold,
  evaluateAllCandidateThresholds,
} from './inference/threshold_policy.js';

export {
  runModelInferenceOnTensor,
  predictFacilityFromImage,
  predictFacilityFromLetterboxCanvas,
} from './inference/facility_predictor.js';

