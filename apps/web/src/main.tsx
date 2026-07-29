import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import {
  ArrowRight,
  Braces,
  Command,
  Download,
  Eye,
  KeyRound,
  LockKeyhole,
  MousePointer2,
  ScanSearch,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap
} from 'lucide-react'
import anthropicLogo from '@lobehub/icons-static-svg/icons/anthropic.svg'
import claudeLogo from '@lobehub/icons-static-svg/icons/claudecode-color.svg'
import codexLogo from '@lobehub/icons-static-svg/icons/codex-color.svg'
import geminiLogo from '@lobehub/icons-static-svg/icons/gemini-color.svg'
import mistralLogo from '@lobehub/icons-static-svg/icons/mistral-color.svg'
import openAiLogo from '@lobehub/icons-static-svg/icons/openai.svg'
import type { AnalysisMode } from '@haired/contracts'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import './styles.css'

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@example.invalid'
const DOWNLOAD_URL = import.meta.env.VITE_DOWNLOAD_URL || '#/help'
const GITHUB_URL = import.meta.env.VITE_GITHUB_URL || ''
const WORKSPACE_IMAGE_URL = `${import.meta.env.BASE_URL}assets/haired-workspace.jpg`

declare global {
  interface Window {
    __hairedWebRoot?: ReturnType<typeof ReactDOM.createRoot>
  }
}

type Route = 'home' | 'privacy' | 'terms' | 'help'

type Provider = {
  name: string
  logo?: string
  className?: string
}

const cliProviders: Array<Provider & { command: string }> = [
  { name: 'Codex CLI', logo: codexLogo, command: 'codex login' },
  { name: 'Claude Code', logo: claudeLogo, command: 'claude auth login' }
]

const apiProviders: Provider[] = [
  { name: 'OpenAI', logo: openAiLogo, className: 'provider-logo-monochrome' },
  { name: 'Anthropic', logo: anthropicLogo, className: 'provider-logo-monochrome' },
  { name: 'Gemini', logo: geminiLogo },
  { name: 'Mistral', logo: mistralLogo },
  { name: 'Compatible API' }
]

const workflowSteps = [
  {
    number: '01',
    title: 'Select',
    description: 'Drag over any region.',
    icon: ScanSearch
  },
  {
    number: '02',
    title: 'Ask',
    description: 'Use a default prompt or type your own.',
    icon: Sparkles
  },
  {
    number: '03',
    title: 'Continue',
    description: 'Read the answer without leaving context.',
    icon: Eye
  }
]

