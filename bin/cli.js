#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

const ESC = String.fromCharCode(27);
const COLOR = {
  reset: ESC + '[0m',
  dim: ESC + '[2m',
  bold: ESC + '[1m',
  red: ESC + '[31m',
  green: ESC + '[32m',
  yellow: ESC + '[33m',
  cyan: ESC + '[36m',
};

const HELP = `
${COLOR.bold}capacitor-rich-haptics${COLOR.reset} — AHAP utilities

Usage:
  capacitor-rich-haptics <command> [args]

Commands:
  ${COLOR.cyan}validate <file>${COLOR.reset}     Check that an .ahap / JSON file is a valid AHAP pattern.
  ${COLOR.cyan}info <file>${COLOR.reset}         Print stats: events, duration, parameter ranges.
  ${COLOR.cyan}list${COLOR.reset}                List built-in patterns grouped by category.
  ${COLOR.cyan}export <name>${COLOR.reset}       Print a built-in pattern as AHAP JSON to stdout.
  ${COLOR.cyan}render <file> [--out=<svg>]${COLOR.reset}
                       Render the pattern as SVG (writes to file or stdout).
  ${COLOR.cyan}migrate <files...> [--write]${COLOR.reset}
                       Rewrite @capacitor/haptics calls to capacitor-rich-haptics.
                       Defaults to dry-run; pass --write to apply.

Examples:
  capacitor-rich-haptics validate ./Heartbeat.ahap
  capacitor-rich-haptics info ./mypattern.json
  capacitor-rich-haptics export heartbeat > Heartbeat.ahap
  capacitor-rich-haptics render heartbeat --out=preview.svg
`;

function readPattern(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf-8');
  } catch (err) {
    fail('Cannot read file: ' + err.message);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail('Invalid JSON: ' + err.message);
  }
  return parsed;
}

function fail(msg) {
  console.error(COLOR.red + 'error: ' + COLOR.reset + msg);
  process.exit(1);
}

function ok(msg) {
  console.log(COLOR.green + '✓ ' + COLOR.reset + msg);
}

function validatePattern(pattern) {
  const errors = [];
  if (typeof pattern !== 'object' || pattern === null) {
    errors.push('root must be an object');
    return errors;
  }
  if (!Array.isArray(pattern.Pattern)) {
    errors.push('root.Pattern must be an array');
    return errors;
  }
  pattern.Pattern.forEach(function (el, i) {
    if (!el || typeof el !== 'object') {
      errors.push('Pattern[' + i + '] is not an object');
      return;
    }
    if (el.Event) {
      const ev = el.Event;
      if (typeof ev.Time !== 'number') errors.push('Pattern[' + i + '].Event.Time missing/non-numeric');
      if (typeof ev.EventType !== 'string') errors.push('Pattern[' + i + '].Event.EventType missing');
      if (ev.EventType === 'HapticContinuous' && typeof ev.EventDuration !== 'number') {
        errors.push('Pattern[' + i + '].Event.EventDuration required for HapticContinuous');
      }
      if (ev.EventParameters) {
        if (!Array.isArray(ev.EventParameters)) {
          errors.push('Pattern[' + i + '].Event.EventParameters must be an array');
        } else {
          ev.EventParameters.forEach(function (p, j) {
            if (typeof p.ParameterID !== 'string')
              errors.push('Pattern[' + i + '].EventParameters[' + j + '].ParameterID missing');
            if (typeof p.ParameterValue !== 'number')
              errors.push('Pattern[' + i + '].EventParameters[' + j + '].ParameterValue missing');
          });
        }
      }
    } else if (el.ParameterCurve) {
      const c = el.ParameterCurve;
      if (typeof c.ParameterID !== 'string') errors.push('Pattern[' + i + '].ParameterCurve.ParameterID missing');
      if (typeof c.Time !== 'number') errors.push('Pattern[' + i + '].ParameterCurve.Time missing');
      if (!Array.isArray(c.ParameterCurveControlPoints)) {
        errors.push('Pattern[' + i + '].ParameterCurve.ParameterCurveControlPoints must be array');
      }
    } else if (el.Parameter) {
      // dynamic parameter — fine
    } else {
      errors.push('Pattern[' + i + '] is neither Event, Parameter, nor ParameterCurve');
    }
  });
  return errors;
}

