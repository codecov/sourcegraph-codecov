import * as assert from 'assert'
import { iconURL } from './icon'

describe('iconURL', () => {
  it('generates SVG with the given color', () =>
    assert.ok(iconURL('mycolor').includes('mycolor')))
})
