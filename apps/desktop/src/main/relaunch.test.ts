import { describe, expect, it } from 'vitest'
import { prepareRelaunchEnvironment } from './relaunch'

describe('development relaunch', () => {
  it('removes the renderer dev-server URL before Electron relaunches', () => {
    const environment = {
      ELECTRON_RENDERER_URL: 'http://localhost:5173'
    }

    prepareRelaunchEnvironment(false, environment)

    expect(environment).not.toHaveProperty('ELECTRON_RENDERER_URL')
  })

  it('preserves the packaged application environment', () => {
    const environment = {
      ELECTRON_RENDERER_URL: 'https://example.invalid'
    }

    prepareRelaunchEnvironment(true, environment)

    expect(environment.ELECTRON_RENDERER_URL).toBe('https://example.invalid')
  })
})