function patternStats(pattern) {
  let transients = 0,
    continuous = 0,
    curves = 0,
    audio = 0;
  let end = 0;
  let minI = Infinity,
    maxI = -Infinity,
    minS = Infinity,
    maxS = -Infinity;
  pattern.Pattern.forEach(function (el) {
    if (el.Event) {
      const ev = el.Event;
      const evEnd = ev.Time + (ev.EventDuration || 0);
      if (evEnd > end) end = evEnd;
      if (ev.EventType === 'HapticTransient') transients++;
      else if (ev.EventType === 'HapticContinuous') continuous++;
      else if (ev.EventType && ev.EventType.indexOf('Audio') === 0) audio++;
      (ev.EventParameters || []).forEach(function (p) {
        if (p.ParameterID === 'HapticIntensity') {
          minI = Math.min(minI, p.ParameterValue);
          maxI = Math.max(maxI, p.ParameterValue);
        }
        if (p.ParameterID === 'HapticSharpness') {
          minS = Math.min(minS, p.ParameterValue);
          maxS = Math.max(maxS, p.ParameterValue);
        }
      });
    } else if (el.ParameterCurve) {
      curves++;
      const c = el.ParameterCurve;
      const lastT =
        c.ParameterCurveControlPoints.length > 0
          ? c.ParameterCurveControlPoints[c.ParameterCurveControlPoints.length - 1].Time
          : 0;
      const evEnd = c.Time + lastT;
      if (evEnd > end) end = evEnd;
    }
  });
  return {
    transients,
    continuous,
    curves,
    audio,
    duration: end,
    intensity: { min: minI, max: maxI },
    sharpness: { min: minS, max: maxS },
  };
}

function loadPlugin() {
  const tryPaths = [path.resolve(__dirname, '..', 'dist', 'plugin.cjs.js')];
  for (const p of tryPaths) {
    if (fs.existsSync(p)) return require(p);
  }
  fail('Could not find compiled plugin. Run `npm run build` first.');
}

function cmdValidate(file) {
  if (!file) fail('validate: missing <file> argument');
  const pat = readPattern(file);
  const errors = validatePattern(pat);
  if (errors.length === 0) {
    ok('valid AHAP pattern (' + pat.Pattern.length + ' elements)');
  } else {
    console.error(COLOR.red + 'Found ' + errors.length + ' issue(s):' + COLOR.reset);
    errors.forEach(function (e) {
      console.error('  ' + COLOR.dim + '- ' + COLOR.reset + e);
    });
    process.exit(1);
  }
}

function cmdInfo(file) {
  if (!file) fail('info: missing <file> argument');
  const pat = readPattern(file);
  const errors = validatePattern(pat);
  if (errors.length > 0) {
    console.error(COLOR.yellow + 'warning: pattern has ' + errors.length + ' validation issues' + COLOR.reset);
  }
  const s = patternStats(pat);
  console.log(COLOR.bold + 'Pattern stats' + COLOR.reset);
  console.log('  duration:   ' + s.duration.toFixed(3) + 's');
  console.log('  transients: ' + s.transients);
  console.log('  continuous: ' + s.continuous);
  console.log('  curves:     ' + s.curves);
  console.log('  audio:      ' + s.audio);
  if (isFinite(s.intensity.min)) {
    console.log('  intensity:  ' + s.intensity.min.toFixed(2) + ' .. ' + s.intensity.max.toFixed(2));
  }
  if (isFinite(s.sharpness.min)) {
    console.log('  sharpness:  ' + s.sharpness.min.toFixed(2) + ' .. ' + s.sharpness.max.toFixed(2));
  }
  if (pat.Metadata) {
    console.log(COLOR.bold + '\nMetadata' + COLOR.reset);
    Object.keys(pat.Metadata).forEach(function (k) {
      console.log('  ' + k + ': ' + JSON.stringify(pat.Metadata[k]));
    });
  }
}

