import { PALETTES, type ColorPalette } from "./design-system";

export type HabitTrackerData = {
  title: string;
  tagline: string;
  subtitle: string;
  habits: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  weeklyReviews: Array<{
    week: number;
    theme: string;
    subtitle: string;
  }>;
  colorPalette: "dark-premium" | "warm-minimal" | "clean-professional" | "rose-wellness";
  brandName: string;
};

export function renderHabitTrackerTemplate(data: HabitTrackerData): string {
  const p = PALETTES[data.colorPalette];
  const days = Array.from({ length: 30 }, (_, i) => i + 1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${data.title}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&family=Poppins:wght@400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: ${p.bg};
  --surface: ${p.surface};
  --surface2: ${p.surface2};
  --accent: ${p.accent};
  --accent-light: ${p.accentLight};
  --text: ${p.text};
  --text-muted: ${p.textMuted};
  --text-dim: ${p.textDim};
  --border: ${p.border};
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --shadow: 0 1px 3px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08);
}

body {
  font-family: 'Inter', sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  line-height: 1.6;
}

.page {
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  padding: 15mm;
  background: var(--bg);
  page-break-after: always;
}

.page:last-child { page-break-after: avoid; }

/* Typography */
h1 { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; line-height: 1.2; }
h2 { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; line-height: 1.3; }
h3 { font-family: 'Poppins', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); }

/* Cards */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 20px;
  box-shadow: var(--shadow);
}

.card-sm {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px;
}

/* Grid */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }

/* Spacers */
.mt-8 { margin-top: 8px; }
.mt-16 { margin-top: 16px; }
.mt-24 { margin-top: 24px; }
.mt-32 { margin-top: 32px; }

/* Checkbox */
.checkbox {
  width: 16px; height: 16px;
  border: 1.5px solid var(--border);
  border-radius: 3px;
  display: inline-block;
  flex-shrink: 0;
}

/* Divider */
.divider { border: none; border-top: 1px solid var(--border); margin: 20px 0; }

/* Label */
.label { font-size: 9px; font-family: 'Poppins', sans-serif; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-dim); }

/* Header bar */
.header-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
}

.brand { font-family: 'Poppins', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: var(--accent); }

/* Write line */
.write-line {
  border-bottom: 1px solid var(--border);
  height: 28px;
  margin-bottom: 8px;
}

/* Textarea box */
.write-box {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  height: 85px;
  background: var(--surface2);
}

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { margin: 0; box-shadow: none; page-break-after: always; }
  .page:last-child { page-break-after: avoid; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  div { border-color: inherit !important; }
  .checkbox { border: 1.5px solid rgba(255,255,255,0.3) !important; }
  .card { page-break-inside: avoid; }
  .card-sm { page-break-inside: avoid; }
}
</style>
</head>
<body>

