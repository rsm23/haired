import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import {
  Apple,
  ArrowRight,
  Braces,
  CircleAlert,
  Download,
  Eye,
  ExternalLink,
  History,
  Laptop,
  LockKeyhole,
  MonitorDown,
  MonitorOff,
  MousePointer2,
  ScanSearch,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Video,
  Zap
} from 'lucide-react'
import anthropicLogo from '@lobehub/icons-static-svg/icons/anthropic.svg'
import claudeLogo from '@lobehub/icons-static-svg/icons/claudecode-color.svg'
import codexLogo from '@lobehub/icons-static-svg/icons/codex-color.svg'
import geminiLogo from '@lobehub/icons-static-svg/icons/gemini-color.svg'
import lmStudioLogo from '@lobehub/icons-static-svg/icons/lmstudio.svg'
import mistralLogo from '@lobehub/icons-static-svg/icons/mistral-color.svg'
import ollamaLogo from '@lobehub/icons-static-svg/icons/ollama.svg'
import openAiLogo from '@lobehub/icons-static-svg/icons/openai.svg'
import type { AnalysisMode } from '@haired/contracts'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import './styles.css'

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'rahmani@seifelmoulouk.com'
const GITHUB_URL = import.meta.env.VITE_GITHUB_URL || 'https://github.com/rsm23/haired'
const RELEASE_VERSION = import.meta.env.VITE_RELEASE_VERSION || 'v0.1.1'
const RELEASE_NUMBER = RELEASE_VERSION.replace(/^v/, '')
const RELEASE_REPOSITORY_URL =
  import.meta.env.VITE_RELEASE_REPOSITORY_URL || 'https://github.com/rsm23/haired'
const RELEASE_DOWNLOAD_BASE_URL = `${RELEASE_REPOSITORY_URL}/releases/download/${RELEASE_VERSION}`
const RELEASE_PAGE_URL = `${RELEASE_REPOSITORY_URL}/releases/tag/${RELEASE_VERSION}`
const CHECKSUM_URL = `${RELEASE_DOWNLOAD_BASE_URL}/SHA256SUMS.txt`
const DOWNLOAD_URL = '#downloads'
const WORKSPACE_IMAGE_URL = `${import.meta.env.BASE_URL}assets/haired-workspace.jpg`

const downloadPackages = [
  {
    platform: 'Windows 10 / 11',
    architecture: '64-bit Intel or AMD',
    format: 'NSIS installer · .exe',
    fileName: `Haired-${RELEASE_NUMBER}-win-x64.exe`,
    url: `${RELEASE_DOWNLOAD_BASE_URL}/Haired-${RELEASE_NUMBER}-win-x64.exe`,
    icon: MonitorDown
  },
  {
    platform: 'macOS',
    architecture: 'Apple silicon',
    format: 'Disk image · .dmg',
    fileName: `Haired-${RELEASE_NUMBER}-mac-arm64.dmg`,
    url: `${RELEASE_DOWNLOAD_BASE_URL}/Haired-${RELEASE_NUMBER}-mac-arm64.dmg`,
    icon: Apple
  },
  {
    platform: 'macOS',
    architecture: 'Intel',
    format: 'Disk image · .dmg',
    fileName: `Haired-${RELEASE_NUMBER}-mac-x64.dmg`,
    url: `${RELEASE_DOWNLOAD_BASE_URL}/Haired-${RELEASE_NUMBER}-mac-x64.dmg`,
    icon: Apple
  }
]

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

const localProviders: Array<Provider & { command: string }> = [
  {
    name: 'LM Studio',
    logo: lmStudioLogo,
    className: 'provider-logo-monochrome',
    command: 'localhost:1234'
  },
  {
    name: 'Ollama',
    logo: ollamaLogo,
    className: 'provider-logo-monochrome',
    command: 'localhost:11434'
  }
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
    title: 'Capture the question',
    description: 'Select a coding prompt, error, diagram, terminal output, or any useful screen region.',
    icon: ScanSearch
  },
  {
    number: '02',
    title: 'Choose how to solve it',
    description: 'Get an instant solution or add your own question, constraints, and preferred answer depth.',
    icon: Sparkles
  },
  {
    number: '03',
    title: 'Learn and continue',
    description: 'Read the answer over your workspace, copy the code, ask a follow-up, or return to it later.',
    icon: Eye
  }
]

