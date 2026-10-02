import { displayTemplate } from '@optimizely/cms-sdk'

export const OT_IndustryNewsFeedDefault = displayTemplate({
  key:         'OT_IndustryNewsFeedDefault',
  displayName: 'Industry News Feed',
  contentType: 'OT_IndustryNewsFeedBlock',
  isDefault:   true,
  settings: {
    color: {
      displayName: 'Background',
      editor:      'select',
      sortOrder:   10,
      choices: {
        canvas:  { displayName: 'Canvas (Default)', sortOrder: 10 },
        surface: { displayName: 'Surface',          sortOrder: 20 },
      },
    },
  },
})