function cmdList() {
  const plugin = loadPlugin();
  const all = plugin.patterns;
  const byCategory = {};
  Object.keys(all).forEach(function (name) {
    const meta = all[name].Metadata || {};
    const cat = meta.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({ name: name, description: meta.description || '' });
  });

  console.log(COLOR.bold + Object.keys(all).length + ' built-in patterns' + COLOR.reset + '\n');
  Object.keys(byCategory)
    .sort()
    .forEach(function (cat) {
      console.log(COLOR.cyan + cat + COLOR.reset);
      byCategory[cat].forEach(function (p) {
        console.log('  ' + p.name.padEnd(20) + COLOR.dim + p.description + COLOR.reset);
      });
      console.log('');
    });
}

function cmdExport(name) {
  if (!name) fail('export: missing <name> argument. Run `list` to see available patterns.');
  const plugin = loadPlugin();
  const pat = plugin.patterns[name];
  if (!pat) fail('Unknown pattern: "' + name + '". Run `list` to see available patterns.');
  process.stdout.write(JSON.stringify(pat, null, 2) + '\n');
}

function cmdRender(arg, args) {
  if (!arg) fail('render: missing pattern argument (file path or built-in name)');

  const plugin = loadPlugin();
  let pattern, title;
  if (plugin.patterns[arg]) {
    pattern = plugin.patterns[arg];
    title = arg;
  } else {
    pattern = readPattern(arg);
    title = path.basename(arg);
  }

  const svg = plugin.renderHapticTimelineSVG(pattern, { title: title });
  let outPath = null;
  args.forEach(function (a) {
    if (a.indexOf('--out=') === 0) outPath = a.slice('--out='.length);
  });

  if (outPath) {
    fs.writeFileSync(outPath, svg);
    ok('wrote ' + outPath);
  } else {
    process.stdout.write(svg + '\n');
  }
}

// ── Migrate command ─────────────────────────────────────────────────────────

const MIGRATE_RULES = [
  // Imports
  {
    pattern: /from\s+['"]@capacitor\/haptics['"]/g,
    replacement: "from 'capacitor-rich-haptics'",
    label: 'import path',
  },
  {
    pattern: /import\s+\{\s*Haptics(\s*,\s*[A-Za-z]+)*\s*\}\s+from\s+['"]capacitor-rich-haptics['"]/g,
    replacement: "import { RichHaptics } from 'capacitor-rich-haptics'",
    label: 'named import (post-import-rewrite)',
  },
  // impact() → preset()
  {
    pattern: /Haptics\.impact\(\s*\{\s*style\s*:\s*ImpactStyle\.Light\s*\}\s*\)/g,
    replacement: "RichHaptics.preset({ name: 'softTap' })",
    label: 'Haptics.impact(Light)',
  },
  {
    pattern: /Haptics\.impact\(\s*\{\s*style\s*:\s*ImpactStyle\.Medium\s*\}\s*\)/g,
    replacement: 'RichHaptics.play({ intensity: 0.7, sharpness: 0.5 })',
    label: 'Haptics.impact(Medium)',
  },
  {
    pattern: /Haptics\.impact\(\s*\{\s*style\s*:\s*ImpactStyle\.Heavy\s*\}\s*\)/g,
    replacement: "RichHaptics.preset({ name: 'sharpClick' })",
    label: 'Haptics.impact(Heavy)',
  },
  // notification() → preset()
  {
    pattern: /Haptics\.notification\(\s*\{\s*type\s*:\s*NotificationType\.Success\s*\}\s*\)/g,
    replacement: "RichHaptics.preset({ name: 'success' })",
    label: 'Haptics.notification(Success)',
  },
  {
    pattern: /Haptics\.notification\(\s*\{\s*type\s*:\s*NotificationType\.Warning\s*\}\s*\)/g,
    replacement: "RichHaptics.preset({ name: 'warning' })",
    label: 'Haptics.notification(Warning)',
  },
  {
    pattern: /Haptics\.notification\(\s*\{\s*type\s*:\s*NotificationType\.Error\s*\}\s*\)/g,
    replacement: "RichHaptics.preset({ name: 'error' })",
    label: 'Haptics.notification(Error)',
  },
  // selection — all variants map to scrollTick
  {
    pattern: /Haptics\.selection(Start|Changed|End)\(\s*\)/g,
    replacement: "RichHaptics.preset({ name: 'scrollTick' })",
    label: 'Haptics.selection*()',
  },
  // vibrate({ duration: N }) → play({ duration: N/1000 })
  {
    pattern: /Haptics\.vibrate\(\s*\{\s*duration\s*:\s*(\d+(?:\.\d+)?)\s*\}\s*\)/g,
    replacement: (_, ms) => 'RichHaptics.play({ duration: ' + Number(ms) / 1000 + ' })',
    label: 'Haptics.vibrate({duration})',
  },
];

function* walk(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    yield target;
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of fs.readdirSync(target)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'build') continue;
    yield* walk(path.join(target, entry));
  }
}

