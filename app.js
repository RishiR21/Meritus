/**
 * Meritus — Investment Growth & Capital Appreciation Calculator
 * High-fidelity financial projection engine with customizable ranges
 */

// State Management
const state = {
  principal: 10000,
  monthly: 500,
  rate: 7.0,
  years: 30,
  frequency: 12,
  isTableExpanded: false,
  animatedBalance: 10000,
  ranges: {
    principal: { min: 0, max: 1000000, step: 1000, precision: 0, prefix: '$', suffix: '' },
    monthly: { min: 0, max: 100000, step: 50, precision: 0, prefix: '$', suffix: '' },
    rate: { min: 0, max: 800, step: 0.1, precision: 1, prefix: '', suffix: '%' },
    years: { min: 0, max: 80, step: 1, precision: 0, prefix: '', suffix: ' yrs' }
  }
};

// Formatter utilities
const formatCurrency = (val, maxDecimals = 0) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: maxDecimals
  }).format(val);
};

const formatCompactCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(val);
};

// Compound Calculation Engine
function calculateProjection({ principal, monthly, rate, years, frequency }) {
  const totalYears = Math.max(0, Math.round(years));
  const monthlyMultiplier = Math.pow(1 + rate / 100 / frequency, frequency / 12);
  let balance = principal;
  let totalContributions = 0;
  let totalInterest = 0;
  
  const schedule = [{
    year: 0,
    principal: principal,
    contributions: 0,
    interest: 0,
    balance: principal,
    interestThisYear: 0
  }];

  for (let y = 1; y <= totalYears; y++) {
    const startInterest = totalInterest;
    for (let m = 0; m < 12; m++) {
      const interestEarned = balance * (monthlyMultiplier - 1);
      totalInterest += interestEarned;
      balance += interestEarned;
      balance += monthly;
      totalContributions += monthly;
    }
    schedule.push({
      year: y,
      principal: principal,
      contributions: totalContributions,
      interest: totalInterest,
      balance: balance,
      interestThisYear: totalInterest - startInterest
    });
  }

  const totalDeposited = principal + totalContributions;
  const crossoverYear = schedule.find(e => e.year > 0 && e.interest > e.principal + e.contributions)?.year ?? null;

  return {
    schedule,
    finalBalance: balance,
    totalDeposited,
    totalInterest,
    growthMultiple: totalDeposited > 0 ? balance / totalDeposited : 0,
    crossoverYear
  };
}

// Animation controller for Balance Number
let animationFrameId = null;
let currentDisplayedBalance = state.principal;

function animateBalance(targetValue) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    currentDisplayedBalance = targetValue;
    const heroElem = document.getElementById('hero-balance');
    if (heroElem) heroElem.textContent = formatCurrency(targetValue);
    return;
  }

  const startValue = currentDisplayedBalance;
  const startTime = performance.now();
  const duration = 500;

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  function step(currentTime) {
    const progress = Math.min(1, (currentTime - startTime) / duration);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentValue = startValue + (targetValue - startValue) * easeOut;
    currentDisplayedBalance = currentValue;

    const heroElem = document.getElementById('hero-balance');
    if (heroElem) {
      heroElem.textContent = formatCurrency(currentValue);
    }

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(step);
    } else {
      currentDisplayedBalance = targetValue;
      if (heroElem) heroElem.textContent = formatCurrency(targetValue);
    }
  }

  animationFrameId = requestAnimationFrame(step);
}

