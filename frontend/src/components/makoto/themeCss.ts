// Light-theme overrides (dark is the base design).
export const THEME_CSS = String.raw`/* ===== Light theme: remaps the palette the whole UI is built from ===== */
html.mk-light {
  color-scheme: light;
  --mk-bg: #F6F7FB;
  --mk-pro-bg: #FFFFFF;
  --mk-grad: linear-gradient(90deg, #0D9488 0%, #2563EB 50%, #7C3AED 100%);
  --color-white: #0B0C12;
  --color-black: #FFFFFF;
  --color-zinc-50: #0B0C12; --color-zinc-100: #18181B; --color-zinc-200: #27272A; --color-zinc-300: #3F3F46;
  --color-zinc-400: #52525B; --color-zinc-500: #6B6B75; --color-zinc-600: #7C7C87; --color-zinc-700: #C4C4CC;
  --color-zinc-800: #E4E4E7; --color-zinc-900: #F1F1F4; --color-zinc-950: #FAFAFA;
  --color-teal-100: #115E59; --color-teal-200: #115E59; --color-teal-300: #0F766E; --color-teal-400: #0D9488;
  --color-emerald-100: #065F46; --color-emerald-200: #065F46; --color-emerald-300: #047857; --color-emerald-400: #059669;
  --color-rose-100: #9F1239; --color-rose-200: #9F1239; --color-rose-300: #BE123C; --color-rose-400: #E11D48;
  --color-amber-100: #92400E; --color-amber-200: #92400E; --color-amber-300: #B45309; --color-amber-400: #D97706;
  --color-violet-100: #5B21B6; --color-violet-200: #5B21B6; --color-violet-300: #6D28D9; --color-violet-400: #7C3AED;
  --color-sky-200: #075985; --color-sky-300: #0369A1; --color-sky-400: #0284C7;
  --color-blue-300: #1D4ED8; --color-blue-400: #2563EB;
}
html.mk-light body { background: #F6F7FB; color: #18181B }
html.mk-light ::selection { background: rgba(13,148,136,.2); color: #0B0C12 }
html.mk-light :where(button, a, [role="button"], [tabindex], input[type="checkbox"]):focus-visible { outline-color: #0D9488 }
html.mk-light .bg-black\/50, html.mk-light .bg-black\/60, html.mk-light .bg-black\/70 { background-color: rgba(15,18,30,.32) !important }
html.mk-light .mk-on-color { color: #fff !important }
html.mk-light select { color-scheme: light }
html.mk-light select option { background: #fff; color: #18181B }
html.mk-light .mk-skel { background: linear-gradient(90deg, rgba(0,0,0,.045) 25%, rgba(0,0,0,.085) 37%, rgba(0,0,0,.045) 63%); background-size: 400% 100% }
html.mk-light .mk-kbd { border-color: rgba(0,0,0,.12); background: rgba(0,0,0,.03); color: #52525B }
html.mk-light .mk-noise { opacity: .02; mix-blend-mode: multiply }
html.mk-light .mk-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,.14) }
html.mk-light .mk-text-gradient { background-image: linear-gradient(90deg, #0B0C12 0%, #1D4ED8 25%, #0F766E 45%, #6D28D9 65%, #0B0C12 100%) }
html.mk-light .mk-thinking { background-image: linear-gradient(90deg, #A1A1AA 0%, #27272A 50%, #A1A1AA 100%) }
html.mk-light .mk-cursor::after, html.mk-light .mk-cursor-last > :last-child::after, html.mk-light .mk-cursor-last li:last-child::after { background: #0D9488 }
html.mk-light .mk-aurora-gl { display: none }
html.mk-light .mk-aurora-bg { background: radial-gradient(60% 50% at 30% 40%, rgba(59,130,246,.14), transparent 70%), radial-gradient(50% 40% at 70% 60%, rgba(45,212,191,.14), transparent 70%), radial-gradient(40% 35% at 55% 20%, rgba(124,58,237,.08), transparent 70%), #F6F7FB !important }
html.mk-light .mk-md { color: #3F3F46 }
html.mk-light .mk-md h1, html.mk-light .mk-md h2, html.mk-light .mk-md h3, html.mk-light .mk-md strong { color: #0B0C12 }
html.mk-light .mk-md li::marker { color: #0D9488 }
html.mk-light .mk-md a { color: #0369A1; text-decoration-color: rgba(3,105,161,.35) }
html.mk-light .mk-md code { background: rgba(0,0,0,.055) }
html.mk-light .mk-md pre code { background: none }
html.mk-light .mk-md blockquote { border-left-color: #0D9488; color: #52525B }
html.mk-light .mk-md thead { background: rgba(0,0,0,.025) }
html.mk-light .mk-md th { color: #52525B; border-bottom-color: rgba(0,0,0,.1) }
html.mk-light .mk-md td { border-bottom-color: rgba(0,0,0,.06) }
html.mk-light .mk-md hr { border-color: rgba(0,0,0,.08) }
html.mk-light .mk-code { background: #F7F7FA; border-color: rgba(0,0,0,.08); color: #27272A }
html.mk-light .hljs-comment, html.mk-light .hljs-quote { color: #71717A }
html.mk-light .hljs-keyword, html.mk-light .hljs-selector-tag, html.mk-light .hljs-built_in, html.mk-light .hljs-doctag { color: #6D28D9 }
html.mk-light .hljs-string, html.mk-light .hljs-attr-value, html.mk-light .hljs-regexp, html.mk-light .hljs-addition { color: #0F766E }
html.mk-light .hljs-number, html.mk-light .hljs-literal, html.mk-light .hljs-symbol, html.mk-light .hljs-bullet { color: #C2410C }
html.mk-light .hljs-title, html.mk-light .hljs-title.function_, html.mk-light .hljs-section { color: #1D4ED8 }
html.mk-light .hljs-attr, html.mk-light .hljs-variable, html.mk-light .hljs-template-variable, html.mk-light .hljs-property { color: #0369A1 }
html.mk-light .hljs-type, html.mk-light .hljs-class .hljs-title, html.mk-light .hljs-title.class_ { color: #BE185D }
html.mk-light .hljs-meta, html.mk-light .hljs-deletion { color: #BE123C }
html.mk-light .hljs-punctuation, html.mk-light .hljs-operator { color: #52525B }
html.mk-light [data-sonner-toaster] { --normal-bg: #fff }
html, body { transition: background-color .25s ease }
html.mk-light .bg-\[\#030308\],html.mk-light .\!bg-\[\#030308\]{background-color:#F6F7FB!important}
html.mk-light .bg-\[\#05060B\],html.mk-light .\!bg-\[\#05060B\]{background-color:#F6F7FB!important}
html.mk-light .bg-\[\#05060B\]\/40,html.mk-light .\!bg-\[\#05060B\]\/40{background-color:rgba(246,247,251,0.4)!important}
html.mk-light .bg-\[\#05060B\]\/80,html.mk-light .\!bg-\[\#05060B\]\/80{background-color:rgba(246,247,251,0.8)!important}
html.mk-light .bg-\[\#05060B\]\/90,html.mk-light .\!bg-\[\#05060B\]\/90{background-color:rgba(246,247,251,0.9)!important}
html.mk-light .bg-\[\#07080e\],html.mk-light .\!bg-\[\#07080e\]{background-color:#FFFFFF!important}
html.mk-light .bg-\[\#07080e\]\/90,html.mk-light .\!bg-\[\#07080e\]\/90{background-color:rgba(255,255,255,0.9)!important}
html.mk-light .bg-\[\#070912\],html.mk-light .\!bg-\[\#070912\]{background-color:#FFFFFF!important}
html.mk-light .bg-\[\#08080f\]\/85,html.mk-light .\!bg-\[\#08080f\]\/85{background-color:rgba(255,255,255,0.88)!important}
html.mk-light .bg-\[\#08080f\]\/90,html.mk-light .\!bg-\[\#08080f\]\/90{background-color:rgba(255,255,255,0.9)!important}
html.mk-light .bg-\[\#0a0b12\]\/80,html.mk-light .\!bg-\[\#0a0b12\]\/80{background-color:rgba(255,255,255,0.88)!important}
html.mk-light .bg-\[\#0b0b13\]\/70,html.mk-light .\!bg-\[\#0b0b13\]\/70{background-color:rgba(255,255,255,0.88)!important}
html.mk-light .bg-\[\#0b0b13\]\/80,html.mk-light .\!bg-\[\#0b0b13\]\/80{background-color:rgba(255,255,255,0.88)!important}
html.mk-light .bg-\[\#0b0b14\],html.mk-light .\!bg-\[\#0b0b14\]{background-color:#FFFFFF!important}
html.mk-light .bg-\[\#0b0c14\]\/80,html.mk-light .\!bg-\[\#0b0c14\]\/80{background-color:rgba(255,255,255,0.88)!important}
html.mk-light .bg-\[\#0c0c15\],html.mk-light .\!bg-\[\#0c0c15\]{background-color:#FFFFFF!important}
html.mk-light .bg-\[\#0c0d15\]\/95,html.mk-light .\!bg-\[\#0c0d15\]\/95{background-color:rgba(255,255,255,0.95)!important}
html.mk-light .bg-\[\#0d0e16\]\/95,html.mk-light .\!bg-\[\#0d0e16\]\/95{background-color:rgba(255,255,255,0.95)!important}
html.mk-light .bg-\[\#10111a\]\/95,html.mk-light .\!bg-\[\#10111a\]\/95{background-color:rgba(255,255,255,0.95)!important}
html.mk-light .bg-\[\#11121b\]\/90,html.mk-light .\!bg-\[\#11121b\]\/90{background-color:rgba(255,255,255,0.9)!important}
html.mk-light .bg-\[\#16171f\],html.mk-light .\!bg-\[\#16171f\]{background-color:#FFFFFF!important}
html.mk-light .border-\[\#0b0c14\]{border-color:#FFFFFF!important}
html.mk-light .from-\[\#0f1a2e\]{--tw-gradient-from:#EEF4FF!important}
html.mk-light .to-\[\#030308\]{--tw-gradient-to:#F6F7FB!important}
html.mk-light .to-\[\#05060B\]{--tw-gradient-to:#F6F7FB!important}
html.mk-light .to-\[\#160f2a\]{--tw-gradient-to:#F3EEFF!important}
html.mk-light .via-\[\#0b0b16\]{--tw-gradient-via:#F7F8FC!important}
html.mk-light .via-\[\#0b0c14\]{--tw-gradient-via:#F7F8FC!important}
html.mk-light .via-\[\#0b0c14\]\/85{--tw-gradient-via:#F7F8FC!important}

/* ===== Chat ambient backdrop ===== */
.mk-chat-bg { background: radial-gradient(120% 80% at 50% 0%, #0A0D1A 0%, #05060B 60%) }
.mk-chat-glow { position: absolute; border-radius: 9999px; filter: blur(90px); will-change: transform; animation: mk-drift 26s ease-in-out infinite alternate }
.mk-chat-glow-a { width: 46vw; height: 46vw; max-width: 620px; max-height: 620px; left: -12%; top: -18%; background: radial-gradient(circle, rgba(45,212,191,.20), transparent 65%) }
.mk-chat-glow-b { width: 42vw; height: 42vw; max-width: 560px; max-height: 560px; right: -14%; top: 18%; background: radial-gradient(circle, rgba(124,58,237,.20), transparent 65%); animation-duration: 32s; animation-delay: -8s }
.mk-chat-glow-c { width: 60vw; height: 30vw; max-width: 820px; max-height: 360px; left: 50%; bottom: -14%; margin-left: -30vw; background: radial-gradient(closest-side, rgba(59,130,246,.22), transparent 70%); animation-duration: 22s; animation-delay: -4s }
.mk-chat-grid { background-image: radial-gradient(rgba(255,255,255,.075) 1px, transparent 1.2px); background-size: 22px 22px; -webkit-mask-image: radial-gradient(70% 60% at 50% 40%, #000 0%, transparent 75%); mask-image: radial-gradient(70% 60% at 50% 40%, #000 0%, transparent 75%) }
@keyframes mk-drift { 0% { transform: translate3d(0,0,0) scale(1) } 50% { transform: translate3d(4%,6%,0) scale(1.08) } 100% { transform: translate3d(-5%,2%,0) scale(.96) } }
@keyframes mk-pulse-ring { 0% { transform: scale(.6); opacity: .7 } 100% { transform: scale(2.4); opacity: 0 } }
@media (prefers-reduced-motion: reduce) { .mk-chat-glow { animation: none } }
html.mk-light .mk-chat-bg { background: radial-gradient(120% 80% at 50% 0%, #EEF2FF 0%, #F6F7FB 60%) }
html.mk-light .mk-chat-glow-a { background: radial-gradient(circle, rgba(13,148,136,.14), transparent 65%) }
html.mk-light .mk-chat-glow-b { background: radial-gradient(circle, rgba(124,58,237,.10), transparent 65%) }
html.mk-light .mk-chat-glow-c { background: radial-gradient(closest-side, rgba(37,99,235,.12), transparent 70%) }
html.mk-light .mk-chat-grid { background-image: radial-gradient(rgba(15,23,42,.09) 1px, transparent 1.2px) }
`
