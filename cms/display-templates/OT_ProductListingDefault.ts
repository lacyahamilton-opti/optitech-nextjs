import { displayTemplate } from '@optimizely/cms-sdk'

export const OT_ProductListingDefault = displayTemplate({
  key:         'OT_ProductListingDefault',
  displayName: 'Product Listing',
  contentType: 'OT_ProductListingBlock',
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
    columns: {
      displayName: 'Columns (desktop)',
      editor:      'select',
      sortOrder:   20,
      choices: {
        col3: { displayName: '3 columns',           sortOrder: 10 },
        col4: { displayName: '4 columns (Default)', sortOrder: 20 },
      },
    },
    cardAspect: {
      displayName: 'Image Shape',
      editor:      'select',
      sortOrder:   30,
      choices: {
        portrait: { displayName: 'Portrait 4:5 (Default)', sortOrder: 10 },
        square:   { displayName: 'Square',                 sortOrder: 20 },
      },
    },
    showFacets: {
      displayName: 'Show Filters & Sort',
      editor:      'select',
      sortOrder:   40,
      choices: {
        'true':  { displayName: 'Yes (Default)', sortOrder: 10 },
        'false': { displayName: 'No',            sortOrder: 20 },
      },
    },
    tilePosition: {
      displayName: 'Editorial Tile Position',
      editor:      'select',
      sortOrder:   50,
      choices: {
        pos3: { displayName: 'After 3 products (Default)',           sortOrder: 10 },
        pos5: { displayName: 'After 5 products', sortOrder: 20 },
        pos7: { displayName: 'After 7 products',           sortOrder: 30 },
      },
    },
  },
})
