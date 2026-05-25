export {
  SLIDE_W,
  SLIDE_H,
  type SlideColors,
  slideColors,
  escapeXml,
  wrapSvg,
  padSlideNumber,
  extractMetric,
  wrapMultilingualLines,
  pageHeader,
  imageBgLayer,
  imageSideLayer,
  defsGradient,
  decorCornerDots,
  decorAccentBar,
  sectionDivider,
  cardShadow,
  bgGradientOverlay,
  buildCard,
  buildNumberedCircle,
  buildTextBlock,
} from "./base";

export {
  renderCoverSlide,
  renderAgendaSlide,
  renderSectionSlide,
  renderClosingSlide,
} from "./structural";
export {
  renderContentSlide,
  renderProblemSlide,
  renderStrategySlide,
  renderSummarySlide,
} from "./content";
export {
  renderArchitectureSlide,
  renderCapabilitySlide,
  renderRiskGovernanceSlide,
  renderScenarioSlide,
} from "./analytical";
export { renderMetricsSlide, renderTableSlide, renderTimelineSlide } from "./data";
export {
  renderComparisonSlide,
  renderProcessSlide,
  renderRoadmapSlide,
  renderTeamSlide,
  renderQuoteSlide,
  renderChartSlide,
  renderContactSlide,
} from "./extra";