function currentRoute(): Route {
  const match = window.location.hash.match(/^#\/(privacy|terms|help)(?:$|[?#])/)
  return match?.[1] as Route | undefined ?? 'home'
}

function Logo() {
  return (
    <a className="logo" href="./" aria-label="Haired home">
      <span className="logo-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      HAIRED
    </a>
  )
}

function ProviderMark({ provider }: { provider: Provider }) {
  return (
    <span className="provider-mark" aria-hidden="true">
      {provider.logo ? (
        <img className={provider.className} src={provider.logo} alt="" />
      ) : (
        <Braces />
      )}
    </span>
  )
}

function Shell({ children, route }: { children: React.ReactNode; route: Route }) {
  return (
    <div className="site">
      <header className="nav">
        <Logo />
        <nav aria-label="Main navigation">
          <a href="#product">Product</a>
          <a href="#providers">Providers</a>
          <a href="#/privacy" aria-current={route === 'privacy' ? 'page' : undefined}>
            Privacy
          </a>
          <a href="#/help" aria-current={route === 'help' ? 'page' : undefined}>
            Help
          </a>
          {GITHUB_URL ? (
            <a className="nav-source" href={GITHUB_URL} target="_blank" rel="noreferrer">
              Source
            </a>
          ) : null}
          <Button asChild size="sm">
            <a href={DOWNLOAD_URL}>
              Download
              <Download data-icon="inline-end" />
            </a>
          </Button>
        </nav>
      </header>

      {children}

      <footer>
        <Logo />
        <p>Free, keyboard-first screen intelligence.</p>
        <div>
          <a href="#/privacy">Privacy</a>
          <a href="#/terms">Terms</a>
          <a href="#/help">Help</a>
        </div>
      </footer>
    </div>
  )
}

function ProductFrame() {
  return (
    <figure className="product-frame" aria-label="Haired selecting and explaining part of a workspace">
      <div className="window-bar" aria-hidden="true">
        <span />
        <span />
        <span />
        <i>Workspace</i>
        <b>⌘ ⇧ A</b>
      </div>
      <div className="workspace-scene">
        <img
          src={WORKSPACE_IMAGE_URL}
          alt="A dark technical workspace with code and a process diagram"
          width="1586"
          height="992"
          loading="eager"
          fetchPriority="high"
        />
        <div className="selection-box" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <aside className="answer-panel">
          <div className="answer-panel-head">
            <span className="answer-brand">
              <span className="logo-mark" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              HAIRED
            </span>
            <span className="answer-provider">
              <img src={codexLogo} alt="" />
              Codex
            </span>
          </div>
          <span className="answer-label">SELECTED REGION</span>
          <h3>Explain this flow.</h3>
          <p>
            The selected branch validates the input, routes the request, and returns the safe
            response without interrupting your current window.
          </p>
          <code>Fast answer · local provider</code>
        </aside>
      </div>
    </figure>
  )
}

function Home() {
  const [mode, setMode] = useState<AnalysisMode>('fast')

  return (
    <main>
      <section className="hero-section">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-provider hero-provider-codex" aria-hidden="true">
          <img src={codexLogo} alt="" />
        </div>
        <div className="hero-provider hero-provider-claude" aria-hidden="true">
          <img src={claudeLogo} alt="" />
        </div>
        <div className="hero-provider hero-provider-gemini" aria-hidden="true">
          <img src={geminiLogo} alt="" />
        </div>
        <div className="hero-provider hero-provider-mistral" aria-hidden="true">
          <img src={mistralLogo} alt="" />
        </div>

        <div className="hero-copy">
          <h1>
            Ask anything
            <br />
            on your <em>screen.</em>
          </h1>
          <p>
            Select any region. Get an answer from Codex, Claude, or your own API key—without
            leaving what you’re doing.
          </p>
          <div className="hero-actions">
            <Button asChild size="lg">
              <a href={DOWNLOAD_URL}>
                <Download data-icon="inline-start" />
                Download Haired
              </a>
            </Button>
            <a className="text-link" href="#product">
              See how it works
              <ArrowRight />
            </a>
          </div>
          <div className="hero-proof" aria-label="Haired product facts">
            <span>Free app</span>
            <i />
            <span>Local credentials</span>
            <i />
            <span>No Haired credits</span>
          </div>
        </div>

        <ProductFrame />
      </section>

      <section className="trust-rail" aria-label="Credential and provider architecture">
        <div>
          <Command />
          <strong>Use your CLI login</strong>
          <span>Codex and Claude stay signed in through their own tools.</span>
        </div>
        <div>
          <KeyRound />
          <strong>Bring your own key</strong>
          <span>Choose OpenAI, Anthropic, Gemini, Mistral, or a compatible API.</span>
        </div>
        <div>
          <ShieldCheck />
          <strong>Keep credentials local</strong>
          <span>Saved keys use operating-system encryption on this computer.</span>
        </div>
      </section>

      <section className="workflow-section section-grid" id="product">
        <div className="section-heading">
          <h2>
            One shortcut.
            <br />
            Then you’re <em>back to work.</em>
          </h2>
          <p>
            Capture only what matters, ask your question, and keep the answer above the screen
            underneath.
          </p>
        </div>

        <ol className="workflow-rail">
          {workflowSteps.map((step) => {
            const Icon = step.icon
            return (
              <li key={step.number}>
                <span className="workflow-node">
                  <Icon />
                </span>
                <div>
                  <span className="workflow-number">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            )
          })}
        </ol>

        <div className="mode-section">
          <div className="mode-copy">
            <h3>
              <em>{mode === 'fast' ? 'Fast' : 'Deep'}</em>{' '}
              {mode === 'fast' ? 'for momentum.' : 'for the hard parts.'}
            </h3>
            <p>
              {mode === 'fast'
                ? 'A concise answer for definitions, summaries, and quick fixes.'
                : 'A fuller analysis for ambiguity, comparisons, and careful reasoning.'}
            </p>
            <ToggleGroup
              className="mode-toggle"
              type="single"
              variant="outline"
              size="lg"
              value={mode}
              aria-label="Answer depth"
              onValueChange={(value) => {
                if (value === 'fast' || value === 'deep') setMode(value)
              }}
            >
              <ToggleGroupItem value="fast">
                <Zap />
                Fast
              </ToggleGroupItem>
              <ToggleGroupItem value="deep">
                <Sparkles />
                Deep
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="mode-output" aria-live="polite">
            <div className="mode-output-head">
              <span>
                <Terminal />
                answer.md
              </span>
              <b>{mode}</b>
            </div>
            <div className="mode-output-body">
              <span>ANSWER</span>
              <h4>
                {mode === 'fast'
                  ? 'The selected handler validates, routes, and returns the response.'
                  : 'The selected handler has three responsibilities: validation, provider routing, and safe response serialization.'}
              </h4>
              <p>
                {mode === 'fast'
                  ? 'Use Deep when you want assumptions checked or tradeoffs compared.'
                  : 'It keeps the provider boundary explicit while preserving a predictable local result path.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="providers-section section-grid" id="providers">
        <div className="section-heading">
          <h2>
            Your AI access.
            <br />
            No <em>Haired subscription.</em>
          </h2>
          <p>
            Use an authenticated Codex or Claude CLI, or bring your own key for OpenAI, Anthropic,
            Gemini, Mistral, and compatible APIs.
          </p>
        </div>

        <div className="provider-groups">
          <div className="provider-group cli-group">
            <div className="provider-group-title">
              <span>Use your CLI</span>
              <i />
            </div>
            <div className="provider-list">
              {cliProviders.map((provider) => (
                <article className="provider-item cli-provider-item" key={provider.name}>
                  <ProviderMark provider={provider} />
                  <strong>{provider.name}</strong>
                  <code>{provider.command}</code>
                </article>
              ))}
            </div>
          </div>

          <div className="provider-divider" aria-hidden="true" />

          <div className="provider-group api-group">
            <div className="provider-group-title">
              <span>Use your API key</span>
              <i />
            </div>
            <div className="provider-list">
              {apiProviders.map((provider) => (
                <article className="provider-item" key={provider.name}>
                  <ProviderMark provider={provider} />
                  <strong>{provider.name}</strong>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="privacy-band">
          <div>
            <LockKeyhole />
            <span>
              <strong>Credentials stay</strong>
              on this computer
            </span>
          </div>
          <div>
            <ShieldCheck />
            <span>
              <strong>Keys use</strong>
              OS encryption
            </span>
          </div>
          <div>
            <Send />
            <span>
              <strong>Requests go directly</strong>
              to the selected provider
            </span>
          </div>
        </div>
      </section>

      <section className="final-cta section-grid">
        <MousePointer2 aria-hidden="true" />
        <h2>
          Get answers <em>without losing your place.</em>
        </h2>
        <p>One shortcut. Your provider. Your screen stays in context.</p>
        <Button asChild size="lg">
          <a href={DOWNLOAD_URL}>
            Download Haired
            <ArrowRight data-icon="inline-end" />
          </a>
        </Button>
        <a className="quiet-link" href="#/privacy">
          Read the privacy details
        </a>
      </section>
    </main>
  )
}

function Legal({ kind }: { kind: 'privacy' | 'terms' }) {
  return (
    <main className="text-page section-grid">
      <span className="page-label">{kind}</span>
      <h1>{kind === 'privacy' ? 'Privacy architecture' : 'Terms of use'}</h1>
      {kind === 'privacy' ? (
        <>
          <h2>Provider connections</h2>
          <p>
            Codex and Claude connections run through their locally installed CLIs. BYOK requests
            are sent directly from the desktop app to the endpoint you configure; Haired does not
            operate an AI proxy or receive your provider key.
          </p>
          <h2>Local storage</h2>
          <p>
            BYOK secrets and history encryption keys use operating-system secure storage.
            Successful screenshots, prompts, and answers are stored only in the encrypted local
            history database. Capture crops remain in memory during a request.
          </p>
          <h2>Capture protection</h2>
          <p>
            Protected overlays are excluded from supported Windows capture paths. Protection on
            macOS is best effort and must be checked in the active meeting share preview.
          </p>
        </>
      ) : (
        <>
          <h2>Free software access</h2>
          <p>
            Haired does not sell an in-app plan. You are responsible for the provider account,
            subscription, API charges, rate limits, and acceptable-use terms connected in settings.
          </p>
          <h2>No universal capture guarantee</h2>
          <p>
            Capture exclusion depends on operating-system and meeting-app behavior and is not DRM.
            Verify sensitive sharing workflows before relying on it.
          </p>
          <h2>Your credentials</h2>
          <p>
            Keep CLI accounts and API keys secure. Remove a saved key from Providers when it should
            no longer be usable on that computer.
          </p>
        </>
      )}
    </main>
  )
}

function Help() {
  return (
    <main className="text-page section-grid" id="download">
      <span className="page-label">Help</span>
      <h1>Set up Haired</h1>
      <h2>1. Install and sign in to a CLI</h2>
      <p>
        For Codex, install the Codex CLI and run <code>codex login</code>. For Claude Code, run{' '}
        <code>claude auth login</code>. Open Haired → AI providers, activate the matching CLI,
        refresh status, and choose “Use this provider.”
      </p>
      <h2>2. Or bring an API key</h2>
      <p>
        Activate OpenAI, Anthropic, Gemini, Mistral, or the OpenAI-compatible provider. Set its
        endpoint and model, paste the key, save it, then select the provider. The raw key is not
        displayed again.
      </p>
      <h2>3. Capture</h2>
      <p>
        Use the Select & answer or Select & ask shortcut. If a provider refuses the request, check
        its account limits, key permissions, model access, and endpoint.
      </p>
      <h2>Support</h2>
      <p>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </main>
  )
}

function App() {
  const [route, setRoute] = useState<Route>(currentRoute)

  useEffect(() => {
    const handleHashChange = () => {
      const nextRoute = currentRoute()
      setRoute(nextRoute)

      window.requestAnimationFrame(() => {
        const anchor = window.location.hash.replace(/^#/, '')
        if (nextRoute === 'home' && anchor && !anchor.startsWith('/')) {
          document.getElementById(anchor)?.scrollIntoView()
        } else {
          window.scrollTo({ top: 0 })
        }
      })
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  let content: React.ReactNode
  if (route === 'privacy') content = <Legal kind="privacy" />
  else if (route === 'terms') content = <Legal kind="terms" />
  else if (route === 'help') content = <Help />
  else content = <Home />

  return <Shell route={route}>{content}</Shell>
}

const container = document.getElementById('root')
if (!container) throw new Error('Root element was not found')
window.__hairedWebRoot ??= ReactDOM.createRoot(container)
window.__hairedWebRoot.render(<App />)
