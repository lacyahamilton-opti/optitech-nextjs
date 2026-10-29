import { displayTemplate } from '@optimizely/cms-sdk'

/**
 * Mirrors OT_TabsDefault's settings exactly (minus tabStyle, which lives as
 * a content property on OT_TabItemBlock — see OT_TabsBlock for the same
 * split). When 2+ OT_TabItemBlock elements sit adjacently in a column,
 * cms/compositions/Column.tsx groups them into one tab switcher and reads
 * these settings from the first item in the run only.
 */
export const OT_TabItemDefault = displayTemplate({
  key:         'OT_TabItemDefault',
  displayName: 'Tab Item',
  contentType: 'OT_TabItemBlock',
  isDefault:   true,
  settings: {
    tabPosition: {
      displayName: 'Tab Position',
      editor:      'select',
      sortOrder:   20,
      choices: {
        top:  { displayName: 'Top (Default)', sortOrder: 10 },
        side: { displayName: 'Side',          sortOrder: 20 },
      },
    },
    color: {
      displayName: 'Color',
      editor:      'select',
      sortOrder:   30,
      choices: {
        canvas:  { displayName: 'Canvas (Default)',                          sortOrder: 10 },
        surface: { displayName: 'Surface',                                   sortOrder: 20 },
        brand:   { displayName: 'Brand',                                     sortOrder: 30 },
        glass:   { displayName: 'Glass (use over imagery or brand sections)', sortOrder: 40 },
      },
    },
    contentLayout: {
      displayName: 'Panel Content Layout',
      editor:      'select',
      sortOrder:   40,
      choices: {
        textOnly:   { displayName: 'Text Only (Default)', sortOrder: 10 },
        imageRight: { displayName: 'Image Right',         sortOrder: 20 },
        imageLeft:  { displayName: 'Image Left',          sortOrder: 30 },
      },
    },
    triggerAlign: {
      displayName: 'Trigger Alignment',
      editor:      'select',
      sortOrder:   50,
      choices: {
        left:   { displayName: 'Left (Default)', sortOrder: 10 },
        center: { displayName: 'Center',         sortOrder: 20 },
      },
    },
    autoPlay: {
      displayName: 'Auto-Play',
      editor:      'select',
      sortOrder:   60,
      choices: {
        off: { displayName: 'Off (Default)', sortOrder: 10 },
        on:  { displayName: 'On',            sortOrder: 20 },
      },
    },
    autoPlayDuration: {
      displayName: 'Auto-Play Duration',
      editor:      'select',
      sortOrder:   70,
      choices: {
        s3: { displayName: '3 seconds', sortOrder: 10 },
        s5: { displayName: '5 seconds (Default)', sortOrder: 20 },
        s7: { displayName: '7 seconds', sortOrder: 30 },
      },
    },
    entranceAnimation: {
      displayName: 'Entrance animation',
      editor:      'select',
      sortOrder:   80,
      choices: {
        none:     { displayName: 'None (Default)', sortOrder: 10 },
        fade:     { displayName: 'Fade in',        sortOrder: 20 },
        slide:    { displayName: 'Slide up',       sortOrder: 30 },
        parallax: { displayName: 'Parallax',       sortOrder: 40 },
        reveal:   { displayName: 'Curtain reveal', sortOrder: 50 },
      },
    },
  },
})