const capabilityHighlights = [
  {
    title: 'Solve complete coding exercises',
    description:
      'Turn a selected prompt, TODO, or broken snippet into an actionable solution with complete code when the task calls for it.',
    icon: Braces
  },
  {
    title: 'Debug errors and failing tests',
    description:
      'Capture stack traces, terminal output, compiler errors, or test failures and get a focused diagnosis with concrete next steps.',
    icon: Terminal
  },
  {
    title: 'Understand the reasoning',
    description:
      'Ask for a walkthrough, compare approaches, clarify a concept, or explore the trade-offs behind an implementation.',
    icon: Sparkles
  },
  {
    title: 'Choose Fast or Deep answers',
    description:
      'Use Fast for a direct fix and Deep for multi-step problems, checked assumptions, alternatives, and careful analysis.',
    icon: Zap
  },
  {
    title: 'Control what you read',
    description:
      'Switch between Code only and Full reply, then tune the overlay theme, opacity, shortcuts, position, and optional magnifier.',
    icon: Eye
  },
  {
    title: 'Revisit, refine, and export',
    description:
      'Search encrypted local history, continue with follow-up questions, rerun an answer, copy it, or export it as Markdown.',
    icon: History
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
          <a href="#downloads">Downloads</a>
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
          <a href={RELEASE_REPOSITORY_URL} target="_blank" rel="noreferrer">Releases</a>
          <a href="#/privacy">Privacy</a>
          <a href="#/terms">Terms</a>
          <a href="#/help">Help</a>
        </div>
      </footer>
    </div>
  )
}

function SharePreview() {
  return (
    <figure
      className="share-demo"
      aria-label="Haired appears on your desktop while a supported Windows meeting share receives the workspace without the Haired window"
    >
      <div className="share-demo-meta">
        <span className="share-live">
          <i />
          Screen-share privacy demo
        </span>
        <span>Supported Windows capture path</span>
      </div>

      <div className="share-canvas">
        <section className="desktop-view">
          <header>
            <span>
              <Laptop />
              Your desktop
            </span>
            <b>Private view</b>
          </header>
          <div className="desktop-surface">
            <img
              src={WORKSPACE_IMAGE_URL}
              alt="A technical workspace with a Haired answer visible above it"
              width="1586"
              height="992"
              loading="eager"
              fetchPriority="high"
            />
            <div className="selection-frame" aria-hidden="true" />
            <aside className="private-answer">
              <span className="answer-brand">
                <span className="logo-mark" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                HAIRED
              </span>
              <span>VISIBLE TO YOU</span>
              <strong>The request is validated before it reaches your chosen provider.</strong>
              <code>Fast · Codex</code>
            </aside>
          </div>
        </section>

        <div className="share-transfer" aria-hidden="true">
          <ArrowRight />
        </div>

        <section className="meeting-view">
          <header>
            <span>
              <Video />
              Meeting share
            </span>
            <b>
              <i /> Live
            </b>
          </header>
          <div className="meeting-surface">
            <img
              src={WORKSPACE_IMAGE_URL}
              alt=""
              width="1586"
              height="992"
              aria-hidden="true"
            />
            <div className="excluded-stamp">
              <MonitorOff />
              <span>
                <strong>Haired excluded</strong>
                The shared workspace stays clear
              </span>
            </div>
          </div>
          <div className="meeting-apps" role="list" aria-label="Supported meeting applications">
            <span role="listitem">Microsoft Teams</span>
            <span role="listitem">Zoom</span>
            <span role="listitem">Google Meet</span>
          </div>
        </section>
      </div>

      <figcaption>
        <strong>Windows 10/11:</strong> Haired requests OS-level exclusion before its windows are
        shown. <span>macOS protection is best effort and must be verified in the live preview.</span>
      </figcaption>
    </figure>
  )
}

