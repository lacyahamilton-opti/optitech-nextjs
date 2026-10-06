import { contentType } from '@optimizely/cms-sdk'

export const OT_SlideItem = contentType({
  key:         'OT_SlideItem',
  displayName: 'Slide',
  description: 'A single slide: background, overlay, copy, and links.',
  baseType:    '_component',
  // No compositionBehaviors — only exists as an array item inside OT_SliderBlock.
  properties: {
    eyebrow: {
      type: 'string', displayName: 'Eyebrow', isLocalized: true, maxLength: 40,
      description: 'Optional short label above the headline.',
      group: 'OT_Content', sortOrder: 10, indexingType: 'searchable',
    },
    headline: {
      type: 'string', displayName: 'Headline', isLocalized: true, maxLength: 100,
      group: 'OT_Content', sortOrder: 20, indexingType: 'searchable',
    },
    body: {
      type: 'richText', displayName: 'Body', isLocalized: true,
      description: 'Optional. Supports paragraphs and lists. Keep it short — 2–3 lines reads best against imagery.',
      group: 'OT_Content', sortOrder: 30, indexingType: 'searchable',
    },
    buttonLabel: {
      type: 'string', displayName: 'Button Label', isLocalized: true, maxLength: 40,
      description: 'Primary button. Requires Button Link.',
      group: 'OT_Content', sortOrder: 40,
    },
    buttonUrl: {
      type: 'url', displayName: 'Button Link',
      group: 'OT_Content', sortOrder: 50,
    },
    secondaryLabel: {
      type: 'string', displayName: 'Secondary Link Label', isLocalized: true, maxLength: 40,
      description: 'Optional lower-emphasis text link, shown alongside the button. Requires Secondary Link URL.',
      group: 'OT_Content', sortOrder: 60,
    },
    secondaryUrl: {
      type: 'url', displayName: 'Secondary Link URL',
      group: 'OT_Content', sortOrder: 70,
    },
    backgroundImage: {
      type: 'contentReference', displayName: 'Background Image', allowedTypes: ['_image'],
      group: 'OT_Content', sortOrder: 80,
    },
    backgroundImageAlt: {
      type: 'string', displayName: 'Background Image Alt Text', isLocalized: true, maxLength: 150,
      group: 'OT_Content', sortOrder: 90,
    },
    backgroundVideo: {
      type: 'contentReference', displayName: 'Background Video', allowedTypes: ['_video'],
      description: 'Looping, muted background video. Takes precedence over Background Image, which becomes the poster/fallback frame when both are set.',
      group: 'OT_Content', sortOrder: 100,
    },
    backgroundColor: {
      type: 'string', format: 'selectOne', displayName: 'Background Color',
      description: 'The slide’s base fill. If no image or video is set, this is the entire slide — a valid choice for a pure color-and-type slide.',
      enum: [
        { value: 'canvas',    displayName: 'Canvas (Default)' },
        { value: 'surface',   displayName: 'Surface' },
        { value: 'brand',     displayName: 'Brand' },
        { value: 'brandDeep', displayName: 'Brand Deep' },
        { value: 'accent',    displayName: 'Accent' },
      ],
      group: 'OT_Content', sortOrder: 110,
    },
    overlay: {
      type: 'string', format: 'selectOne', displayName: 'Overlay',
      description: 'A tint over the background image/video so text stays readable. Has no effect on a slide with no image or video.',
      enum: [
        { value: 'none',          displayName: 'None' },
        { value: 'evenTint',      displayName: 'Even Tint (Default)' },
        { value: 'leftFade',      displayName: 'Left Fade' },
        { value: 'rightFade',     displayName: 'Right Fade' },
        { value: 'bottomFade',    displayName: 'Bottom Fade' },
        { value: 'brandWash',     displayName: 'Brand Wash' },
        { value: 'frostedPanel',  displayName: 'Frosted Panel' },
      ],
      group: 'OT_Content', sortOrder: 120,
    },
    contentPlacement: {
      type: 'string', format: 'selectOne', displayName: 'Content Placement',
      description: 'Where this slide’s content sits. In Editorial Split, the media panel takes the opposite side; Center falls back to Left in that style. Not used by Story Rail (its content position is fixed by design).',
      enum: [
        { value: 'left',   displayName: 'Left (Default)' },
        { value: 'center', displayName: 'Center' },
        { value: 'right',  displayName: 'Right' },
      ],
      group: 'OT_Content', sortOrder: 130,
    },
  },
})