<!-- PAGE 1: COVER + HABIT SETUP -->
<div class="page">
  <div class="header-bar">
    <span class="brand">${data.brandName}</span>
    <span class="label">Premium Habit System</span>
  </div>

  <div class="card" style="background: linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%); border-color: var(--accent); margin-bottom: 24px;">
    <h3 style="margin-bottom: 12px;">30-Day Protocol</h3>
    <h1 style="margin-bottom: 8px;">${data.title}</h1>
    <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">${data.tagline}</p>
    <p style="font-size: 12px; color: var(--text-dim); line-height: 1.7;">${data.subtitle}</p>
  </div>

  <div class="grid-2" style="margin-bottom: 24px;">
    <div class="card">
      <h3 style="margin-bottom: 12px;">Your Habits</h3>
      ${data.habits.map((h, i) => `
      <div style="display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border);">
        <span style="font-family: 'Poppins', sans-serif; font-size: 10px; font-weight: 600; color: var(--accent); min-width: 24px;">${String(i + 1).padStart(2, "0")}</span>
        <div>
          <div style="font-weight: 500; font-size: 12px; margin-bottom: 2px;">${h.label}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${h.description}</div>
        </div>
      </div>`).join("")}
    </div>

    <div class="card">
      <h3 style="margin-bottom: 12px;">Momentum Metrics</h3>
      <div class="card-sm" style="margin-bottom: 8px;">
        <div class="label" style="margin-bottom: 4px;">Current Streak</div>
        <div style="font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; color: var(--accent);">0 Days</div>
        <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">Streaks build identity</div>
      </div>
      <div class="card-sm" style="margin-bottom: 8px;">
        <div class="label" style="margin-bottom: 4px;">Best Streak</div>
        <div style="font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700;">— Days</div>
        <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">Your personal record</div>
      </div>
      <div class="card-sm">
        <div class="label" style="margin-bottom: 4px;">Completion Rate</div>
        <div style="font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700;">— %</div>
        <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">85%+ = elite territory</div>
      </div>
    </div>
  </div>

  <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--surface); border-radius: var(--radius-sm); border: 1px solid var(--border);">
    <span style="font-size: 11px; color: var(--text-muted);">Start Date</span>
    <div style="width: 120px; border-bottom: 1px solid var(--border);"></div>
    <span style="font-size: 11px; color: var(--text-muted);">End Date</span>
    <div style="width: 120px; border-bottom: 1px solid var(--border);"></div>
  </div>
</div>

<!-- PAGE 2: TRACKER GRID DAYS 1-15 -->
<div class="page">
  <div class="header-bar">
    <span class="brand">${data.brandName}</span>
    <span class="label">Daily Tracker — Week 1-2</span>
  </div>
  <h2 style="margin-bottom: 4px;">The Accountability Matrix</h2>
  <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">Days 1–15 · Mark each habit immediately upon completion.</p>
  <div style="overflow: hidden; border-radius: 12px; border: 1px solid ${p.border};">
    <div style="display: grid; grid-template-columns: 60px repeat(${data.habits.length}, 1fr); background: rgba(255,255,255,0.05); border-bottom: 2px solid ${p.accent};">
      <div style="padding: 8px 10px; font-size: 9px; font-weight: 600; color: ${p.textDim}; font-family: 'Poppins', sans-serif; letter-spacing: 0.1em; text-transform: uppercase;">DAY</div>
      ${data.habits.map(h => `<div style="padding: 6px 3px; font-size: 8px; font-weight: 600; color: ${p.accent}; text-align: center; letter-spacing: 0.03em; text-transform: uppercase; border-left: 1px solid ${p.border}; line-height: 1.3; word-break: break-word;">${h.label.slice(0, 10)}</div>`).join("")}
    </div>
    ${Array.from({ length: 15 }, (_, i) => i + 1).map(day => `
    <div style="display: grid; grid-template-columns: 60px repeat(${data.habits.length}, 1fr); border-bottom: 1px solid ${p.border}; background: ${day % 7 === 0 ? `rgba(139,92,246,0.08)` : "transparent"};">
      <div style="padding:9px 10px; display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 10px; font-weight: 600; font-family: 'Poppins', sans-serif; color: ${day % 7 === 0 ? p.accent : p.textMuted};">D${String(day).padStart(2, "0")}</span>
        ${day % 7 === 0 ? `<span style="font-size: 7px; color: ${p.accent}; font-family: 'Poppins', sans-serif; font-weight: 700; letter-spacing: 0.05em;">✓</span>` : ""}
      </div>
      ${data.habits.map(() => `<div style="border-left: 1px solid ${p.border}; display: flex; align-items: center; justify-content: center; padding: 5px;">
        <div style="width: 14px; height: 14px; border: 1.5px solid ${p.textDim}; border-radius: 3px; flex-shrink: 0;"></div>
      </div>`).join("")}
    </div>`).join("")}
  </div>
</div>

