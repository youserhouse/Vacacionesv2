// ── gantt.js ──────────────────────────────────────────────────
// Vista Gantt: línea de tiempo de vacaciones por empleado

function _ganttDayOfYear(y, month0, day) {
  let n = 0;
  for (let m = 0; m < month0; m++) n += daysInMonth(y, m);
  return n + day; // 1-based
}

function _ganttTotalDays(y) {
  let t = 0;
  for (let m = 0; m < 12; m++) t += daysInMonth(y, m);
  return t;
}

function changeGanttYear(delta) {
  state.currentYear += delta;
  saveState();
  renderGantt();
}

function renderGantt() {
  const y      = state.currentYear;
  const total  = _ganttTotalDays(y);
  const today  = new Date();
  const isCur  = today.getFullYear() === y;

  const ylEl = document.getElementById('gantt-year-label');
  if (ylEl) ylEl.textContent = y;

  // Today position (%)
  let todayPct = null;
  if (isCur) {
    const doy = _ganttDayOfYear(y, today.getMonth(), today.getDate());
    todayPct = ((doy - 0.5) / total) * 100;
  }

  // Month geometry
  const months = [];
  let acc = 0;
  for (let m = 0; m < 12; m++) {
    const d = daysInMonth(y, m);
    months.push({ m, name: MONTHS[m], days: d, start: acc });
    acc += d;
  }

  // ── Month header ──────────────────────────────────────────
  const mHdrEl = document.getElementById('gantt-month-header');
  if (mHdrEl) {
    mHdrEl.innerHTML = months.map(mw => {
      const w   = (mw.days / total * 100).toFixed(3);
      const cur = isCur && today.getMonth() === mw.m;
      return `<div class="gantt-mhdr-cell${cur ? ' gantt-mhdr-cur' : ''}" style="width:${w}%">${mw.name.slice(0, 3)}</div>`;
    }).join('');
  }

  // ── "Hoy" label in header ─────────────────────────────────
  const todayHdrEl = document.getElementById('gantt-today-hdr');
  if (todayHdrEl) {
    if (todayPct !== null) {
      todayHdrEl.style.display = 'block';
      todayHdrEl.style.left    = todayPct.toFixed(3) + '%';
    } else {
      todayHdrEl.style.display = 'none';
    }
  }

  // Month separator positions (reused in every row)
  const sepsHtml = months.slice(1).map(mw => {
    const p = (mw.start / total * 100).toFixed(3);
    return `<div class="gantt-msep" style="left:${p}%"></div>`;
  }).join('');

  // ── Employee rows ─────────────────────────────────────────
  const emps = state.employees;
  let rowsHtml = '';

  if (!emps.length) {
    rowsHtml = `<div class="gantt-empty">No hay empleados registrados. Añade uno desde el menú.</div>`;
  } else {
    emps.forEach(emp => {
      const tc   = getTextColorForBg(emp.color);
      const used = countVacDays(emp.id, y);
      const pct  = Math.round((used / (emp.totalDays || 1)) * 100);

      // Vacation keys (sorted)
      const vacKeys = Object.entries(state.marks)
        .filter(([k, v]) => k.startsWith(String(y)) && v[emp.id] === 'V')
        .map(([k]) => k).sort();

      // Other-type keys
      const otherKeys = Object.entries(state.marks)
        .filter(([k, v]) => k.startsWith(String(y)) && v[emp.id] === 'O')
        .map(([k]) => k);

      // Group consecutive vac days → segments
      const segs = [];
      let cur = null;
      vacKeys.forEach(key => {
        const [, mm, dd] = key.split('-').map(Number);
        const doy = _ganttDayOfYear(y, mm - 1, dd);
        if (!cur || doy > cur.endDoy + 1) {
          if (cur) segs.push(cur);
          cur = { startKey: key, endKey: key, doy, endDoy: doy, count: 1 };
        } else {
          cur.endKey = key; cur.endDoy = doy; cur.count++;
        }
      });
      if (cur) segs.push(cur);

      const vacBars = segs.map(s => {
        const l   = ((s.doy - 1) / total * 100).toFixed(3);
        const w   = Math.max(s.count / total * 100, 0.3).toFixed(3);
        const lbl = s.count >= 3
          ? `<span class="gantt-bar-lbl" style="color:${tc}">${s.count}d</span>` : '';
        const dateRange = s.startKey === s.endKey
          ? s.startKey : `${s.startKey} → ${s.endKey}`;
        return `<div class="gantt-bar" style="left:${l}%;width:${w}%;background:${emp.color};"
          title="${s.count} día${s.count > 1 ? 's' : ''} · ${dateRange}">${lbl}</div>`;
      }).join('');

      const otherBars = otherKeys.map(key => {
        const [, mm, dd] = key.split('-').map(Number);
        const doy = _ganttDayOfYear(y, mm - 1, dd);
        const l   = ((doy - 1) / total * 100).toFixed(3);
        const w   = Math.max(1 / total * 100, 0.25).toFixed(3);
        return `<div class="gantt-bar gantt-bar-other"
          style="left:${l}%;width:${w}%;border-color:${emp.color}80;"
          title="Otro · ${key}"></div>`;
      }).join('');

      const todayLine = todayPct !== null
        ? `<div class="gantt-today-line" style="left:${todayPct.toFixed(3)}%"></div>` : '';

      rowsHtml += `
      <div class="gantt-row">
        <div class="gantt-row-lbl">
          <div class="gantt-emp-dot" style="background:${emp.color};color:${tc}">${initials(emp.name)}</div>
          <div>
            <div class="gantt-emp-name">${emp.name}</div>
            <div class="gantt-emp-days">${used}&thinsp;/&thinsp;${emp.totalDays}d &middot; ${pct}%</div>
          </div>
        </div>
        <div class="gantt-row-bars">${sepsHtml}${vacBars}${otherBars}${todayLine}</div>
      </div>`;
    });
  }

  // ── Festivos row ──────────────────────────────────────────
  const festivoKeys = Object.keys(state.festivos)
    .filter(k => k.startsWith(String(y)) && state.festivos[k]);

  if (festivoKeys.length) {
    const fMarks = festivoKeys.map(key => {
      const [, mm, dd] = key.split('-').map(Number);
      const doy = _ganttDayOfYear(y, mm - 1, dd);
      const l   = ((doy - 1) / total * 100).toFixed(3);
      const w   = Math.max(1 / total * 100, 0.25).toFixed(3);
      return `<div class="gantt-festivo-mark" style="left:${l}%;width:${w}%;" title="Festivo · ${key}"></div>`;
    }).join('');
    const todayLine = todayPct !== null
      ? `<div class="gantt-today-line" style="left:${todayPct.toFixed(3)}%"></div>` : '';
    rowsHtml += `
    <div class="gantt-row gantt-festivos-row">
      <div class="gantt-row-lbl">
        <div class="gantt-festivo-icon">🎌</div>
        <div>
          <div class="gantt-emp-name" style="color:var(--festivo)">Festivos</div>
          <div class="gantt-emp-days">${festivoKeys.length} marcados</div>
        </div>
      </div>
      <div class="gantt-row-bars">${sepsHtml}${fMarks}${todayLine}</div>
    </div>`;
  }

  document.getElementById('gantt-rows').innerHTML = rowsHtml;

  // Legend
  renderLegend('gantt-legend');
}