// Render UI Components
function updateUI() {
  const result = calculateProjection(state);
  const roundedYears = Math.max(0, Math.round(state.years));

  // 1. Sync Slider Fill Tracks & Inputs
  syncSlider('principal');
  syncSlider('monthly');
  syncSlider('rate');
  syncSlider('years');

  // 2. Hero Section
  const headingElem = document.getElementById('hero-heading');
  if (headingElem) {
    headingElem.textContent = `Portfolio balance after ${roundedYears} ${roundedYears === 1 ? 'year' : 'years'}`;
  }

  animateBalance(result.finalBalance);

  const interestRatio = result.finalBalance > 0 ? Math.min(1, result.totalInterest / result.finalBalance) : 0;
  const interestPercent = Math.round(interestRatio * 100);
  const depositPercent = Math.round((1 - interestRatio) * 100);

  const heroDescElem = document.getElementById('hero-description');
  if (heroDescElem) {
    heroDescElem.innerHTML = `You put in ${formatCurrency(result.totalDeposited)} and capital growth added <span class="num font-mono text-foreground">${formatCurrency(result.totalInterest)}</span> on top — ${interestPercent}% of the final balance is money generated from investment appreciation.`;
  }

  // Composition Bar
  const barDeposits = document.getElementById('comp-bar-deposits');
  const barInterest = document.getElementById('comp-bar-interest');
  const compBar = document.getElementById('composition-bar');
  if (barDeposits && barInterest && compBar) {
    barDeposits.style.flexGrow = Math.max(0.001, 1 - interestRatio);
    barInterest.style.flexGrow = Math.max(0.001, interestRatio);
    compBar.setAttribute('aria-label', `Composition of final value: ${depositPercent} percent contributions, ${interestPercent} percent capital growth`);
  }

  // 3. Metric Cards
  document.getElementById('stat-total-deposited').textContent = formatCurrency(result.totalDeposited);
  document.getElementById('stat-total-interest').textContent = formatCurrency(result.totalInterest);
  document.getElementById('stat-growth-multiple').textContent = `${result.growthMultiple.toFixed(2)}×`;
  const finalYearInterest = result.schedule[result.schedule.length - 1]?.interestThisYear ?? 0;
  document.getElementById('stat-final-year-interest').textContent = formatCurrency(finalYearInterest);

  // 4. Year by Year Schedule Table
  renderTable(result.schedule);

  // 5. Render SVG Stacked Area Chart
  renderChart(result.schedule, result.crossoverYear);
}

// Slider Track helper
function syncSlider(id) {
  const config = state.ranges[id];
  const val = state[id];
  const slider = document.getElementById(`${id}-slider`);
  const input = document.getElementById(`${id}-input`);
  const fill = document.getElementById(`${id}-fill`);

  if (slider) {
    slider.min = config.min;
    slider.max = config.max;
    slider.step = config.step;
    if (document.activeElement !== slider) slider.value = val;
  }

  if (input && document.activeElement !== input) {
    input.value = val;
  }

  if (fill) {
    const percent = Math.max(0, Math.min(100, ((val - config.min) / (config.max - config.min)) * 100));
    fill.style.width = `${percent}%`;
  }
}