<!-- PAGE 3: TRACKER GRID DAYS 16-30 -->
<div class="page">
  <div class="header-bar">
    <span class="brand">${data.brandName}</span>
    <span class="label">Daily Tracker — Week 3-4</span>
  </div>
  <h2 style="margin-bottom: 4px;">The Accountability Matrix</h2>
  <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">Days 16–30 · Final stretch. Identity is being forged.</p>
  <div style="overflow: hidden; border-radius: 12px; border: 1px solid ${p.border};">
    <div style="display: grid; grid-template-columns: 60px repeat(${data.habits.length}, 1fr); background: rgba(255,255,255,0.05); border-bottom: 2px solid ${p.accent};">
      <div style="padding: 8px 10px; font-size: 9px; font-weight: 600; color: ${p.textDim}; font-family: 'Poppins', sans-serif; letter-spacing: 0.1em; text-transform: uppercase;">DAY</div>
      ${data.habits.map(h => `<div style="padding: 6px 3px; font-size: 8px; font-weight: 600; color: ${p.accent}; text-align: center; letter-spacing: 0.03em; text-transform: uppercase; border-left: 1px solid ${p.border}; line-height: 1.3; word-break: break-word;">${h.label.slice(0, 10)}</div>`).join("")}
    </div>
    ${Array.from({ length: 15 }, (_, i) => i + 16).map(day => `
    <div style="display: grid; grid-template-columns: 60px repeat(${data.habits.length}, 1fr); border-bottom: 1px solid ${p.border}; background: ${day % 7 === 0 ? `rgba(139,92,246,0.08)` : "transparent"};">
      <div style="padding: 9px 10px; display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 10px; font-weight: 600; font-family: 'Poppins', sans-serif; color: ${day % 7 === 0 ? p.accent : p.textMuted};">D${String(day).padStart(2, "0")}</span>
        ${day % 7 === 0 ? `<span style="font-size: 7px; color: ${p.accent}; font-family: 'Poppins', sans-serif; font-weight: 700; letter-spacing: 0.05em;">✓</span>` : ""}
      </div>
      ${data.habits.map(() => `<div style="border-left: 1px solid ${p.border}; display: flex; align-items: center; justify-content: center; padding: 5px;">
        <div style="width: 14px; height: 14px; border: 1.5px solid ${p.textDim}; border-radius: 3px; flex-shrink: 0;"></div>
      </div>`).join("")}
    </div>`).join("")}
  </div>
</div>

<!-- PAGE 3: WEEKLY REVIEWS -->
<div class="page">
  <div class="header-bar">
    <span class="brand">${data.brandName}</span>
    <span class="label">Weekly Reviews</span>
  </div>

  <h2 style="margin-bottom: 4px;">Weekly Review System</h2>
 <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Reflection transforms data into growth. Complete each review on day 7, 14, 21, and 30.</p>

  ${data.weeklyReviews.map(review => `
  <div class="card" style="margin-bottom: 16px;">
    <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px;">
      <div>
        <h3 style="margin-bottom: 4px;">Week ${String(review.week).padStart(2, "0")} Review // ${review.theme}</h3>
        <h2 style="font-size: 18px;">${review.subtitle}</h2>
      </div>
      <span style="font-size: 10px; color: var(--text-dim); font-family: 'Poppins', sans-serif;">Day ${review.week * 7}</span>
    </div>
    <div class="grid-2">
      <div>
        <div class="label" style="margin-bottom: 6px;">What Worked</div>
        <div class="write-box"></div>
      </div>
      <div>
        <div class="label" style="margin-bottom: 6px;">What Resisted</div>
        <div class="write-box"></div>
      </div>
      <div>
        <div class="label" style="margin-bottom: 6px;">Pattern Recognition</div>
        <div class="write-box"></div>
      </div>
      <div>
        <div class="label" style="margin-bottom: 6px;">Next Week Optimization</div>
        <div class="write-box"></div>
      </div>
    </div>
  </div>`).join("")}
</div>

</body>
</html>`;
}
