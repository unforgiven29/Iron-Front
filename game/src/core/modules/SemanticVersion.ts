/**
 * Semantic version parsing and range matching for module capability resolution.
 *
 * Supported range syntax (space-separated comparators are AND-ed):
 *   "1.2.3" exact, "^1.2.3", "~1.2.3", ">=1.2.3", ">1.2.3", "<=1.2.3", "<1.2.3", "*".
 * A prerelease version only satisfies a range whose comparators name the same
 * major.minor.patch with a prerelease tag, so a range never silently admits prereleases.
 */
export interface SemanticVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: readonly string[];
}

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseVersion(text: string): SemanticVersion | null {
  const match = VERSION_PATTERN.exec(text);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : []
  };
}

function comparePrerelease(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn) {
      const d = Number(x) - Number(y);
      if (d !== 0) return Math.sign(d);
    } else if (xn !== yn) {
      return xn ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

export function compareVersions(a: SemanticVersion, b: SemanticVersion): number {
  if (a.major !== b.major) return Math.sign(a.major - b.major);
  if (a.minor !== b.minor) return Math.sign(a.minor - b.minor);
  if (a.patch !== b.patch) return Math.sign(a.patch - b.patch);
  return comparePrerelease(a.prerelease, b.prerelease);
}

type Operator = ">=" | ">" | "<=" | "<" | "=";
interface Comparator { readonly op: Operator; readonly version: SemanticVersion }
export interface VersionRange { readonly text: string; readonly comparators: readonly Comparator[] }

const base = (major: number, minor: number, patch: number): SemanticVersion => ({ major, minor, patch, prerelease: [] });

/** Returns null when the range text is not understood; callers must report that, never treat it as "any". */
export function parseRange(text: string): VersionRange | null {
  const tokens = text.trim().split(/\s+/).filter((token) => token.length > 0);
  if (tokens.length === 0) return null;
  const comparators: Comparator[] = [];
  for (const token of tokens) {
    if (token === "*") continue;
    const match = /^(\^|~|>=|>|<=|<|=)?(.+)$/.exec(token);
    if (!match) return null;
    const version = parseVersion(match[2] ?? "");
    if (!version) return null;
    const prefix = match[1] ?? "=";
    const { major, minor, patch } = version;
    switch (prefix) {
      case "^": {
        const upper = major > 0 ? base(major + 1, 0, 0) : minor > 0 ? base(0, minor + 1, 0) : base(0, 0, patch + 1);
        comparators.push({ op: ">=", version }, { op: "<", version: upper });
        break;
      }
      case "~":
        comparators.push({ op: ">=", version }, { op: "<", version: base(major, minor + 1, 0) });
        break;
      default:
        comparators.push({ op: prefix as Operator, version });
    }
  }
  return { text, comparators };
}

function sameCore(a: SemanticVersion, b: SemanticVersion): boolean {
  return a.major === b.major && a.minor === b.minor && a.patch === b.patch;
}

export function satisfies(version: SemanticVersion, range: VersionRange): boolean {
  if (version.prerelease.length > 0) {
    const allowed = range.comparators.some((c) => c.version.prerelease.length > 0 && sameCore(c.version, version));
    if (!allowed) return false;
  }
  return range.comparators.every(({ op, version: bound }) => {
    const d = compareVersions(version, bound);
    switch (op) {
      case ">=": return d >= 0;
      case ">": return d > 0;
      case "<=": return d <= 0;
      case "<": return d < 0;
      case "=": return d === 0;
    }
  });
}
