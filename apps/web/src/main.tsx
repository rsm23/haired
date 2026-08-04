import { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import {
  Apple,
  ArrowRight,
  Braces,
  CircleAlert,
  Download,
  Eye,
  ExternalLink,
  GitFork,
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
const X_URL = 'https://x.com/c_madangle'
const RELEASE_VERSION = import.meta.env.VITE_RELEASE_VERSION || 'v0.1.2'
const RELEASE_NUMBER = RELEASE_VERSION.replace(/^v/, '')
const RELEASE_REPOSITORY_URL =
  import.meta.env.VITE_RELEASE_REPOSITORY_URL || 'https://github.com/rsm23/haired'
const RELEASE_DOWNLOAD_BASE_URL = `${RELEASE_REPOSITORY_URL}/releases/download/${RELEASE_VERSION}`
const RELEASE_PAGE_URL = `${RELEASE_REPOSITORY_URL}/releases/tag/${RELEASE_VERSION}`
const CHECKSUM_URL = `${RELEASE_DOWNLOAD_BASE_URL}/SHA256SUMS.txt`
const DOWNLOAD_URL = '#downloads'
const LOGO_URL = `${import.meta.env.BASE_URL}favicon.svg`
const WORKSPACE_IMAGE_URL = `${import.meta.env.BASE_URL}assets/haired-workspace.jpg`
const PROVIDERS_IMAGE_URL = `${import.meta.env.BASE_URL}assets/haired-providers.jpg`
const APPEARANCE_IMAGE_URL = `${import.meta.env.BASE_URL}assets/haired-appearance.jpg`
const SHORTCUTS_IMAGE_URL = `${import.meta.env.BASE_URL}assets/haired-shortcuts.jpg`
const PRIVACY_IMAGE_URL = `${import.meta.env.BASE_URL}assets/haired-privacy.jpg`

const screenshots = [
  {
    src: PROVIDERS_IMAGE_URL,
    alt: 'Haired AI providers settings showing Codex, Claude, LM Studio, Ollama, and BYOK options',
    caption: 'Bring your own provider'
  },
  {
    src: APPEARANCE_IMAGE_URL,
    alt: 'Haired appearance and behavior settings with themes, opacity, and answer style options',
    caption: 'Tune the overlay'
  },
  {
    src: SHORTCUTS_IMAGE_URL,
    alt: 'Haired global shortcut settings for capture, ask, settings, and window movement',
    caption: 'Keyboard-first control'
  },
  {
    src: PRIVACY_IMAGE_URL,
    alt: 'Haired privacy check with capture protection status and diagnostics',
    caption: 'Verify before you share'
  }
]

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

const marqueeProviders: Provider[] = [
  { name: 'Codex CLI', logo: codexLogo },
  { name: 'Claude Code', logo: claudeLogo },
  { name: 'OpenAI', logo: openAiLogo, className: 'provider-logo-monochrome' },
  { name: 'Anthropic', logo: anthropicLogo, className: 'provider-logo-monochrome' },
  { name: 'Gemini', logo: geminiLogo },
  { name: 'Mistral', logo: mistralLogo },
  { name: 'LM Studio', logo: lmStudioLogo, className: 'provider-logo-monochrome' },
  { name: 'Ollama', logo: ollamaLogo, className: 'provider-logo-monochrome' }
]

const heroStats = [
  {
    value: 9,
    prefix: '',
    suffix: '',
    label: 'AI providers',
    detail: 'CLI agents, local runtimes, and your own API keys'
  },
  {
    value: 0,
    prefix: '$',
    suffix: '',
    label: 'per month',
    detail: 'No Haired plan—bring the subscription you already pay for'
  },
  {
    value: 0,
    prefix: '',
    suffix: '',
    label: 'accounts required',
    detail: 'No sign-up, no hosted proxy, no usage credits'
  },
  {
    value: 100,
    prefix: '',
    suffix: '%',
    label: 'open source',
    detail: 'MIT licensed and built to be forked'
  }
]

type TerminalLine = { prompt?: string; text: string; instant?: boolean }

const forkTerminalLines: TerminalLine[] = [
  { prompt: '~/code', text: 'git clone https://github.com/rsm23/haired.git' },
  { text: '✓ Cloned haired', instant: true },
  { prompt: '~/code/haired', text: 'pnpm install && pnpm dev' },
  { text: '▲ Haired overlay running — yours to reshape', instant: true }
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
    description:
      'Get an instant solution, ask your own question, or turn on Interview Mode for a narrated reasoning-and-code walkthrough.',
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
    title: 'Practice with Interview Mode',
    description:
      'Alternate detailed technical reasoning with complete code sections, including the plan, trade-offs, edge cases, complexity, and validation.',
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
        <img src={LOGO_URL} alt="" width="24" height="24" />
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

function CountUp({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const numberRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const element = numberRef.current
    if (!element) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.textContent = String(value)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        observer.disconnect()
        const duration = 1300
        const start = performance.now()
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1)
          element.textContent = String(Math.round(value * (1 - Math.pow(1 - progress, 3))))
          if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.6 }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [value])

  return (
    <span className="stat-number">
      {prefix}
      <span ref={numberRef}>0</span>
      {suffix}
    </span>
  )
}

function StatsBand() {
  return (
    <section className="stats-band section-grid" aria-label="Haired by the numbers">
      <ul>
        {heroStats.map((stat, index) => (
          <li key={stat.label} data-reveal style={{ transitionDelay: `${index * 90}ms` }}>
            <CountUp value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
            <strong>{stat.label}</strong>
            <span className="stat-detail">{stat.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ProviderMarquee() {
  return (
    <section className="logo-marquee" aria-label="Supported AI providers and runtimes">
      <p>Works with the AI stack you already pay for</p>
      <div className="marquee">
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1 || undefined}>
            {marqueeProviders.map((provider) => (
              <li key={provider.name}>
                <ProviderMark provider={provider} />
                {provider.name}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  )
}

function TypingTerminal({ lines }: { lines: TerminalLine[] }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)
  const [progress, setProgress] = useState({ line: 0, char: 0 })

  useEffect(() => {
    const element = frameRef.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStarted(true)
          observer.disconnect()
        }
      },
      { threshold: 0.35 }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress({ line: lines.length, char: 0 })
      return
    }

    let line = 0
    let char = 0
    let timer = 0

    const step = () => {
      const current = lines[line]
      if (!current) return
      if (current.instant || char >= current.text.length) {
        line += 1
        char = 0
        setProgress({ line, char })
        timer = window.setTimeout(step, current.instant ? 520 : 700)
      } else {
        char += 1
        setProgress({ line, char })
        timer = window.setTimeout(step, 24 + Math.random() * 44)
      }
    }

    timer = window.setTimeout(step, 400)
    return () => window.clearTimeout(timer)
  }, [started, lines])

  return (
    <div
      className="oss-terminal"
      ref={frameRef}
      role="img"
      aria-label="Terminal cloning the Haired repository and starting the development build"
    >
      <div className="oss-terminal-bar" aria-hidden="true">
        <span />
        <span />
        <span />
        <i>haired — zsh</i>
      </div>
      <pre aria-hidden="true">
        {lines.map((line, index) => {
          if (index > progress.line) return null
          const isCurrent = index === progress.line
          const text = isCurrent && !line.instant ? line.text.slice(0, progress.char) : line.text
          return (
            <span className="terminal-line" data-kind={line.prompt ? 'command' : 'output'} key={index}>
              {line.prompt ? <span className="terminal-prompt">{line.prompt} $ </span> : null}
              {text}
              {isCurrent && !line.instant ? <span className="terminal-cursor" /> : null}
            </span>
          )
        })}
        {progress.line >= lines.length ? (
          <span className="terminal-line" data-kind="command">
            <span className="terminal-prompt">~/code/haired $ </span>
            <span className="terminal-cursor" />
          </span>
        ) : null}
      </pre>
    </div>
  )
}

function OpenSourceSection() {
  return (
    <section className="oss-section section-grid" aria-labelledby="oss-title">
      <div className="oss-copy" data-reveal>
        <span className="page-label">MIT licensed</span>
        <h2 id="oss-title">
          Don't like something?
          <br />
          <em>Fork it.</em>
        </h2>
        <ul>
          <li>
            <strong>Restyle every surface.</strong> Overlay, themes, shortcuts—make it match your
            taste.
          </li>
          <li>
            <strong>Wire in your own provider.</strong> Add a runtime, a model, or a whole new
            flow.
          </li>
          <li>
            <strong>Ship your own build.</strong> Self-host it or distribute it as your own.
          </li>
        </ul>
        <div className="oss-links">
          <Button asChild variant="outline">
            <a href={`${GITHUB_URL}/fork`} target="_blank" rel="noreferrer">
              <GitFork data-icon="inline-start" />
              Fork on GitHub
            </a>
          </Button>
          <a className="text-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
            Browse the source
            <ArrowRight />
          </a>
        </div>
      </div>

      <TypingTerminal lines={forkTerminalLines} />
    </section>
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
        <p>Free, open-source stealth pair-programming and interview AI assistant.</p>
        <div>
          <a href={RELEASE_REPOSITORY_URL} target="_blank" rel="noreferrer">Releases</a>
          <a href="#/privacy">Privacy</a>
          <a href="#/terms">Terms</a>
          <a href="#/help">Help</a>
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Follow c_madangle on X (formerly Twitter)"
          >
            @c_madangle
          </a>
        </div>
      </footer>
    </div>
  )
}

function SharePreview() {
  return (
    <figure
      className="share-demo"
      data-reveal
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
                  <img src={LOGO_URL} alt="" width="24" height="24" />
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

function ScreenshotGallery() {
  const [active, setActive] = useState(0)

  return (
    <section className="screenshots-section section-grid" aria-labelledby="screenshots-title">
      <div className="section-heading" data-reveal>
        <span className="page-label">Built for focus</span>
        <h2 id="screenshots-title">
          See how it works.
          <br />
          <em>Inside your workflow.</em>
        </h2>
        <p>
          Configure once, then capture and solve without leaving the app you're already in.
        </p>
      </div>

      <div className="screenshot-gallery" data-reveal>
        <div className="screenshot-stage">
          {screenshots.map((shot, index) => (
            <img
              key={shot.src}
              src={shot.src}
              alt={shot.alt}
              className={active === index ? 'screenshot-active' : ''}
              loading={index === 0 ? 'eager' : 'lazy'}
              width="1280"
              height="800"
            />
          ))}
          <span className="screenshot-caption" aria-live="polite">
            {screenshots[active]?.caption}
          </span>
        </div>

        <div className="screenshot-thumbs" role="tablist" aria-label="Screenshot gallery">
          {screenshots.map((shot, index) => (
            <button
              key={shot.src}
              type="button"
              role="tab"
              aria-selected={active === index}
              aria-label={`View ${shot.caption}`}
              className={active === index ? 'thumb-active' : ''}
              onClick={() => setActive(index)}
            >
              <img src={shot.src} alt="" width="200" height="125" />
              <span>{shot.caption}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function Home() {
  const [mode, setMode] = useState<AnalysisMode>('fast')
  const [interviewMode, setInterviewMode] = useState(true)

  return (
    <main>
      <section className="hero-section">
        <div className="hero-aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="hero-layout">
          <div className="hero-copy" data-reveal>
            <span className="hero-kicker">
              <ShieldCheck />
              Stealth pair programming & interview AI assistant
            </span>
            <h1>
              Get unstuck. <em>Get better.</em>
              <span>Get closer to hired.</span>
            </h1>
            <p>
              Haired is a stealth pair-programming and interview AI assistant. Select a question,
              error, code sample, or diagram on your screen, then get a direct solution, complete
              code, or a deeper explanation from the AI provider you choose—without breaking your flow.
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

            <p className="hero-note">
              Free and open source. No account, no hosted proxy, no usage credits.
            </p>

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

      <ProviderMarquee />

      <section className="trust-rail" aria-label="Screen-sharing privacy boundary">
        <div>
          <Braces />
          <strong>Stealth pair programming for interview prep</strong>
          <span>Practice algorithms, debugging, system design, code review, and technical explanations without leaving your workflow.</span>
        </div>
        <div>
          <MonitorOff />
          <strong>Privacy controls for authorized screen sharing</strong>
          <span>Haired requests capture exclusion on supported Windows sharing paths; always verify the live preview.</span>
        </div>
      </section>

      <StatsBand />

      <section className="capabilities-section section-grid" aria-labelledby="capabilities-title">
        <div className="section-heading" data-reveal>
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
          {capabilityHighlights.map((capability, index) => {
            const Icon = capability.icon
            return (
              <article key={capability.title} data-reveal style={{ transitionDelay: `${index * 70}ms` }}>
                <Icon />
                <h3>{capability.title}</h3>
                <p>{capability.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="workflow-section section-grid" id="product">
        <div className="section-heading" data-reveal>
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
          {workflowSteps.map((step, index) => {
            const Icon = step.icon
            return (
              <li key={step.number} data-reveal style={{ transitionDelay: `${index * 110}ms` }}>
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

        <div className="mode-section" data-reveal>
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

        <div className="interview-section" id="interview-mode" data-reveal>
          <div className="interview-copy">
            <span className="interview-kicker">
              <Sparkles />
              New in v0.1.2
            </span>
            <h3>
              Reason. Code.
              <br />
              <em>Repeat.</em>
            </h3>
            <p>
              Turn on Interview Mode when you want more than a finished answer. Haired asks your
              provider to explain the problem, plan, implementation choices, trade-offs, edge
              cases, complexity, and validation alongside the corresponding code.
            </p>
            <ToggleGroup
              className="interview-toggle"
              type="single"
              variant="outline"
              size="lg"
              value={interviewMode ? 'interview' : 'direct'}
              aria-label="Interview answer format"
              onValueChange={(value) => {
                if (value === 'direct' || value === 'interview') {
                  setInterviewMode(value === 'interview')
                }
              }}
            >
              <ToggleGroupItem value="direct">Direct answer</ToggleGroupItem>
              <ToggleGroupItem value="interview">
                <Sparkles />
                Interview Mode
              </ToggleGroupItem>
            </ToggleGroup>
            <small>
              Opt in from Appearance &amp; behavior. Full reply stays selected so every explanation
              remains visible.
            </small>
          </div>

          <div className="interview-output" aria-live="polite">
            <div className="interview-output-head">
              <span>
                <Braces />
                answer.tsx
              </span>
              <b data-enabled={interviewMode}>{interviewMode ? 'Interview on' : 'Direct'}</b>
            </div>
            {interviewMode ? (
              <div className="interview-output-body">
                <div className="reasoning-step">
                  <span>Reasoning 01</span>
                  <p>
                    Keep the selected task as the source of truth, then separate the interview
                    explanation from each implementation step so the solution is easy to narrate.
                  </p>
                </div>
                <pre>
                  <code>{`const [interviewMode, setInterviewMode] = useState(false)\n\nconst answerStyle = interviewMode ? 'full-reply' : savedStyle`}</code>
                </pre>
                <div className="reasoning-step">
                  <span>Reasoning 02</span>
                  <p>
                    Full reply prevents the code-only filter from hiding the walkthrough. The
                    preference persists, but remains disabled by default for existing workflows.
                  </p>
                </div>
                <pre>
                  <code>{`if (interviewMode) {\n  requirements.push(INTERVIEW_MODE_INSTRUCTION)\n}`}</code>
                </pre>
                <div className="reasoning-review">
                  <span>Final review</span>
                  Complete code · edge cases · complexity · validation
                </div>
              </div>
            ) : (
              <div className="direct-output-body">
                <span>Answer</span>
                <h4>Enable the setting and append the matching response instruction.</h4>
                <pre>
                  <code>{`const answerStyle = interviewMode ? 'full-reply' : savedStyle`}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      </section>

      <ScreenshotGallery />

      <section className="providers-section section-grid" id="providers">
        <div className="section-heading" data-reveal>
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

        <div className="provider-groups" data-reveal>
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

        <div className="privacy-band" data-reveal>
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

      <OpenSourceSection />

      <section className="downloads-section section-grid" id="downloads" aria-labelledby="downloads-title">
        <div className="downloads-heading" data-reveal>
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

        <div className="download-grid" data-reveal>
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

      <section className="final-cta section-grid" data-reveal>
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

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed')
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' }
    )

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [route])

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
