import { useEffect, useRef } from 'react'

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`
const FRAG = `
precision highp float;
uniform vec2 r; uniform float t; uniform vec2 m; uniform float k;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),u.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n(p); p*=2.02; a*=.5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / r; vec2 p = (gl_FragCoord.xy - .5*r) / r.y;
  float tt = t*.06;
  vec2 q = vec2(fbm(p*1.4 + tt), fbm(p*1.4 - tt + 3.1));
  float f = fbm(p*1.8 + q*1.6 + vec2(tt*1.5, -tt));
  float band1 = smoothstep(.35,.0, abs(p.y + .15 - .35*sin(p.x*1.6 + tt*6. + q.x*2.)));
  float band2 = smoothstep(.45,.0, abs(p.y - .25 - .25*sin(p.x*2.1 - tt*5. + q.y*2.5)));
  vec3 c1 = vec3(.16,.46,.95);  // usdc blue
  vec3 c2 = vec3(.37,.92,.83);  // mint
  vec3 c3 = vec3(.55,.42,1.);   // violet
  vec3 col = vec3(.012,.012,.03);
  col += c1 * band1 * (.55 + .6*f);
  col += mix(c3, c2, uv.x) * band2 * (.35 + .5*f);
  float md = length(p - (m - .5) * vec2(r.x/r.y, 1.));
  col += c2 * .18 * exp(-md*md*6.);
  col *= .55 + .45*f;
  col *= smoothstep(1.25, .2, length(p*vec2(.8,1.1)));
  col = mix(vec3(.012,.012,.03), col, k);
  gl_FragColor = vec4(col, 1.);
}`

/** Animated WebGL aurora background. Falls back to CSS gradients. */
export function Aurora({ intensity = 1, className = '' }: { intensity?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false })
    if (!gl) return
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const uR = gl.getUniformLocation(prog, 'r')
    const uT = gl.getUniformLocation(prog, 't')
    const uM = gl.getUniformLocation(prog, 'm')
    const uK = gl.getUniformLocation(prog, 'k')

    const mouse = { x: 0.5, y: 0.6, tx: 0.5, ty: 0.6 }
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.tx = (e.clientX - rect.left) / rect.width
      mouse.ty = 1 - (e.clientY - rect.top) / rect.height
    }
    window.addEventListener('pointermove', onMove)

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25) * 0.75
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr))
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr))
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    let raf = 0
    let visible = true
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting })
    io.observe(canvas)
    const start = performance.now()
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!visible) return
      mouse.x += (mouse.tx - mouse.x) * 0.04
      mouse.y += (mouse.ty - mouse.y) * 0.04
      gl.uniform2f(uR, canvas.width, canvas.height)
      gl.uniform1f(uT, reduce ? 20 : (now - start) / 1000 + 20)
      gl.uniform2f(uM, mouse.x, mouse.y)
      gl.uniform1f(uK, intensity)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      if (reduce) cancelAnimationFrame(raf)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', resize)
    }
  }, [intensity])

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div className="mk-aurora-bg absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 30% 40%, rgba(41,118,242,.25), transparent 70%), radial-gradient(50% 40% at 70% 60%, rgba(94,234,212,.15), transparent 70%), #030308' }} />
      <canvas ref={ref} className="mk-aurora-gl absolute inset-0 h-full w-full" />
    </div>
  )
}

/**
 * Calm ambient backdrop for an active conversation: slow-drifting colour glows
 * plus a faint dot grid that fades towards the edges, so the eye rests on the
 * centre column. Pure CSS (no WebGL) so it stays cheap during long chats.
 */
export function ChatBackdrop() {
  return (
    <div aria-hidden className="mk-chat-bg pointer-events-none absolute inset-0 overflow-hidden">
      <div className="mk-chat-glow mk-chat-glow-a" />
      <div className="mk-chat-glow mk-chat-glow-b" />
      <div className="mk-chat-glow mk-chat-glow-c" />
      <div className="mk-chat-grid absolute inset-0" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-300/20 to-transparent" />
    </div>
  )
}
