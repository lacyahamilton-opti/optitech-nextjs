import { displayTemplate } from '@optimizely/cms-sdk'

export const OT_CommerceFlowDefault = displayTemplate({
  key:         'OT_CommerceFlowDefault',
  displayName: 'Commerce Flow',
  contentType: 'OT_CommerceFlowBlock',
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
    summaryStyle: {
      displayName: 'Order Summary Panel',
      editor:      'select',
      sortOrder:   20,
      choices: {
        surface: { displayName: 'Surface panel (Default)', sortOrder: 10 },
        brand:   { displayName: 'Brand panel',             sortOrder: 20 },
        ruled:   { displayName: 'Ruled, no fill',          sortOrder: 30 },
      },
    },
  },
})
