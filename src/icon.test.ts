import * as assert from 'assert'
import { iconURL } from './icon'

describe('iconURL', () => {
  it('returns', () => assert.doesNotThrow(() => iconURL('red')))
})
