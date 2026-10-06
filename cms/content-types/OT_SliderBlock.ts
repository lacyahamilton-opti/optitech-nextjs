import { contentType } from '@optimizely/cms-sdk'
import { OT_SlideItem } from './OT_SlideItem'

export const OT_SliderBlock = contentType({
  key:                  'OT_SliderBlock',
  displayName:          'Slider Block',
  description:          'Rotating slideshow with 2–8 slides. The Presentation Style chosen here determines the composition and transition; everything else is configured in the display settings.',
  baseType:             '_component',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    presentationStyle: {
      type:        'string',
      format:      'selectOne',
      displayName: 'Presentation Style',
      description: 'The slider’s art direction and motion signature. Each option restructures the slide, not just its color — pick the one that fits the content, then use the display settings to fine-tune it.',
      enum: [
        { value: 'cinematic',      displayName: 'Cinematic (Default)' },
        { value: 'editorialSplit', displayName: 'Editorial Split' },
        { value: 'storyRail',      displayName: 'Story Rail' },
        { value: 'emerge',         displayName: 'Emerge' },
      ],
      group:     'OT_Content',
      sortOrder: 5,
    },
    slideItems: {
      type:        'array',
      displayName: 'Slides',
      description: 'Slides shown in order. Minimum 2, maximum 8.',
      items:       { type: 'component', contentType: OT_SlideItem },
      group:       'OT_Content',
      sortOrder:   10,
    },
  },
})