function shouldMigrate(file) {
  return /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte)$/.test(file);
}

function migrateContent(content) {
  let out = content;
  const changes = [];
  for (const rule of MIGRATE_RULES) {
    let count = 0;
    out = out.replace(rule.pattern, function () {
      count++;
      return typeof rule.replacement === 'function' ? rule.replacement.apply(null, arguments) : rule.replacement;
    });
    if (count > 0) changes.push({ label: rule.label, count: count });
  }
  return { out: out, changes: changes };
}

function cmdMigrate(args) {
  if (args.length === 0) fail('migrate: pass at least one file or directory.');

  const write = args.includes('--write');
  const targets = args.filter(function (a) {
    return !a.startsWith('--');
  });
  if (targets.length === 0) fail('migrate: no targets given.');

  let totalFiles = 0;
  let totalChanges = 0;
  const filesChanged = [];

  for (const target of targets) {
    if (!fs.existsSync(target)) {
      console.error(COLOR.yellow + 'skip: ' + target + ' (not found)' + COLOR.reset);
      continue;
    }
    for (const file of walk(target)) {
      if (!shouldMigrate(file)) continue;
      totalFiles++;
      const before = fs.readFileSync(file, 'utf-8');
      const { out, changes } = migrateContent(before);
      if (changes.length === 0) continue;

      filesChanged.push({ file: file, changes: changes });
      changes.forEach(function (c) {
        totalChanges += c.count;
      });

      if (write) {
        fs.writeFileSync(file, out);
        ok(file);
      } else {
        console.log(COLOR.cyan + file + COLOR.reset);
      }
      for (const c of changes) {
        console.log('  ' + COLOR.dim + '× ' + c.count + COLOR.reset + ' ' + c.label);
      }
    }
  }

  console.log('');
  if (totalChanges === 0) {
    console.log(COLOR.dim + 'No @capacitor/haptics usage found in ' + totalFiles + ' file(s).' + COLOR.reset);
    return;
  }

  if (write) {
    console.log(
      COLOR.green +
        '✓ ' +
        COLOR.reset +
        'Wrote ' +
        totalChanges +
        ' replacement(s) across ' +
        filesChanged.length +
        ' file(s).',
    );
    console.log(
      COLOR.dim +
        'Next: `npm uninstall @capacitor/haptics && npm install capacitor-rich-haptics && npx cap sync`' +
        COLOR.reset,
    );
  } else {
    console.log(
      COLOR.yellow +
        COLOR.bold +
        'Dry run.' +
        COLOR.reset +
        ' Found ' +
        totalChanges +
        ' replacement(s) in ' +
        filesChanged.length +
        ' file(s).',
    );
    console.log(COLOR.dim + 'Re-run with --write to apply:' + COLOR.reset);
    console.log('  capacitor-rich-haptics migrate ' + targets.join(' ') + ' --write');
  }
}

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const args = argv.slice(1);

  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    console.log(HELP);
    return;
  }

  switch (cmd) {
    case 'validate':
      cmdValidate(args[0]);
      break;
    case 'info':
      cmdInfo(args[0]);
      break;
    case 'list':
      cmdList();
      break;
    case 'export':
      cmdExport(args[0]);
      break;
    case 'render':
      cmdRender(args[0], args.slice(1));
      break;
    case 'migrate':
      cmdMigrate(args);
      break;
    default:
      fail('Unknown command: ' + cmd + '\nRun `capacitor-rich-haptics --help` for usage.');
  }
}

main();