function Home() {
  const [mode, setMode] = useState<AnalysisMode>('fast')

  return (
    <main>
      <section className="hero-section">
        <div className="hero-ambient" aria-hidden="true" />
        <div className="hero-layout">
          <div className="hero-copy">
            <span className="hero-kicker">
              <ShieldCheck />
              Technical interview & coding copilot
            </span>
            <h1>
              Get unstuck. <em>Get better.</em>
              <span>Get closer to hired.</span>
            </h1>
            <p>
              Haired helps you prepare for technical interviews and solve real coding problems
              without breaking your flow. Select a question, error, code sample, or diagram on
              your screen, then get a direct solution, complete code, or a deeper explanation from
              the AI provider you choose.
            </p>

            <div className="hero-actions">
              <Button asChild size="lg">
                <a href={DOWNLOAD_URL}>
                  <Download data-icon="inline-start" />
                  Download Haired
                </a>
              </Button>
              <a className="text-link" href="#product">
                See everything Haired can do
                <ArrowRight />
              </a>
            </div>

            <p className="hero-caveat">
              <strong>Screen-sharing privacy:</strong> Windows 10/11 can request OS-level exclusion
              on supported capture paths.
              <span>
                <strong>macOS:</strong> best effort—always check the live share preview.
              </span>
              <span>
                <strong>Responsible use:</strong> use Haired in assessments only when AI assistance
                is permitted, and disclose it when required.
              </span>
            </p>
          </div>

          <SharePreview />
        </div>
      </section>

      <section className="trust-rail" aria-label="Screen-sharing privacy boundary">
        <div>
          <Braces />
          <strong>Prepare for the questions that get you hired</strong>
          <span>Practice algorithms, debugging, system design, code review, and technical explanations.</span>
        </div>
        <div>
          <MonitorOff />
          <strong>Privacy controls for authorized screen sharing</strong>
          <span>Haired requests capture exclusion on supported Windows sharing paths; always verify the live preview.</span>
        </div>
      </section>

      <section className="capabilities-section section-grid" aria-labelledby="capabilities-title">
        <div className="section-heading">
          <h2 id="capabilities-title">
            Build the skills.
            <br />
            <em>Earn the offer.</em>
          </h2>
          <p>
            Use Haired as a focused technical-learning companion: practice before the interview,
            work through difficult code, and turn every answer into something you understand and
            can use.
          </p>
        </div>

        <div className="capability-grid">
          {capabilityHighlights.map((capability) => {
            const Icon = capability.icon
            return (
              <article key={capability.title}>
                <Icon />
                <h3>{capability.title}</h3>
                <p>{capability.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="workflow-section section-grid" id="product">
        <div className="section-heading">
          <h2>
            See it. Ask it.
            <br />
            <em>Solve it.</em>
          </h2>
          <p>
            Stay inside your editor, browser, terminal, or practice platform. Haired turns the
            selected part of your screen into a focused conversation with your chosen AI.
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
              {mode === 'fast' ? 'when every second counts.' : 'when the reasoning matters.'}
            </h3>
            <p>
              {mode === 'fast'
                ? 'Get a concise explanation, an exact correction, or the code you need to keep moving.'
                : 'Work through ambiguity, architecture, trade-offs, edge cases, and multi-step solutions.'}
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
                  ? 'Fix the stale closure by using the functional state updater.'
                  : 'Trace the async race, compare the viable fixes, and return the safest implementation with its trade-offs.'}
              </h4>
              <p>
                {mode === 'fast'
                  ? 'Fast is ideal for syntax, definitions, targeted debugging, and direct coding answers.'
                  : 'Deep checks assumptions and explains why the recommended approach is stronger than the alternatives.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="providers-section section-grid" id="providers">
        <div className="section-heading">
          <h2>
            Your models. Your accounts.
            <br />
            <em>No Haired subscription.</em>
          </h2>
          <p>
            Use an authenticated Codex or Claude CLI, automatically detect downloaded LM Studio
            and Ollama models, or bring an OpenAI, Anthropic, Gemini, Mistral, or compatible API
            key. Choose the model and reasoning level that fit the question.
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

          <div className="provider-group local-group">
            <div className="provider-group-title">
              <span>Run models locally</span>
              <i />
            </div>
            <div className="provider-list">
              {localProviders.map((provider) => (
                <article className="provider-item local-provider-item" key={provider.name}>
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
              <strong>Local models run</strong>
              on your computer
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

      <section className="downloads-section section-grid" id="downloads" aria-labelledby="downloads-title">
        <div className="downloads-heading">
          <div>
            <span className="page-label">Desktop preview · {RELEASE_VERSION}</span>
            <h2 id="downloads-title">
              Download Haired.
              <br />
              <em>Choose your computer.</em>
            </h2>
          </div>
          <p>
            Native packages for Windows and both current Mac architectures. Every button points
            directly to the matching GitHub-hosted release asset.
          </p>
        </div>

        <div className="download-grid">
          {downloadPackages.map((downloadPackage) => {
            const Icon = downloadPackage.icon
            return (
              <a
                className="download-card"
                href={downloadPackage.url}
                key={downloadPackage.fileName}
                aria-label={`Download ${downloadPackage.platform} for ${downloadPackage.architecture}`}
              >
                <span className="download-card-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="download-card-copy">
                  <strong>{downloadPackage.platform}</strong>
                  <span>{downloadPackage.architecture}</span>
                  <small>{downloadPackage.format}</small>
                  <code>{downloadPackage.fileName}</code>
                </span>
                <Download className="download-card-arrow" aria-hidden="true" />
              </a>
            )
          })}
        </div>

        <div className="download-release-meta">
          <div className="preview-notice">
            <CircleAlert aria-hidden="true" />
            <p>
              <strong>Unsigned preview build.</strong> Windows SmartScreen or macOS Gatekeeper may
              show a warning. Verify the SHA-256 checksum before opening the installer.
            </p>
          </div>
          <div className="release-links">
            <a href={RELEASE_PAGE_URL} target="_blank" rel="noreferrer">
              Release notes <ExternalLink />
            </a>
            <a href={CHECKSUM_URL} target="_blank" rel="noreferrer">
              SHA-256 checksums <ExternalLink />
            </a>
          </div>
        </div>
      </section>

      <section className="final-cta section-grid">
        <MousePointer2 aria-hidden="true" />
        <h2>
          Practice sharper. Solve faster. <em>Walk in ready.</em>
        </h2>
        <p>
          Build confidence before the interview, keep support in context at work, and use Haired
          in live assessments only when AI assistance is permitted.
        </p>
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
            LM Studio and Ollama requests go to the local server URL you configure. Codex and
            Claude connections run through their locally installed CLIs. BYOK requests are sent
            directly from the desktop app to your configured endpoint; Haired does not operate an
            AI proxy or receive your provider key.
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
      <h2>2. Or run a downloaded model locally</h2>
      <p>
        Start the LM Studio local server or Ollama, then activate that runtime in Haired. Haired
        detects the models currently available from the server; choose a vision-capable model and
        select “Use provider.” Use Refresh or “Detect models” after downloading or removing a
        model.
      </p>
      <h2>3. Or bring an API key</h2>
      <p>
        Activate OpenAI, Anthropic, Gemini, Mistral, or the OpenAI-compatible provider. Set its
        endpoint and model, paste the key, save it, then select the provider. The raw key is not
        displayed again.
      </p>
      <h2>4. Capture</h2>
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
