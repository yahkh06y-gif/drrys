// The AI sometimes writes math the LaTeX way ("$\lambda$", "$\delta(q_0, a)$"). The app shows plain text, so
// that turns into symbols here (λ, δ(q₀, a)) before anything reaches the screen. It runs on the raw reply, so
// it also has to read the doubled backslashes of a JSON reply ("$\\lambda$").

const SYMBOL: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ',
  iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ',
  upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  times: '×', cdot: '·', div: '÷', pm: '±', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈',
  to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', leftrightarrow: '↔', mapsto: '↦',
  in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩', emptyset: '∅', varnothing: '∅',
  infty: '∞', sum: '∑', prod: '∏', int: '∫', partial: '∂', nabla: '∇', sqrt: '√', forall: '∀', exists: '∃',
  neg: '¬', land: '∧', wedge: '∧', lor: '∨', vee: '∨', ldots: '…', dots: '…', cdots: '⋯', circ: '∘', deg: '°',
};
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', n: 'ⁿ', i: 'ⁱ', '*': '*' };
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋' };

const BS = String.raw`\\{1,2}`; // one backslash, or two inside a JSON string
const COMMAND = new RegExp(`${BS}([A-Za-z]+)(?![A-Za-z])`, 'g');
const WRAP = new RegExp(`${BS}(?:text|mathrm|mathbf|mathit|mathcal|operatorname)\\s*\\{([^{}]*)\\}`, 'g');
const FRAC = new RegExp(`${BS}frac\\s*\\{([^{}]*)\\}\\s*\\{([^{}]*)\\}`, 'g');
const BRACE = new RegExp(`${BS}([{}])`, 'g');

/** "q_0" → "q₀", "x^2" → "x²", "q_{10}" → "q₁₀" (anything without a small form stays as it is, without the braces). */
function scripts(s: string): string {
  const conv = (map: Record<string, string>, body: string) => ([...body].every((ch) => map[ch]) ? [...body].map((ch) => map[ch]).join('') : body);
  return s
    .replace(/_\{([^{}]{1,12})\}/g, (_, b) => conv(SUB, b))
    .replace(/\^\{([^{}]{1,12})\}/g, (_, b) => conv(SUP, b))
    .replace(/([^\s^_])_([0-9])/g, (_, a, b) => a + SUB[b])
    .replace(/([^\s^_])\^([0-9n*+-])/g, (_, a, b) => a + SUP[b]);
}

/** Turn LaTeX math in a piece of AI text into plain symbols. Text with no math comes back unchanged. */
export function plainMath(s: string): string {
  if (!/\\|\$/.test(s)) return s;
  const known = (m: string, name: string) => SYMBOL[name] ?? m;
  // inside $…$ (or \( … \)): convert and drop the delimiters
  const inline = (body: string) =>
    scripts(body.replace(WRAP, '$1').replace(FRAC, '$1/$2').replace(COMMAND, (m, n) => (SYMBOL[n] ?? (n === 'left' || n === 'right' ? '' : m))).replace(BRACE, '$1'))
      .replace(/[{}]/g, '')
      .trim();
  let out = s
    .replace(/\\+\$/g, '$') // "\$" (an escaped dollar) is still a math delimiter here
    .replace(/\$\$([^$]{1,200}?)\$\$/g, (_, b) => inline(b))
    .replace(/\$([^$\n]{1,120}?)\$/g, (m, b: string) => (/[\\^_]/.test(b) || b.trim().length <= 3 ? inline(b) : m)) // "$5 and $10" is money, not math
    .replace(new RegExp(`${BS}[(\\[]([^]{1,200}?)${BS}[)\\]]`, 'g'), (_, b) => inline(b));
  // a command left outside any $…$ (e.g. "the \lambda move")
  out = scripts(out.replace(WRAP, '$1').replace(COMMAND, known));
  return out;
}
