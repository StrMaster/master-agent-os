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
  colorPalette: ColorPalette;
  brandName: string;
};

export function renderHabitTrackerTemplate(data: HabitTrackerData): string {
  const p = PALETTES[data.colorPalette];
  const days1to15 = Array.from({ length: 15 }, (_, i) => i + 1);
  const days16to30 = Array.from({ length: 15 }, (_, i) => i + 16);

  const trackerHeader = `
    <div style="display: grid; grid-template-columns: 60px repeat(${data.habits.length}, 1fr); background: rgba(255,255,255,0.05); border-bottom: 2px solid ${p.accent};">
      <div style="padding: 8px 10px; font-size: 9px; font-weight: 600; color: ${p.textDim}; font-family: 'Poppins', sans-serif; letter-spacing: 0.1em; text-transform: uppercase;">DAY</div>
      ${data.habits.map(h => `<div style="padding: 6px 3px; font-size: 8px; font-weight: 600; color: ${p.accent}; text-align: center; letter-spacing: 0.03em; text-transform: uppercase; border-left: 1px solid ${p.border}; line-height: 1.3; word-break: break-word;">${h.label.slice(0, 10)}</div>`).join("")}
    </div>`;

  const trackerRow = (day: number) => `
    <div style="display: grid; grid-template-columns: 60px repeat(${data.habits.length}, 1fr); border-bottom: 1px solid ${p.border}; background: ${day % 7 === 0 ? `rgba(139,92,246,0.08)` : "transparent"};">
      <div style="padding: 10px 10px; display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 10px; font-weight: 600; font-family: 'Poppins', sans-serif; color: ${day % 7 === 0 ? p.accent : p.textMuted};">D${String(day).padStart(2, "0")}</span>
        ${day % 7 === 0 ? `<span style="font-size: 7px; color: ${p.accent}; font-family: 'Poppins', sans-serif; font-weight: 700;">✓</span>` : ""}
      </div>
      ${data.habits.map(() => `<div style="border-left: 1px solid ${p.border}; display: flex; align-items: center; justify-content: center; padding: 6px;">
        <div style="width: 14px; height: 14px; border: 2px solid ${p.accent}; border-radius: 3px; flex-shrink: 0; opacity: 0.6;"></div>
      </div>`).join("")}
    </div>`;

  const reflectionBlock = `
  <div style="margin-top: 12px; background: ${p.surface}; border: 1px solid ${p.border}; border-radius: 10px; padding: 14px;">
    <div style="font-size: 9px; font-family: 'Poppins', sans-serif; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: ${p.accent}; margin-bottom: 8px;">Weekly Reflection</div>
    <div style="display: flex; gap: 16px; margin-bottom: 10px; font-size: 11px; color: ${p.textMuted};">
      <span>○ Low energy</span>
      <span>○ Medium</span>
      <span>○ High energy</span>
    </div>
    <div style="font-size: 9px; font-family: 'Poppins', sans-serif; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: ${p.textDim}; margin-bottom: 6px;">Notes</div>
    <div style="border: 1px solid ${p.border}; border-radius: 6px; height: 52px; background: ${p.surface2};"></div>
    <div style="font-size: 10px; color: ${p.textDim}; font-style: italic; text-align: center; margin-top: 10px;">"Small rituals create lasting transformation."</div>
  </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${data.title}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=Inter:wght@300;400;500;600&family=Poppins:wght@400;500;600;700&display=swap');

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
  --shadow: 0 2px 8px rgba(0,0,0,0.15), 0 8px 32px rgba(0,0,0,0.1);
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
  height: 297mm;
  margin: 0 auto;
  padding: 12mm 14mm;
  overflow: hidden;
  background: var(--bg);
  page-break-after: always;
  position: relative;
}

.page:last-child { page-break-after: avoid; }

h1 { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; }
h2 { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; line-height: 1.3; }
h3 { font-family: 'Poppins', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }

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
  padding: 14px;
}

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

.label {
  font-size: 9px;
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 22px;
}

.brand {
  font-family: 'Poppins', sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
}

.write-box {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  height: 70px;
  background: var(--surface2);
}

.metric-value {
  font-family: 'Playfair Display', serif;
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
}

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { margin: 0; box-shadow: none; page-break-after: always; }
  .page:last-child { page-break-after: avoid; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .card { page-break-inside: avoid; }
  .card-sm { page-break-inside: avoid; }
}
</style>
</head>
<body>

<!-- PAGE 1: COVER -->
<div class="page">
  <div class="header-bar">
    <span class="brand">${data.brandName}</span>
    <span class="label">Premium Habit System</span>
  </div>

  <!-- Hero card -->
  <div style="background: linear-gradient(135deg, ${p.surface} 0%, ${p.surface2} 100%); border: 1px solid ${p.accent}; border-radius: 16px; padding: 28px; margin-bottom: 22px; box-shadow: 0 4px 24px rgba(0,0,0,0.2);">
    <h3 style="margin-bottom: 14px; font-size: 11px;">30-Day Protocol</h3>
    <h1 style="margin-bottom: 10px; color: ${p.text};">${data.title}</h1>
    <p style="font-size: 14px; color: ${p.textMuted}; margin-bottom: 14px; font-weight: 500;">${data.tagline}</p>
    <p style="font-size: 12px; color: ${p.textDim}; line-height: 1.8;">${data.subtitle}</p>
  </div>

  <!-- Habits + Metrics -->
  <div class="grid-2" style="margin-bottom: 18px;">
    <div class="card">
      <h3 style="margin-bottom: 14px;">Your Habits</h3>
      ${data.habits.map((h, i) => `
      <div style="display: flex; gap: 10px; align-items: flex-start; margin-bottom: 11px; padding-bottom: 11px; border-bottom: 1px solid ${p.border};">
        <span style="font-family: 'Poppins', sans-serif; font-size: 10px; font-weight: 700; color: ${p.accent}; min-width: 22px;">${String(i + 1).padStart(2, "0")}</span>
        <div>
          <div style="font-weight: 600; font-size: 12px; margin-bottom: 2px; color: ${p.text};">${h.label}</div>
          <div style="font-size: 11px; color: ${p.textMuted};">${h.description}</div>
        </div>
      </div>`).join("")}
    </div>

    <div class="card">
      <h3 style="margin-bottom: 14px;">Momentum Metrics</h3>
      <div class="card-sm" style="margin-bottom: 10px; border-left: 3px solid ${p.accent};">
        <div class="label" style="margin-bottom: 6px;">Current Streak</div>
        <div class="metric-value" style="color: ${p.accent};">0 Days</div>
        <div style="font-size: 11px; color: ${p.textDim}; margin-top: 3px;">Streaks build identity</div>
      </div>
      <div class="card-sm" style="margin-bottom: 10px;">
        <div class="label" style="margin-bottom: 6px;">Best Streak</div>
        <div class="metric-value">— Days</div>
        <div style="font-size: 11px; color: ${p.textDim}; margin-top: 3px;">Your personal record</div>
      </div>
      <div class="card-sm">
        <div class="label" style="margin-bottom: 6px;">Completion Rate</div>
        <div class="metric-value">— %</div>
        <div style="font-size: 11px; color: ${p.textDim}; margin-top: 3px;">85%+ = elite territory</div>
      </div>
    </div>
  </div>

  <!-- Start/End + Commitment -->
  <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: ${p.surface}; border-radius: 8px; border: 1px solid ${p.border}; margin-bottom: 14px;">
    <span style="font-size: 11px; color: ${p.textMuted};">Start Date</span>
    <div style="width: 100px; border-bottom: 1px solid ${p.border};"></div>
    <span style="font-size: 11px; color: ${p.textMuted};">End Date</span>
    <div style="width: 100px; border-bottom: 1px solid ${p.border};"></div>
  </div>

  <div class="card" style="padding: 16px;">
    <div class="label" style="margin-bottom: 10px;">My 30-Day Commitment</div>
    <div style="border-bottom: 1px solid ${p.border}; height: 22px; margin-bottom: 8px;"></div>
    <div style="border-bottom: 1px solid ${p.border}; height: 22px; margin-bottom: 10px;"></div>
    <div style="font-size: 10px; color: ${p.textDim}; font-style: italic; text-align: center;">"Consistency compounds into transformation."</div>
  </div>
</div>

<!-- PAGE 2: TRACKER DAYS 1-15 -->
<div class="page">
  <div class="header-bar">
    <span class="brand">${data.brandName}</span>
    <span class="label">Daily Tracker — Week 1-2</span>
  </div>

  <h2 style="margin-bottom: 4px;">The Accountability Matrix</h2>
  <p style="font-size: 12px; color: ${p.textMuted}; margin-bottom: 12px;">Days 1–15 · Mark each habit immediately upon completion.</p>

  <div style="overflow: hidden; border-radius: 12px; border: 1px solid ${p.border};">
    ${trackerHeader}
    ${days1to15.map(trackerRow).join("")}
  </div>

  ${reflectionBlock}
</div>

<!-- PAGE 3: TRACKER DAYS 16-30 -->
<div class="page">
  <div class="header-bar">
    <span class="brand">${data.brandName}</span>
    <span class="label">Daily Tracker — Week 3-4</span>
  </div>

  <h2 style="margin-bottom: 4px;">The Accountability Matrix</h2>
  <p style="font-size: 12px; color: ${p.textMuted}; margin-bottom: 12px;">Days 16–30 · Final stretch. Identity is being forged.</p>

  <div style="overflow: hidden; border-radius: 12px; border: 1px solid ${p.border};">
    ${trackerHeader}
    ${days16to30.map(trackerRow).join("")}
  </div>

  ${reflectionBlock}
</div>

<!-- PAGE 4: WEEKLY REVIEWS -->
<div class="page">
  <div class="header-bar">
    <span class="brand">${data.brandName}</span>
    <span class="label">Weekly Reviews</span>
  </div>

  <h2 style="margin-bottom: 4px;">Weekly Review System</h2>
  <p style="font-size: 12px; color: ${p.textMuted}; margin-bottom: 18px;">Reflection transforms data into growth. Complete each review on day 7, 14, 21, and 30.</p>

  ${data.weeklyReviews.map(review => `
  <div class="card" style="margin-bottom: 10px;">
    <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px;">
      <div>
        <h3 style="margin-bottom: 4px;">Week ${String(review.week).padStart(2, "0")} Review // ${review.theme}</h3>
        <h2 style="font-size: 17px;">${review.subtitle}</h2>
      </div>
      <span style="font-size: 10px; color: ${p.textDim}; font-family: 'Poppins', sans-serif; font-weight: 500;">Day ${review.week * 7}</span>
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