// Table renderer
function renderTable(schedule) {
  const tbody = document.getElementById('schedule-tbody');
  const rowCountElem = document.getElementById('table-row-count');
  const toggleBtn = document.getElementById('table-toggle-btn');
  const toggleText = document.getElementById('table-toggle-text');
  const toggleIcon = document.getElementById('table-toggle-icon');

  const rows = schedule.filter(item => item.year > 0);
  if (rowCountElem) rowCountElem.textContent = `${rows.length} rows`;

  const displayedRows = state.isTableExpanded ? rows : rows.slice(0, 10);
  const remainingCount = rows.length - displayedRows.length;

  if (tbody) {
    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr class="border-b border-border">
          <td colspan="5" class="p-4 text-center text-muted-foreground font-mono text-xs">0 years invested. Initial capital balance is immediate.</td>
        </tr>
      `;
    } else {
      tbody.innerHTML = displayedRows.map(row => {
        const isInterestDominant = row.interest > (row.principal + row.contributions);
        return `
          <tr class="border-b border-border transition-colors hover:bg-muted/50">
            <td class="p-2 align-middle whitespace-nowrap num font-mono text-muted-foreground">${row.year}</td>
            <td class="p-2 align-middle whitespace-nowrap num text-right font-mono">${formatCurrency(row.principal + row.contributions)}</td>
            <td class="p-2 align-middle whitespace-nowrap num text-right font-mono">${formatCurrency(row.interestThisYear)}</td>
            <td class="p-2 align-middle whitespace-nowrap num text-right font-mono ${isInterestDominant ? 'text-primary font-semibold' : ''}">${formatCurrency(row.interest)}</td>
            <td class="p-2 align-middle whitespace-nowrap num text-right font-mono font-medium">${formatCurrency(row.balance)}</td>
          </tr>
        `;
      }).join('');
    }
  }

  if (toggleBtn) {
    if (rows.length > 10) {
      toggleBtn.style.display = 'inline-flex';
      if (state.isTableExpanded) {
        toggleText.textContent = 'Collapse';
        toggleIcon.classList.add('rotate-180');
      } else {
        toggleText.textContent = `Show ${remainingCount} more years`;
        toggleIcon.classList.remove('rotate-180');
      }
    } else {
      toggleBtn.style.display = 'none';
    }
  }
}

// Chart Renderer using SVG
function renderChart(schedule, crossoverYear) {
  const container = document.getElementById('chart-container');
  if (!container) return;

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 350;

  const margin = { top: 16, right: 16, bottom: 28, left: 60 };
  const plotWidth = Math.max(10, width - margin.left - margin.right);
  const plotHeight = Math.max(10, height - margin.top - margin.bottom);

  const totalYears = schedule.length - 1;
  const maxBalance = Math.max(...schedule.map(d => d.balance), 100);

  // Determine tick interval
  const tickInterval = totalYears > 50 ? 10 : totalYears > 30 ? 10 : totalYears > 15 ? 5 : totalYears > 8 ? 2 : 1;
  const xTicks = [];
  if (totalYears === 0) {
    xTicks.push(0);
  } else {
    for (let y = 0; y <= totalYears; y += tickInterval) {
      xTicks.push(y);
    }
    if (!xTicks.includes(totalYears)) {
      xTicks.push(totalYears);
    }
  }

  // Coordinate scales
  const getX = (year) => {
    if (totalYears === 0) return margin.left + plotWidth / 2;
    return margin.left + (year / totalYears) * plotWidth;
  };
  const getY = (val) => margin.top + plotHeight - (val / maxBalance) * plotHeight;

  // Generate SVG stacked paths
  let pathPrincipal = `M ${getX(0)} ${getY(0)}`;
  for (let i = 0; i < schedule.length; i++) {
    pathPrincipal += ` L ${getX(schedule[i].year)} ${getY(schedule[i].principal)}`;
  }
  pathPrincipal += ` L ${getX(schedule[schedule.length - 1].year)} ${getY(0)} Z`;

  let pathContributions = `M ${getX(0)} ${getY(schedule[0].principal)}`;
  for (let i = 0; i < schedule.length; i++) {
    pathContributions += ` L ${getX(schedule[i].year)} ${getY(schedule[i].principal + schedule[i].contributions)}`;
  }
  for (let i = schedule.length - 1; i >= 0; i--) {
    pathContributions += ` L ${getX(schedule[i].year)} ${getY(schedule[i].principal)}`;
  }
  pathContributions += ` Z`;

  let pathInterest = `M ${getX(0)} ${getY(schedule[0].principal + schedule[0].contributions)}`;
  for (let i = 0; i < schedule.length; i++) {
    pathInterest += ` L ${getX(schedule[i].year)} ${getY(schedule[i].balance)}`;
  }
  for (let i = schedule.length - 1; i >= 0; i--) {
    pathInterest += ` L ${getX(schedule[i].year)} ${getY(schedule[i].principal + schedule[i].contributions)}`;
  }
  pathInterest += ` Z`;

  let lineBalance = `M ${getX(0)} ${getY(schedule[0].balance)}`;
  for (let i = 1; i < schedule.length; i++) {
    lineBalance += ` L ${getX(schedule[i].year)} ${getY(schedule[i].balance)}`;
  }

  // Generate Horizontal Grid Lines & Y Ticks
  const yTickCount = 4;
  const yTicks = [];
  for (let i = 0; i <= yTickCount; i++) {
    const val = (maxBalance / yTickCount) * i;
    yTicks.push(val);
  }

  let gridSvg = yTicks.map(val => {
    const y = getY(val);
    return `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="var(--border)" stroke-dasharray="2 4" opacity="0.6" />
      <text x="${margin.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--muted-foreground)" font-family="var(--font-mono)" font-size="11" class="num select-none">${formatCompactCurrency(val)}</text>
    `;
  }).join('');

  // Generate X Axis Ticks
  let xTicksSvg = xTicks.map(yr => {
    const x = getX(yr);
    const label = yr === 0 ? 'Now' : `Yr ${yr}`;
    return `
      <text x="${x}" y="${height - 8}" text-anchor="middle" fill="var(--muted-foreground)" font-family="var(--font-mono)" font-size="11" class="num select-none">${label}</text>
    `;
  }).join('');

  // Crossover vertical dashed line & label
  let crossoverSvg = '';
  if (crossoverYear !== null && crossoverYear <= totalYears && totalYears > 0) {
    const cx = getX(crossoverYear);
    crossoverSvg = `
      <line x1="${cx}" y1="${margin.top}" x2="${cx}" y2="${height - margin.bottom}" stroke="var(--chart-1)" stroke-dasharray="3 3" stroke-width="1.5" />
      <g transform="translate(${cx + 6}, ${margin.top + 14})">
        <text fill="var(--muted-foreground)" font-family="var(--font-mono)" font-size="11" font-weight="500">Growth > contributions · yr ${crossoverYear}</text>
      </g>
    `;
  }

  const svgContent = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="fill-principal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--chart-3)" stop-opacity="0.85" />
          <stop offset="100%" stop-color="var(--chart-3)" stop-opacity="0.35" />
        </linearGradient>
        <linearGradient id="fill-contributions" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--chart-2)" stop-opacity="0.85" />
          <stop offset="100%" stop-color="var(--chart-2)" stop-opacity="0.35" />
        </linearGradient>
        <linearGradient id="fill-interest" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--chart-1)" stop-opacity="0.85" />
          <stop offset="100%" stop-color="var(--chart-1)" stop-opacity="0.35" />
        </linearGradient>
      </defs>

      <!-- Grid -->
      ${gridSvg}
      ${xTicksSvg}

      <!-- Areas -->
      <path d="${pathPrincipal}" fill="url(#fill-principal)" stroke="var(--chart-3)" stroke-width="1" />
      <path d="${pathContributions}" fill="url(#fill-contributions)" stroke="var(--chart-2)" stroke-width="1" />
      <path d="${pathInterest}" fill="url(#fill-interest)" stroke="var(--chart-1)" stroke-width="1.5" />
      <path d="${lineBalance}" fill="none" stroke="var(--chart-1)" stroke-width="1.5" />

      <!-- Crossover Marker -->
      ${crossoverSvg}

      <!-- Interactive Crosshair -->
      <line id="chart-crosshair" x1="0" y1="${margin.top}" x2="0" y2="${height - margin.bottom}" stroke="var(--border)" stroke-width="1" style="display: none;" />
    </svg>
  `;

  container.innerHTML = svgContent;

  // Add Hover Interaction
  container.onmousemove = (e) => {
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    if (mouseX < margin.left || mouseX > width - margin.right) {
      hideTooltip();
      return;
    }

    let dataPoint;
    if (totalYears === 0) {
      dataPoint = schedule[0];
    } else {
      const ratio = (mouseX - margin.left) / plotWidth;
      const rawYear = ratio * totalYears;
      const closestIndex = Math.max(0, Math.min(schedule.length - 1, Math.round(rawYear)));
      dataPoint = schedule[closestIndex];
    }

    const targetX = getX(dataPoint.year);
    const targetY = getY(dataPoint.balance);

    const crosshair = document.getElementById('chart-crosshair');
    if (crosshair) {
      crosshair.setAttribute('x1', targetX);
      crosshair.setAttribute('x2', targetX);
      crosshair.style.display = 'block';
    }

    showTooltip(dataPoint, targetX, targetY, rect);
  };

  container.onmouseleave = () => {
    hideTooltip();
  };
}

// Tooltip helpers
function showTooltip(data, x, y, containerRect) {
  let tooltipWrapper = document.getElementById('chart-tooltip');
  if (!tooltipWrapper) {
    tooltipWrapper = document.createElement('div');
    tooltipWrapper.id = 'chart-tooltip';
    tooltipWrapper.className = 'chart-tooltip-wrapper';
    document.getElementById('chart-container').appendChild(tooltipWrapper);
  }

  tooltipWrapper.style.left = `${x}px`;
  tooltipWrapper.style.top = `${Math.max(10, y - 10)}px`;
  tooltipWrapper.classList.add('visible');

  const yearLabel = data.year === 0 ? 'Today' : `Year ${data.year}`;

  tooltipWrapper.innerHTML = `
    <div class="tooltip-card">
      <div class="font-medium text-foreground">${yearLabel}</div>
      <div class="grid gap-1.5 pt-1">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <span class="size-2 rounded-[2px]" style="background-color: var(--chart-3);"></span>
            <span class="text-muted-foreground">Initial capital</span>
          </div>
          <span class="num font-mono font-medium text-foreground">${formatCurrency(data.principal)}</span>
        </div>
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <span class="size-2 rounded-[2px]" style="background-color: var(--chart-2);"></span>
            <span class="text-muted-foreground">Contributions</span>
          </div>
          <span class="num font-mono font-medium text-foreground">${formatCurrency(data.contributions)}</span>
        </div>
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <span class="size-2 rounded-[2px]" style="background-color: var(--chart-1);"></span>
            <span class="text-muted-foreground">Capital Growth</span>
          </div>
          <span class="num font-mono font-medium text-foreground">${formatCurrency(data.interest)}</span>
        </div>
        <div class="border-t border-border/50 pt-1 mt-0.5 flex items-center justify-between gap-4">
          <span class="font-medium text-foreground">Portfolio Value</span>
          <span class="num font-mono font-bold text-foreground">${formatCurrency(data.balance)}</span>
        </div>
      </div>
    </div>
  `;
}

function hideTooltip() {
  const tooltipWrapper = document.getElementById('chart-tooltip');
  if (tooltipWrapper) tooltipWrapper.classList.remove('visible');
  const crosshair = document.getElementById('chart-crosshair');
  if (crosshair) crosshair.style.display = 'none';
}

// Range Select Helper: Ensure custom or new max is present in dropdown
function setDropdownMax(id, maxVal) {
  const select = document.getElementById(`${id}-range-select`);
  if (!select) return;

  const config = state.ranges[id];
  let option = select.querySelector(`option[value="${maxVal}"]`);
  if (!option) {
    option = document.createElement('option');
    option.value = maxVal;
    option.textContent = `${config.prefix}0 – ${config.prefix}${maxVal.toLocaleString()}${config.suffix}`;
    const customOpt = select.querySelector('option[value="custom"]');
    if (customOpt) select.insertBefore(option, customOpt);
    else select.appendChild(option);
  }
  select.value = String(maxVal);
}

// Event Listeners Setup
function setupEventListeners() {
  const bindField = (id) => {
    const input = document.getElementById(`${id}-input`);
    const slider = document.getElementById(`${id}-slider`);
    const select = document.getElementById(`${id}-range-select`);
    const config = state.ranges[id];

    // Range dropdown change handler
    if (select) {
      select.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
          const userPrompt = prompt(`Enter custom maximum for ${id} (${config.prefix}0 to ...${config.suffix}):`, config.max);
          const parsed = parseFloat(userPrompt?.replace(/[^0-9.]/g, ''));
          if (Number.isFinite(parsed) && parsed > config.min) {
            config.max = parsed;
            setDropdownMax(id, parsed);
          } else {
            select.value = String(config.max);
          }
        } else {
          config.max = parseFloat(e.target.value);
        }

        // Adjust step size proportionally
        if (id === 'principal') config.step = Math.max(100, Math.round(config.max / 1000) * 10);
        else if (id === 'monthly') config.step = Math.max(10, Math.round(config.max / 1000) * 5);
        else if (id === 'rate') config.step = config.max > 100 ? 0.5 : 0.1;
        else if (id === 'years') config.step = 1;

        updateUI();
      });
    }

    // Direct input handler (with auto-range expansion)
    if (input) {
      input.addEventListener('input', (e) => {
        const raw = parseFloat(e.target.value.replace(/[^0-9.]/g, ''));
        const val = Number.isFinite(raw) ? raw : 0;
        state[id] = val;

        // Auto-expand range if user types a value exceeding current slider max
        if (val > config.max) {
          config.max = val;
          setDropdownMax(id, val);
        }

        updateUI();
      });

      input.addEventListener('blur', () => {
        const clamped = Math.max(config.min, state[id]);
        state[id] = Number(clamped.toFixed(config.precision));
        input.value = state[id];
        updateUI();
      });
    }

    // Slider move handler
    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        state[id] = Number(val.toFixed(config.precision));
        updateUI();
      });
    }
  };

  bindField('principal');
  bindField('monthly');
  bindField('rate');
  bindField('years');

  // Compounding Frequency Toggles
  const toggleButtons = document.querySelectorAll('.toggle-item');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleButtons.forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      state.frequency = Number(btn.getAttribute('data-value'));
      updateUI();
    });
  });

  // Table expand/collapse button
  const toggleBtn = document.getElementById('table-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      state.isTableExpanded = !state.isTableExpanded;
      updateUI();
    });
  }

  // Theme switcher
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark) {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        localStorage.setItem('theme', 'light');
      } else {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      }
      updateUI();
    });
  }

  // Window resize handler for responsive chart
  window.addEventListener('resize', () => {
    const result = calculateProjection(state);
    renderChart(result.schedule, result.crossoverYear);
  });
}

// Initializer
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.classList.add(savedTheme);
  }

  setupEventListeners();
  updateUI();
});
