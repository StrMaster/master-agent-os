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

  const reflectionBlock = `
  <div class="card" style="margin-top: 10px; background: var(--surface); border: 1px solid var(--border); padding: 14px;">
    <div class="label" style="margin-bottom: 8px; color: var(--accent);">Weekly Energy Score</div>
    <div style="display: flex; gap: 18px; margin-bottom: 12px; font-size: 11px; color: var(--text-muted);">
      <span>○ Low</span>
      <span>○ Medium</span>
      <span>○ High</span>
    </div>

    <div class="label" style="margin-bottom: 6px;">Notes / Reflection</div>
    <div class="write-box" style="height: 55px; margin-bottom: 8px;"></div>

    <div style="font-size: 10px; color: var(--text-dim); font-style: italic; text-align: center;">
      “Small rituals create lasting transformation.”
    </div>
  </div>`;

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

h1 { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; line-height: 1.2; }
h2 { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; line-height: 1.3; }
h3 { font-family: 'Poppins', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); }

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

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.label { font-size: 9px; font-family: 'Poppins', sans-serif; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-dim); }

.header-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
}

.brand { font-family: 'Poppins', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: var(--accent); }

.write-box {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  height: 55px;
  background: var(--surface2);
}
</style>
</head>
<body>

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

  <div class="grid-2" style="margin-bottom: 20px;">
    <div class="card">
      <h3 style="margin-bottom: 12px;">Your Habits</h3>
      ${data.habits.map((h, i) => `
      <div style="display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border);">
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
      </div>
    </div>
  </div>

  <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--surface); border-radius: var(--radius-sm); border: 1px solid var(--border); margin-bottom: 12px;">
    <span style="font-size: 11px; color: var(--text-muted);">Start Date</span>
    <div style="width: 110px; border-bottom: 1px solid var(--border);"></div>
    <span style="font-size: 11px; color: var(--text-muted);">End Date</span>
    <div style="width: 110px; border-bottom: 1px solid var(--border);"></div>
  </div>

  <div class="card" style="padding: 14px;">
    <div class="label" style="margin-bottom: 8px;">My 30-Day Commitment</div>
    <div style="border-bottom: 1px solid var(--border); height: 20px; margin-bottom: 8px;"></div>
    <div style="border-bottom: 1px solid var(--border); height: 20px; margin-bottom: 8px;"></div>
    <div style="font-size: 10px; color: var(--text-dim); font-style: italic; text-align: center; margin-top: 8px;">
      “Consistency compounds into transformation.”
    </div>
  </div>
</div>

${[1,16].map(start => `
<div class="page">
  <div class="header-bar">
    <span class="brand">${data.brandName}</span>
    <span class="label">Daily Tracker</span>
  </div>

  <h2 style="margin-bottom: 4px;">The Accountability Matrix</h2>
  <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
    ${start === 1 ? 'Days 1–15 · Mark each habit immediately upon completion.' : 'Days 16–30 · Final stretch. Identity is being forged.'}
  </p>

  <div style="overflow: hidden; border-radius: 12px; border: 1px solid ${p.border};">
    ${Array.from({ length: 15 }, (_, i) => i + start).map(day => `
      <div style="display: grid; grid-template-columns: 60px repeat(${data.habits.length}, 1fr); border-bottom: 1px solid ${p.border};">
        <div style="padding: 11px 10px; font-size: 10px; font-weight: 600;">D${String(day).padStart(2, '0')}</div>
        ${data.habits.map(() => `
          <div style="border-left: 1px solid ${p.border}; display:flex; align-items:center; justify-content:center; padding:6px;">
            <div style="width:14px; height:14px; border:1.5px solid ${p.textDim}; border-radius:3px;"></div>
          </div>
        `).join('')}
      </div>
    `).join('')}
  </div>

  ${reflectionBlock}
</div>
`).join('')}

</body>
</html>`;
}
