// ── gantt.js ──────────────────────────────────────────────────
// Vista Gantt: wallchart de línea de tiempo de vacaciones por empleado

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

  // ── Day-of-year header ──────────────────────────────────────
  const dayHdr = document.getElementById('gantt-day-header');
  if (dayHdr) {
    let daysHtml = '';
    for (let d = 1; d <= total; d++) {
      // Add month divider every month start
      let cls = '';
      let findMonth = 0;
      let accDays = 0;
      for (let m = 0; m < 12; m++) {
        const dm = daysInMonth(y, m);
        if (accDays + dm >= d) {
          if (accDays === d - 1) cls = 'gantt-dhdr-month-start';
          break;
        }
        accDays += dm;
      }
      daysHtml += `<div class="gantt-dhdr-cell${cls}">${d}</div>`;
    }
    dayHdr.innerHTML = daysHtml;
  }

  // ── Hoy indicator ───────────────────────────────────────────
  const todayIndEl = document.getElementById('gantt-today-indicator');
  if (todayIndEl) {
    if (todayPct !== null) {
      todayIndEl.style.display = 'block';
      todayIndEl.style.left    = todayPct.toFixed(3) + '%';
    } else {
      todayIndEl.style.display = 'none';
    }
  }

  // ── Employee rows ───────────────────────────────────────────
  const emps = state.employees;
  let rowsHtml = '';

  if (!emps.length) {
    rowsHtml = `<div class="gantt-empty">No hay empleados registrados. Añade uno desde el menú.</div>`;
  } else {
    emps.forEach(emp => {
      const tc   = getTextColorForBg(emp.color);
      const used = countVacDays(emp.id, y);

      // Vacation keys (sorted)
      const vacKeys = Object.entries(state.marks)
        .filter(([k, v]) => k.startsWith(String(y)) && v[emp.id] === 'V')
        .map(([k]) => k).sort();

      // Group consecutive vac days → segments
      const segs = [];
      let cur = null;
      vacKeys.forEach(key => {
        const [, mm, dd] = key.split('-').map(Number);
        const doy = _ganttDayOfYear(y, mm - 1, dd);
        if (!cur || doy > cur.endDoy + 1) {
          if (cur) segs.push(cur);
          cur = { startDoy: doy, endDoy: doy, count: 1 };
        } else {
          cur.endDoy = doy; cur.count++;
        }
      });
      if (cur) segs.push(cur);

      // Render vacation bars
      const vacBars = segs.map(s => {
        const l   = ((s.startDoy - 1) / total * 100).toFixed(2);
        const w   = Math.max((s.count / total) * 100, 0.5).toFixed(2);
        // Icon pattern
        const icon = '✈️';
        const bars = Array(Math.ceil(s.count / 2)).fill(icon).join('');
        return `<div class="gantt-bar" style="left:${l}%;width:${w}%;background:${emp.color};" title="${s.count} día${s.count > 1 ? 's' : ''}">${bars}</div>`;
      }).join('');

      // Hoy line
      const todayLine = todayPct !== null
        ? `<div class="gantt-today-line" style="left:${todayPct.toFixed(2)}%"></div>` : '';

      rowsHtml += `
      <div class="gantt-row">
        <div class="gantt-row-lbl">
          <div class="gantt-emp-avatar" style="background:${emp.color};color:${tc}">${initials(emp.name)}</div>
          <div class="gantt-row-info">
            <div class="gantt-emp-name">${emp.name}</div>
            <div class="gantt-emp-role">${emp.role || '—'}</div>
          </div>
        </div>
        <div class="gantt-row-timeline">
          <div class="gantt-row-bars">${vacBars}${todayLine}</div>
        </div>
      </div>`;
    });
  }

  document.getElementById('gantt-rows').innerHTML = rowsHtml;
}
