/**
 * Meritus — Financial Decision Suite
 * Comprehensive engine for Compound Growth & Mortgage Paydowns / Refinancing Analysis
 */

// ==========================================
// 1. STATE MANAGEMENT
// ==========================================

const compoundState = {
  principal: 10000,
  monthly: 500,
  rate: 7.0,
  years: 30,
  frequency: 12,
  isTableExpanded: false,
  animatedBalance: 10000,
  yearOverrides: {},
  activeModalYear: null,
  ranges: {
    principal: { min: 0, max: 1000000, step: 1000, precision: 0, prefix: '$', suffix: '' },
    monthly: { min: 0, max: 100000, step: 50, precision: 0, prefix: '$', suffix: '' },
    rate: { min: 0, max: 800, step: 0.1, precision: 1, prefix: '', suffix: '%' },
    years: { min: 0, max: 80, step: 1, precision: 0, prefix: '', suffix: ' yrs' }
  }
};

const mortgageState = {
  activeTab: 'growth', // 'growth' | 'mortgage'
  activeSubmode: 'paydown', // 'paydown' | 'refinance'
  
  // Paydown Inputs
  price: 500000,
  downPayment: 100000,
  downPercent: 20,
  rate: 6.5,
  term: 30,
  extraMonthly: 200,
  extraAnnual: 0,
  frequency: 12, // 12 monthly, 26 bi-weekly
  isTableExpanded: false,
  yearOverrides: {},
  activeModalYear: null,
  ranges: {
    price: { min: 0, max: 1000000, step: 5000, precision: 0, prefix: '$', suffix: '' },
    rate: { min: 0, max: 12, step: 0.05, precision: 2, prefix: '', suffix: '%' },
    extraMonthly: { min: 0, max: 3000, step: 25, precision: 0, prefix: '$', suffix: '/mo' },
    extraAnnual: { min: 0, max: 20000, step: 250, precision: 0, prefix: '$', suffix: '/yr' }
  },

  // Refinance Inputs
  refiCurrentBalance: 380000,
  refiCurrentRate: 7.25,
  refiCurrentTerm: 27,
  refiNewRate: 5.75,
  refiNewTerm: 30,
  refiClosingCosts: 4500,
  refiRollCosts: true
};

// ==========================================
// 2. UTILITY FORMATTERS
// ==========================================

const formatCurrency = (val, maxDecimals = 0) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: maxDecimals
  }).format(val || 0);
};

const formatNumberWithCommas = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return Number(val).toLocaleString('en-US');
};

const parseFormattedNumber = (str) => {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const clean = str.toString().replace(/[^0-9.]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const formatCompactCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(val || 0);
};

const formatMonthsToYears = (totalMonths) => {
  if (totalMonths <= 0) return '0 mos';
  const yrs = Math.floor(totalMonths / 12);
  const mos = Math.round(totalMonths % 12);
  if (yrs === 0) return `${mos} mos`;
  if (mos === 0) return `${yrs} yrs`;
  return `${yrs} yrs ${mos} mos`;
};

// ==========================================
// 3. COMPOUND GROWTH CALCULATION ENGINE
// ==========================================

function calculateProjection({ principal, monthly, rate, years, frequency, yearOverrides = {} }) {
  const totalYears = Math.max(0, Math.round(years));
  let balance = principal;
  let totalContributions = 0;
  let totalInterest = 0;
  
  const schedule = [{
    year: 0,
    principal: principal,
    contributions: 0,
    interest: 0,
    balance: principal,
    interestThisYear: 0,
    rateThisYear: rate,
    depositThisYear: 0,
    isCustom: false
  }];

  if (totalYears === 0) {
    return {
      schedule,
      finalBalance: principal,
      totalDeposited: principal,
      totalInterest: 0,
      growthMultiple: 1.0,
      finalYearInterest: 0,
      crossoverYear: null
    };
  }

  let crossoverYear = null;
  let currentAnnualRate = rate;
  let currentMonthlyDeposit = monthly;

  for (let yr = 1; yr <= totalYears; yr++) {
    const isCustom = Boolean(yearOverrides[yr]);
    if (isCustom) {
      if (yearOverrides[yr].rate !== undefined) {
        currentAnnualRate = yearOverrides[yr].rate;
      }
      if (yearOverrides[yr].contribution !== undefined) {
        currentMonthlyDeposit = yearOverrides[yr].contribution / 12;
      }
    }

    let interestThisYear = 0;
    let depositsThisYear = 0;

    const r = currentAnnualRate / 100;
    const n = frequency;
    const ratePerPeriod = r / n;

    for (let m = 0; m < 12; m++) {
      balance += currentMonthlyDeposit;
      depositsThisYear += currentMonthlyDeposit;
      totalContributions += currentMonthlyDeposit;

      const monthlyInterest = balance * (ratePerPeriod * (n / 12));
      balance += monthlyInterest;
      interestThisYear += monthlyInterest;
      totalInterest += monthlyInterest;
    }

    if (!crossoverYear && totalInterest >= (principal + totalContributions)) {
      crossoverYear = yr;
    }

    schedule.push({
      year: yr,
      principal: principal,
      contributions: Math.round(totalContributions),
      interest: Math.round(totalInterest),
      balance: Math.round(balance),
      interestThisYear: Math.round(interestThisYear),
      rateThisYear: currentAnnualRate,
      depositThisYear: Math.round(depositsThisYear),
      isCustom: isCustom
    });
  }

  const finalBalance = Math.round(balance);
  const totalDeposited = Math.round(principal + totalContributions);
  const growthMultiple = totalDeposited > 0 ? (finalBalance / totalDeposited).toFixed(2) : '1.00';
  const finalYearInterest = schedule[schedule.length - 1].interestThisYear;

  return {
    schedule,
    finalBalance,
    totalDeposited,
    totalInterest: Math.round(totalInterest),
    growthMultiple,
    finalYearInterest,
    crossoverYear
  };
}

// ==========================================
// 4. MORTGAGE PAYDOWN & REFINANCE ENGINES
// ==========================================

function calculateMortgagePaydown(st) {
  const loanPrincipal = Math.max(0, st.price - st.downPayment);
  const annualRate = st.rate;
  const standardTermMonths = Math.max(1, st.term * 12);
  const monthlyRate = (annualRate / 100) / 12;
  
  let standardMonthlyPayment = 0;
  if (monthlyRate > 0) {
    standardMonthlyPayment = loanPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, standardTermMonths)) / (Math.pow(1 + monthlyRate, standardTermMonths) - 1);
  } else {
    standardMonthlyPayment = loanPrincipal / standardTermMonths;
  }

  // Baseline standard month-by-month trajectory
  let baseBalance = loanPrincipal;
  let standardTotalInterest = 0;
  const baselineMonthlyPoints = [{ month: 0, balance: loanPrincipal }];

  for (let m = 1; m <= standardTermMonths; m++) {
    const interest = baseBalance * monthlyRate;
    const principal = Math.min(baseBalance, standardMonthlyPayment - interest);
    standardTotalInterest += interest;
    baseBalance = Math.max(0, baseBalance - principal);
    baselineMonthlyPoints.push({ month: m, balance: baseBalance });
    if (baseBalance <= 0) break;
  }

  // Accelerated month-by-month trajectory
  let accBalance = loanPrincipal;
  let accTotalInterest = 0;
  let accTotalPrincipalPaid = 0;
  let accTotalExtraPaid = 0;
  let payoffMonth = standardTermMonths;
  let crossoverYear = null;

  const acceleratedMonthlyPoints = [{
    month: 0,
    balance: loanPrincipal,
    interestPaidToDate: 0,
    principalPaidToDate: 0,
    extraPaidToDate: 0
  }];

  const yearRecords = [];
  let currentYearInterest = 0;
  let currentYearPrincipal = 0;
  let currentYearExtra = 0;
  let currentAnnualRate = annualRate;

  const maxSimMonths = standardTermMonths * 1.5;

  for (let m = 1; m <= maxSimMonths; m++) {
    const currentYear = Math.ceil(m / 12);
    const isFirstMonthOfYear = (m % 12 === 1);

    if (isFirstMonthOfYear && st.yearOverrides[currentYear]) {
      if (st.yearOverrides[currentYear].rate !== undefined) {
        currentAnnualRate = st.yearOverrides[currentYear].rate;
      }
    }

    const curMonthlyRate = (currentAnnualRate / 100) / 12;
    const monthlyInterest = accBalance * curMonthlyRate;
    let scheduledPrincipal = Math.min(accBalance, standardMonthlyPayment - monthlyInterest);
    if (scheduledPrincipal < 0) scheduledPrincipal = 0;

    let extraPayment = st.extraMonthly;
    if (m % 12 === 0) {
      extraPayment += st.extraAnnual;
    }
    if (isFirstMonthOfYear && st.yearOverrides[currentYear]?.extraPrepayment) {
      extraPayment += st.yearOverrides[currentYear].extraPrepayment;
    }

    if (st.frequency === 26) {
      extraPayment += (standardMonthlyPayment / 12);
    }

    const actualExtra = Math.min(accBalance - scheduledPrincipal, extraPayment);
    const totalPrincipalThisMonth = scheduledPrincipal + actualExtra;

    accBalance = Math.max(0, accBalance - totalPrincipalThisMonth);
    accTotalInterest += monthlyInterest;
    accTotalPrincipalPaid += totalPrincipalThisMonth;
    accTotalExtraPaid += actualExtra;

    currentYearInterest += monthlyInterest;
    currentYearPrincipal += scheduledPrincipal;
    currentYearExtra += actualExtra;

    acceleratedMonthlyPoints.push({
      month: m,
      balance: Math.max(0, accBalance),
      interestPaidToDate: accTotalInterest,
      principalPaidToDate: accTotalPrincipalPaid,
      extraPaidToDate: accTotalExtraPaid
    });

    if (!crossoverYear && scheduledPrincipal > monthlyInterest) {
      crossoverYear = currentYear;
    }

    if (m % 12 === 0 || accBalance <= 0 || m === maxSimMonths) {
      const isCustomYear = Boolean(st.yearOverrides[currentYear]);
      yearRecords.push({
        year: currentYear,
        principalPaid: Math.round(currentYearPrincipal),
        interestPaid: Math.round(currentYearInterest),
        extraPrepaid: Math.round(currentYearExtra),
        remainingBalance: Math.round(accBalance),
        cumulativeInterest: Math.round(accTotalInterest),
        cumulativePrincipal: Math.round(accTotalPrincipalPaid),
        isCustom: isCustomYear
      });

      currentYearInterest = 0;
      currentYearPrincipal = 0;
      currentYearExtra = 0;
    }

    if (accBalance <= 0) {
      payoffMonth = m;
      break;
    }
  }

  const interestSaved = Math.max(0, standardTotalInterest - accTotalInterest);
  const monthsSaved = Math.max(0, standardTermMonths - payoffMonth);

  return {
    loanPrincipal,
    standardMonthlyPayment: Math.round(standardMonthlyPayment),
    totalMonthlyPayment: Math.round(standardMonthlyPayment + st.extraMonthly),
    standardTotalInterest: Math.round(standardTotalInterest),
    acceleratedTotalInterest: Math.round(accTotalInterest),
    interestSaved: Math.round(interestSaved),
    standardTermMonths,
    payoffMonth,
    monthsSaved,
    crossoverYear,
    schedule: yearRecords,
    baselineMonthlyPoints,
    acceleratedMonthlyPoints
  };
}

function calculateRefinance(st) {
  const currentBalance = st.refiCurrentBalance;
  const currentRate = st.refiCurrentRate;
  const currentMonths = st.refiCurrentTerm * 12;
  const currentMonthlyRate = (currentRate / 100) / 12;

  let currentMonthlyPayment = 0;
  if (currentMonthlyRate > 0 && currentMonths > 0) {
    currentMonthlyPayment = currentBalance * (currentMonthlyRate * Math.pow(1 + currentMonthlyRate, currentMonths)) / (Math.pow(1 + currentMonthlyRate, currentMonths) - 1);
  } else {
    currentMonthlyPayment = currentBalance / Math.max(1, currentMonths);
  }
  const currentTotalRemainingPayments = currentMonthlyPayment * currentMonths;
  const currentTotalRemainingInterest = currentTotalRemainingPayments - currentBalance;

  const newPrincipal = currentBalance + (st.refiRollCosts ? st.refiClosingCosts : 0);
  const newRate = st.refiNewRate;
  const newMonths = st.refiNewTerm * 12;
  const newMonthlyRate = (newRate / 100) / 12;

  let newMonthlyPayment = 0;
  if (newMonthlyRate > 0 && newMonths > 0) {
    newMonthlyPayment = newPrincipal * (newMonthlyRate * Math.pow(1 + newMonthlyRate, newMonths)) / (Math.pow(1 + newMonthlyRate, newMonths) - 1);
  } else {
    newMonthlyPayment = newPrincipal / Math.max(1, newMonths);
  }

  const newTotalPayments = newMonthlyPayment * newMonths;
  const newTotalInterest = newTotalPayments - newPrincipal;
  const totalOutOfPocket = st.refiRollCosts ? 0 : st.refiClosingCosts;
  const newTotalCost = newTotalPayments + totalOutOfPocket;

  const monthlySavings = currentMonthlyPayment - newMonthlyPayment;
  let breakEvenMonths = 0;
  if (monthlySavings > 0) {
    breakEvenMonths = Math.ceil(st.refiClosingCosts / monthlySavings);
  } else {
    breakEvenMonths = Infinity;
  }

  const netLifetimeSavings = currentTotalRemainingPayments - newTotalCost;

  return {
    currentMonthlyPayment: Math.round(currentMonthlyPayment),
    newMonthlyPayment: Math.round(newMonthlyPayment),
    monthlySavings: Math.round(monthlySavings),
    breakEvenMonths,
    netLifetimeSavings: Math.round(netLifetimeSavings),
    currentTotalRemainingInterest: Math.round(currentTotalRemainingInterest),
    newTotalInterest: Math.round(newTotalInterest),
    closingCosts: st.refiClosingCosts,
    isFavorable: (netLifetimeSavings > 0 && monthlySavings > 0 && breakEvenMonths <= 36)
  };
}

// ==========================================
// 5. SVG CHART RENDERERS
// ==========================================

function renderCompoundChart(schedule, crossoverYear) {
  const container = document.getElementById('chart-container');
  if (!container || !schedule || schedule.length === 0) return;

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 380;
  const margin = { top: 24, right: 20, bottom: 36, left: 62 };

  const plotWidth = Math.max(10, width - margin.left - margin.right);
  const plotHeight = Math.max(10, height - margin.top - margin.bottom);

  const maxYear = schedule[schedule.length - 1].year;
  const maxBalance = Math.max(...schedule.map(d => d.balance)) * 1.05;

  const getX = (yr) => margin.left + (maxYear > 0 ? (yr / maxYear) * plotWidth : 0);
  const getY = (val) => margin.top + plotHeight - (maxBalance > 0 ? (val / maxBalance) * plotHeight : 0);

  // Area Paths
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

  // Y Ticks
  const yTicks = [0, maxBalance * 0.25, maxBalance * 0.5, maxBalance * 0.75, maxBalance];
  let gridSvg = yTicks.map(val => {
    const y = getY(val);
    return `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="var(--border)" stroke-dasharray="3 3" opacity="0.6" />
      <text x="${margin.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--muted-foreground)" font-family="var(--font-mono)" font-size="10.5" class="num select-none">${formatCompactCurrency(val)}</text>
    `;
  }).join('');

  // X Ticks
  const stepYr = maxYear <= 10 ? 2 : maxYear <= 30 ? 5 : 10;
  let xTicksSvg = '';
  for (let yr = 0; yr <= maxYear; yr += stepYr) {
    const x = getX(yr);
    const label = yr === 0 ? 'Start' : `Yr ${yr}`;
    xTicksSvg += `
      <line x1="${x}" y1="${margin.top + plotHeight}" x2="${x}" y2="${margin.top + plotHeight + 4}" stroke="var(--border)" opacity="0.8" />
      <text x="${x}" y="${margin.top + plotHeight + 18}" text-anchor="middle" fill="var(--muted-foreground)" font-family="var(--font-mono)" font-size="10.5" class="num select-none">${label}</text>
    `;
  }

  // Crossover Pin
  let crossoverSvg = '';
  if (crossoverYear && crossoverYear <= maxYear) {
    const crossX = getX(crossoverYear);
    crossoverSvg = `
      <g class="crossover-marker">
        <line x1="${crossX}" y1="${margin.top}" x2="${crossX}" y2="${margin.top + plotHeight}" stroke="var(--chart-1)" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.8" />
        <rect x="${crossX - 48}" y="${margin.top + 2}" width="96" height="18" rx="4" fill="var(--card)" stroke="var(--chart-1)" stroke-width="1" />
        <text x="${crossX}" y="${margin.top + 14}" text-anchor="middle" fill="var(--chart-1)" font-family="var(--font-mono)" font-size="9.5" font-weight="600" class="select-none">Growth Crossover</text>
      </g>
    `;
  }

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg select-none">
      <defs>
        <linearGradient id="interest-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="var(--chart-1)" stop-opacity="0.75" />
          <stop offset="100%" stop-color="var(--chart-1)" stop-opacity="0.2" />
        </linearGradient>
        <linearGradient id="contrib-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="var(--chart-2)" stop-opacity="0.55" />
          <stop offset="100%" stop-color="var(--chart-2)" stop-opacity="0.18" />
        </linearGradient>
        <linearGradient id="principal-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="var(--chart-3)" stop-opacity="0.35" />
          <stop offset="100%" stop-color="var(--chart-3)" stop-opacity="0.1" />
        </linearGradient>
      </defs>

      ${gridSvg}
      <!-- X-Axis Baseline -->
      <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="var(--border)" stroke-width="1" />
      ${xTicksSvg}
      
      <path d="${pathPrincipal}" fill="url(#principal-grad)" />
      <path d="${pathContributions}" fill="url(#contrib-grad)" />
      <path d="${pathInterest}" fill="url(#interest-grad)" />
      <path d="${lineBalance}" fill="none" stroke="var(--chart-1)" stroke-width="2.5" stroke-linecap="round" />
      ${crossoverSvg}

      <g id="chart-crosshair" style="display: none;">
        <line id="crosshair-line-x" x1="0" y1="${margin.top}" x2="0" y2="${margin.top + plotHeight}" stroke="var(--foreground)" stroke-width="1" stroke-dasharray="2 2" opacity="0.6" />
        <circle id="crosshair-dot-balance" r="5" fill="var(--chart-1)" stroke="var(--card)" stroke-width="2" />
      </g>
    </svg>
    <div id="chart-tooltip" class="chart-tooltip-wrapper"></div>
  `;

  const svg = container.querySelector('svg');
  const crosshair = document.getElementById('chart-crosshair');
  const crosshairLineX = document.getElementById('crosshair-line-x');
  const dotBalance = document.getElementById('crosshair-dot-balance');
  const tooltip = document.getElementById('chart-tooltip');

  svg.addEventListener('mousemove', (e) => {
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    if (mouseX < margin.left || mouseX > width - margin.right) {
      crosshair.style.display = 'none';
      tooltip.classList.remove('visible');
      return;
    }

    const relX = (mouseX - margin.left) / plotWidth;
    const approxYear = Math.max(0, Math.min(maxYear, Math.round(relX * maxYear)));
    const dataPoint = schedule.find(d => d.year === approxYear) || schedule[schedule.length - 1];

    const cx = getX(dataPoint.year);
    const cy = getY(dataPoint.balance);

    crosshair.style.display = 'block';
    crosshairLineX.setAttribute('x1', cx);
    crosshairLineX.setAttribute('x2', cx);
    dotBalance.setAttribute('cx', cx);
    dotBalance.setAttribute('cy', cy);

    tooltip.style.left = `${(cx / width) * 100}%`;
    tooltip.style.top = `${cy - 12}px`;
    tooltip.innerHTML = `
      <div class="tooltip-card font-mono">
        <div class="flex items-center justify-between border-b border-border pb-1 text-xs">
          <span class="font-semibold text-foreground">${dataPoint.year === 0 ? 'Start' : `Year ${dataPoint.year}`}</span>
          <span class="text-primary font-bold">${formatCurrency(dataPoint.balance)}</span>
        </div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground pt-0.5">
          <span>Capital:</span><span class="text-right text-foreground font-medium">${formatCurrency(dataPoint.principal)}</span>
          <span>Deposits:</span><span class="text-right text-foreground font-medium">${formatCurrency(dataPoint.contributions)}</span>
          <span>Appreciation:</span><span class="text-right text-primary font-semibold">${formatCurrency(dataPoint.interest)}</span>
        </div>
      </div>
    `;
    tooltip.classList.add('visible');
  });

  svg.addEventListener('mouseleave', () => {
    crosshair.style.display = 'none';
    tooltip.classList.remove('visible');
  });
}

function renderMortgageChart(paydownResult, mortgageSt) {
  const container = document.getElementById('mortgage-chart-container');
  if (!container || !paydownResult) return;

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 380;
  const margin = { top: 24, right: 20, bottom: 36, left: 64 };

  const plotWidth = Math.max(10, width - margin.left - margin.right);
  const plotHeight = Math.max(10, height - margin.top - margin.bottom);

  const totalTermYears = mortgageSt.term;
  const maxBalance = paydownResult.loanPrincipal > 0 ? paydownResult.loanPrincipal : 100000;

  const getX = (yr) => margin.left + (totalTermYears > 0 ? (yr / totalTermYears) * plotWidth : 0);
  const getY = (val) => margin.top + plotHeight - (maxBalance > 0 ? (val / maxBalance) * plotHeight : 0);

  // Smooth Standard 30-Year Baseline Curve across all monthly points
  const baselinePts = paydownResult.baselineMonthlyPoints || [];
  let pathBaseline = `M ${getX(0)} ${getY(paydownResult.loanPrincipal)}`;
  baselinePts.forEach(pt => {
    pathBaseline += ` L ${getX(pt.month / 12)} ${getY(pt.balance)}`;
  });

  // Smooth Accelerated Paydown Curve across all accelerated points
  const accPts = paydownResult.acceleratedMonthlyPoints || [];
  let pathAccArea = `M ${getX(0)} ${getY(0)}`;
  let pathAccLine = `M ${getX(0)} ${getY(paydownResult.loanPrincipal)}`;

  accPts.forEach(pt => {
    const yr = pt.month / 12;
    pathAccArea += ` L ${getX(yr)} ${getY(pt.balance)}`;
    pathAccLine += ` L ${getX(yr)} ${getY(pt.balance)}`;
  });
  const payoffYear = paydownResult.payoffMonth / 12;
  pathAccArea += ` L ${getX(payoffYear)} ${getY(0)} Z`;

  // Clean Y Ticks ($400k, $300k, $200k, $100k, $0)
  const yTicks = [0, maxBalance * 0.25, maxBalance * 0.5, maxBalance * 0.75, maxBalance];
  let gridSvg = yTicks.map(val => {
    const y = getY(val);
    return `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="var(--border)" stroke-dasharray="3 3" opacity="0.6" />
      <text x="${margin.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--muted-foreground)" font-family="var(--font-mono)" font-size="10.5" class="num select-none">${formatCompactCurrency(val)}</text>
    `;
  }).join('');

  // Clean X Ticks (0, 5, 10, 15, 20, 25, 30)
  const stepYr = totalTermYears <= 15 ? 2 : totalTermYears <= 30 ? 5 : 10;
  let xTicksSvg = '';
  for (let yr = 0; yr <= totalTermYears; yr += stepYr) {
    const x = getX(yr);
    const label = yr === 0 ? 'Start' : `Yr ${yr}`;
    xTicksSvg += `
      <line x1="${x}" y1="${margin.top + plotHeight}" x2="${x}" y2="${margin.top + plotHeight + 4}" stroke="var(--border)" opacity="0.8" />
      <text x="${x}" y="${margin.top + plotHeight + 18}" text-anchor="middle" fill="var(--muted-foreground)" font-family="var(--font-mono)" font-size="10.5" class="num select-none">${label}</text>
    `;
  }

  // Payoff Pin Marker
  let payoffMarkerSvg = '';
  if (paydownResult.payoffMonth < paydownResult.standardTermMonths) {
    const px = getX(payoffYear);
    payoffMarkerSvg = `
      <g class="payoff-marker">
        <line x1="${px}" y1="${margin.top + 8}" x2="${px}" y2="${margin.top + plotHeight}" stroke="var(--chart-1)" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.9" />
        <circle cx="${px}" cy="${getY(0)}" r="4.5" fill="var(--chart-1)" stroke="var(--card)" stroke-width="2" />
        <rect x="${px - 58}" y="${margin.top + 4}" width="116" height="20" rx="4" fill="var(--card)" stroke="var(--chart-1)" stroke-width="1" />
        <text x="${px}" y="${margin.top + 17}" text-anchor="middle" fill="var(--chart-1)" font-family="var(--font-mono)" font-size="10" font-weight="600" class="select-none">🎉 Debt Free: Yr ${payoffYear.toFixed(1)}</text>
      </g>
    `;
  }

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg select-none">
      <defs>
        <linearGradient id="mortgage-acc-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="var(--chart-1)" stop-opacity="0.35" />
          <stop offset="100%" stop-color="var(--chart-1)" stop-opacity="0.04" />
        </linearGradient>
      </defs>

      ${gridSvg}
      <!-- X-Axis Baseline -->
      <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="var(--border)" stroke-width="1" />
      ${xTicksSvg}
      
      <!-- Baseline Standard 30-Yr Line -->
      <path d="${pathBaseline}" fill="none" stroke="var(--muted-foreground)" stroke-width="1.75" stroke-dasharray="4 4" opacity="0.65" />
      
      <!-- Accelerated Area & Curve -->
      <path d="${pathAccArea}" fill="url(#mortgage-acc-grad)" />
      <path d="${pathAccLine}" fill="none" stroke="var(--chart-1)" stroke-width="2.5" stroke-linecap="round" />
      
      ${payoffMarkerSvg}

      <!-- Interactive Crosshair -->
      <g id="mortgage-chart-crosshair" style="display: none;">
        <line id="m-crosshair-line-x" x1="0" y1="${margin.top}" x2="0" y2="${margin.top + plotHeight}" stroke="var(--foreground)" stroke-width="1" stroke-dasharray="2 2" opacity="0.6" />
        <circle id="m-crosshair-dot-balance" r="5" fill="var(--chart-1)" stroke="var(--card)" stroke-width="2" />
      </g>
    </svg>
    <div id="mortgage-chart-tooltip" class="chart-tooltip-wrapper"></div>
  `;

  // Crosshair interactions
  const svg = container.querySelector('svg');
  const crosshair = document.getElementById('mortgage-chart-crosshair');
  const crosshairLineX = document.getElementById('m-crosshair-line-x');
  const dotBalance = document.getElementById('m-crosshair-dot-balance');
  const tooltip = document.getElementById('mortgage-chart-tooltip');

  svg.addEventListener('mousemove', (e) => {
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    if (mouseX < margin.left || mouseX > width - margin.right) {
      crosshair.style.display = 'none';
      tooltip.classList.remove('visible');
      return;
    }

    const relX = (mouseX - margin.left) / plotWidth;
    const targetMonth = Math.max(0, Math.min(totalTermYears * 12, Math.round(relX * totalTermYears * 12)));
    
    // Find closest accelerated point
    const accPoint = accPts.find(p => p.month === targetMonth) || (targetMonth > paydownResult.payoffMonth ? { month: targetMonth, balance: 0, interestPaidToDate: paydownResult.acceleratedTotalInterest } : accPts[accPts.length - 1]);
    const basePoint = baselinePts.find(p => p.month === targetMonth) || baselinePts[baselinePts.length - 1];

    const cx = getX(targetMonth / 12);
    const cy = getY(accPoint.balance);

    crosshair.style.display = 'block';
    crosshairLineX.setAttribute('x1', cx);
    crosshairLineX.setAttribute('x2', cx);
    dotBalance.setAttribute('cx', cx);
    dotBalance.setAttribute('cy', cy);

    tooltip.style.left = `${(cx / width) * 100}%`;
    tooltip.style.top = `${cy - 12}px`;
    tooltip.innerHTML = `
      <div class="tooltip-card font-mono">
        <div class="flex items-center justify-between border-b border-border pb-1 text-xs">
          <span class="font-semibold text-foreground">${formatMonthsToYears(targetMonth)}</span>
          <span class="text-primary font-bold">${formatCurrency(accPoint.balance)}</span>
        </div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground pt-0.5">
          <span>Accelerated:</span><span class="text-right text-foreground font-medium">${formatCurrency(accPoint.balance)}</span>
          <span>Baseline 30-Yr:</span><span class="text-right text-muted-foreground font-medium">${formatCurrency(basePoint.balance)}</span>
          <span>Interest to Date:</span><span class="text-right text-primary font-semibold">${formatCurrency(accPoint.interestPaidToDate || 0)}</span>
        </div>
      </div>
    `;
    tooltip.classList.add('visible');
  });

  svg.addEventListener('mouseleave', () => {
    crosshair.style.display = 'none';
    tooltip.classList.remove('visible');
  });
}

// ==========================================
// 6. UI SYNCHRONIZATION & RENDERING
// ==========================================

function updateCompoundUI() {
  const result = calculateProjection(compoundState);

  const setVal = (id, val, formatCommas = false) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) {
      el.value = formatCommas ? formatNumberWithCommas(val) : val;
    }
  };

  setVal('principal-input', compoundState.principal, true);
  setVal('principal-slider', compoundState.principal);
  setVal('monthly-input', compoundState.monthly, true);
  setVal('monthly-slider', compoundState.monthly);
  setVal('rate-input', compoundState.rate.toFixed(1));
  setVal('rate-slider', compoundState.rate);
  setVal('years-input', compoundState.years);
  setVal('years-slider', compoundState.years);

  const updateTrack = (sliderId, fillId, stateKey) => {
    const slider = document.getElementById(sliderId);
    const fill = document.getElementById(fillId);
    if (slider && fill && compoundState.ranges[stateKey]) {
      const { min, max } = compoundState.ranges[stateKey];
      const pct = Math.max(0, Math.min(100, ((compoundState[stateKey] - min) / (max - min)) * 100));
      fill.style.width = `${pct}%`;
    }
  };

  updateTrack('principal-slider', 'principal-fill', 'principal');
  updateTrack('monthly-slider', 'monthly-fill', 'monthly');
  updateTrack('rate-slider', 'rate-fill', 'rate');
  updateTrack('years-slider', 'years-fill', 'years');

  // Summary Metrics
  const elHeroBal = document.getElementById('hero-balance');
  const elHeroBadge = document.getElementById('hero-net-growth-badge');
  const elHeroDesc = document.getElementById('hero-description');
  const elHeroHeading = document.getElementById('hero-heading');
  const elStatDeposited = document.getElementById('stat-total-deposited');
  const elStatInterest = document.getElementById('stat-total-interest');
  const elStatMultiple = document.getElementById('stat-growth-multiple');
  const elStatFinalYr = document.getElementById('stat-final-year-interest');

  if (elHeroBal) elHeroBal.textContent = formatCurrency(result.finalBalance);
  if (elHeroHeading) elHeroHeading.textContent = `Portfolio Balance After ${compoundState.years} Years`;
  
  const growthPercent = result.finalBalance > 0 ? Math.round((result.totalInterest / result.finalBalance) * 100) : 0;
  if (elHeroBadge) {
    elHeroBadge.textContent = `+${formatCurrency(result.totalInterest)} Appreciation (${growthPercent}%)`;
  }
  if (elHeroDesc) {
    elHeroDesc.innerHTML = `You contribute <span class="font-mono text-foreground font-medium">${formatCurrency(result.totalDeposited)}</span> and compound appreciation generates <span class="font-mono text-primary font-semibold">${formatCurrency(result.totalInterest)}</span> on top.`;
  }

  if (elStatDeposited) elStatDeposited.textContent = formatCurrency(result.totalDeposited);
  if (elStatInterest) elStatInterest.textContent = formatCurrency(result.totalInterest);
  if (elStatMultiple) elStatMultiple.textContent = `${result.growthMultiple}×`;
  if (elStatFinalYr) elStatFinalYr.textContent = formatCurrency(result.finalYearInterest);

  // Composition Bar
  const barDep = document.getElementById('comp-bar-deposits');
  const barInt = document.getElementById('comp-bar-interest');
  const elGrowthDepVal = document.getElementById('growth-stat-dep-val');
  const elGrowthIntVal = document.getElementById('growth-stat-int-val');

  if (barDep && barInt && result.finalBalance > 0) {
    const depRatio = result.totalDeposited / result.finalBalance;
    const intRatio = result.totalInterest / result.finalBalance;
    barDep.style.flexGrow = depRatio.toFixed(4);
    barInt.style.flexGrow = intRatio.toFixed(4);
  }
  if (elGrowthDepVal) elGrowthDepVal.textContent = formatCurrency(result.totalDeposited);
  if (elGrowthIntVal) elGrowthIntVal.textContent = formatCurrency(result.totalInterest);

  // Table
  const tbody = document.getElementById('schedule-tbody');
  const rowCountSpan = document.getElementById('table-row-count');
  const resetBtn = document.getElementById('reset-overrides-btn');

  if (tbody) {
    const rows = result.schedule.filter(d => d.year > 0);
    const visibleCount = compoundState.isTableExpanded ? rows.length : Math.min(10, rows.length);
    const visibleRows = rows.slice(0, visibleCount);

    if (rowCountSpan) rowCountSpan.textContent = `${rows.length} rows`;
    if (resetBtn) {
      resetBtn.style.display = Object.keys(compoundState.yearOverrides).length > 0 ? 'inline-block' : 'none';
    }

    tbody.innerHTML = visibleRows.map(r => `
      <tr class="border-b border-border/40 hover:bg-muted/40 transition-colors cursor-pointer group" data-year="${r.year}">
        <td class="p-2.5 font-mono text-xs font-medium text-foreground">
          ${r.isCustom ? '<span class="custom-row-badge" title="Custom assumptions active"></span>' : ''}Year ${r.year}
        </td>
        <td class="p-2.5 font-mono text-xs text-right text-muted-foreground">${formatCurrency(r.depositThisYear)}</td>
        <td class="p-2.5 font-mono text-xs text-right text-muted-foreground">${formatCurrency(r.interestThisYear)}</td>
        <td class="p-2.5 font-mono text-xs text-right font-medium text-primary">${formatCurrency(r.interest)}</td>
        <td class="p-2.5 font-mono text-xs text-right font-semibold text-foreground">${formatCurrency(r.balance)}</td>
      </tr>
    `).join('');

    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const yr = Number(tr.getAttribute('data-year'));
        openCompoundYearModal(yr);
      });
    });
  }

  const toggleText = document.getElementById('table-toggle-text');
  const toggleIcon = document.getElementById('table-toggle-icon');
  const totalRows = result.schedule.length - 1;
  if (toggleText) {
    if (compoundState.isTableExpanded) {
      toggleText.textContent = 'Show fewer years';
      if (toggleIcon) toggleIcon.style.transform = 'rotate(180deg)';
    } else {
      toggleText.textContent = `Show ${Math.max(0, totalRows - 10)} more years`;
      if (toggleIcon) toggleIcon.style.transform = 'rotate(0deg)';
    }
  }

  renderCompoundChart(result.schedule, result.crossoverYear);
}

function updateMortgageUI() {
  const paydownResult = calculateMortgagePaydown(mortgageState);
  const refiResult = calculateRefinance(mortgageState);

  const setVal = (id, val, formatCommas = false) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) {
      el.value = formatCommas ? formatNumberWithCommas(val) : val;
    }
  };

  setVal('mortgage-price-input', mortgageState.price, true);
  setVal('mortgage-price-slider', mortgageState.price);
  setVal('mortgage-down-amount', mortgageState.downPayment, true);
  setVal('mortgage-down-percent', mortgageState.downPercent);
  setVal('mortgage-down-slider', mortgageState.downPercent);
  setVal('mortgage-rate-input', mortgageState.rate.toFixed(2));
  setVal('mortgage-rate-slider', mortgageState.rate);
  setVal('mortgage-term-slider', mortgageState.term);
  setVal('mortgage-extra-monthly-input', mortgageState.extraMonthly, true);
  setVal('mortgage-extra-monthly-slider', mortgageState.extraMonthly);
  setVal('mortgage-extra-annual-input', mortgageState.extraAnnual, true);
  setVal('mortgage-extra-annual-slider', mortgageState.extraAnnual);

  const elLoanBadge = document.getElementById('mortgage-loan-principal-badge');
  if (elLoanBadge) elLoanBadge.textContent = `Loan: ${formatCurrency(paydownResult.loanPrincipal)}`;

  const elTermDisplay = document.getElementById('mortgage-term-display');
  if (elTermDisplay) elTermDisplay.textContent = `${mortgageState.term} years (${mortgageState.term * 12} mos)`;

  const updateTrack = (sliderId, fillId, stateKey) => {
    const slider = document.getElementById(sliderId);
    const fill = document.getElementById(fillId);
    if (slider && fill && mortgageState.ranges[stateKey]) {
      const { min, max } = mortgageState.ranges[stateKey];
      const pct = Math.max(0, Math.min(100, ((mortgageState[stateKey] - min) / (max - min)) * 100));
      fill.style.width = `${pct}%`;
    }
  };

  updateTrack('mortgage-price-slider', 'mortgage-price-fill', 'price');
  updateTrack('mortgage-rate-slider', 'mortgage-rate-fill', 'rate');
  updateTrack('mortgage-extra-monthly-slider', 'mortgage-extra-monthly-fill', 'extraMonthly');
  updateTrack('mortgage-extra-annual-slider', 'mortgage-extra-annual-fill', 'extraAnnual');

  const downFill = document.getElementById('mortgage-down-fill');
  if (downFill) downFill.style.width = `${mortgageState.downPercent}%`;

  const termFill = document.getElementById('mortgage-term-fill');
  if (termFill) termFill.style.width = `${((mortgageState.term - 5) / (40 - 5)) * 100}%`;

  document.querySelectorAll('.term-preset-btn').forEach(btn => {
    const t = Number(btn.getAttribute('data-term'));
    if (t === mortgageState.term) {
      btn.className = 'term-preset-btn text-xs font-mono py-1 rounded border border-primary bg-primary text-primary-foreground font-semibold shadow-xs';
    } else {
      btn.className = 'term-preset-btn text-xs font-mono py-1 rounded border border-border bg-card hover:bg-muted text-muted-foreground';
    }
  });

  // Paydown Banner Metrics
  const elHeroPayment = document.getElementById('mortgage-hero-payment');
  const elHeroPayoff = document.getElementById('mortgage-hero-payoff');
  const elBadgeTimeSaved = document.getElementById('mortgage-badge-time-saved');
  const elStatIntSaved = document.getElementById('mortgage-stat-interest-saved');
  const elStatIntPaid = document.getElementById('mortgage-stat-interest-paid');
  const elStatBaseInt = document.getElementById('mortgage-stat-baseline-interest');
  const elStatTotalCost = document.getElementById('mortgage-stat-total-cost');
  const elMortgagePrinVal = document.getElementById('mortgage-stat-prin-val');
  const elMortgageIntVal = document.getElementById('mortgage-stat-int-val');

  if (elHeroPayment) {
    elHeroPayment.innerHTML = `${formatCurrency(paydownResult.totalMonthlyPayment)}<span class="text-sm font-normal text-muted-foreground font-sans">/mo</span>`;
  }
  if (elHeroPayoff) {
    elHeroPayoff.innerHTML = `Standard payment is <span class="font-mono text-foreground font-medium">${formatCurrency(paydownResult.standardMonthlyPayment)}</span> plus <span class="font-mono text-primary font-medium">+${formatCurrency(mortgageState.extraMonthly)}</span> extra principal. Loan is paid off in <span class="font-semibold text-foreground">${formatMonthsToYears(paydownResult.payoffMonth)}</span>.`;
  }
  if (elBadgeTimeSaved) {
    if (paydownResult.monthsSaved > 0) {
      elBadgeTimeSaved.textContent = `🎉 ${formatMonthsToYears(paydownResult.monthsSaved)} early!`;
      elBadgeTimeSaved.className = 'badge-pill-success';
    } else {
      elBadgeTimeSaved.textContent = 'Standard term';
      elBadgeTimeSaved.className = 'badge-pill-neutral';
    }
  }

  if (elStatIntSaved) elStatIntSaved.textContent = `+${formatCurrency(paydownResult.interestSaved)}`;
  if (elStatIntPaid) elStatIntPaid.textContent = formatCurrency(paydownResult.acceleratedTotalInterest);
  if (elStatBaseInt) elStatBaseInt.textContent = formatCurrency(paydownResult.standardTotalInterest);
  if (elStatTotalCost) elStatTotalCost.textContent = formatCurrency(paydownResult.loanPrincipal + paydownResult.acceleratedTotalInterest);

  // Mortgage Composition Bar
  const mBarPrin = document.getElementById('mortgage-comp-bar-principal');
  const mBarInt = document.getElementById('mortgage-comp-bar-interest');
  const totalLoanCost = paydownResult.loanPrincipal + paydownResult.acceleratedTotalInterest;
  if (mBarPrin && mBarInt && totalLoanCost > 0) {
    const prinRatio = paydownResult.loanPrincipal / totalLoanCost;
    const intRatio = paydownResult.acceleratedTotalInterest / totalLoanCost;
    mBarPrin.style.flexGrow = prinRatio.toFixed(4);
    mBarInt.style.flexGrow = intRatio.toFixed(4);
  }
  if (elMortgagePrinVal) elMortgagePrinVal.textContent = formatCurrency(paydownResult.loanPrincipal);
  if (elMortgageIntVal) elMortgageIntVal.textContent = formatCurrency(paydownResult.acceleratedTotalInterest);

  // Refinance Banner Metrics
  const elRefiSavings = document.getElementById('refi-hero-monthly-savings');
  const elRefiDesc = document.getElementById('refi-hero-desc');
  const elRefiBadge = document.getElementById('refi-breakeven-badge');
  const elRefiNetSavings = document.getElementById('refi-stat-net-savings');
  const elRefiCurrentInt = document.getElementById('refi-stat-current-interest');
  const elRefiNewInt = document.getElementById('refi-stat-new-interest');
  const elRefiClosingCosts = document.getElementById('refi-stat-closing-costs');
  const elRefiVerdict = document.getElementById('refi-verdict-narrative');

  if (elRefiSavings) {
    if (refiResult.monthlySavings > 0) {
      elRefiSavings.innerHTML = `Save ${formatCurrency(refiResult.monthlySavings)}<span class="text-sm font-normal text-muted-foreground font-sans">/mo</span>`;
      elRefiSavings.className = 'num font-mono text-3xl sm:text-4xl font-bold text-primary tracking-tight';
    } else {
      elRefiSavings.innerHTML = `+${formatCurrency(Math.abs(refiResult.monthlySavings))}<span class="text-sm font-normal text-muted-foreground font-sans">/mo</span>`;
      elRefiSavings.className = 'num font-mono text-3xl sm:text-4xl font-bold text-foreground tracking-tight';
    }
  }

  if (elRefiDesc) {
    elRefiDesc.innerHTML = `Monthly payment drops from <span class="font-mono text-foreground font-medium">${formatCurrency(refiResult.currentMonthlyPayment)}</span> to <span class="font-mono text-primary font-medium">${formatCurrency(refiResult.newMonthlyPayment)}</span>.`;
  }

  if (elRefiBadge) {
    if (refiResult.breakEvenMonths !== Infinity && refiResult.breakEvenMonths > 0) {
      elRefiBadge.textContent = `${refiResult.breakEvenMonths} Months to Break Even`;
      elRefiBadge.className = refiResult.breakEvenMonths <= 24 ? 'badge-pill-success' : 'badge-pill-neutral';
    } else {
      elRefiBadge.textContent = 'No Break-Even';
      elRefiBadge.className = 'badge-pill-neutral';
    }
  }

  if (elRefiNetSavings) {
    elRefiNetSavings.textContent = refiResult.netLifetimeSavings >= 0 ? `+${formatCurrency(refiResult.netLifetimeSavings)}` : `-${formatCurrency(Math.abs(refiResult.netLifetimeSavings))}`;
    elRefiNetSavings.className = refiResult.netLifetimeSavings >= 0 ? 'num font-mono text-base font-semibold text-primary' : 'num font-mono text-base font-semibold text-muted-foreground';
  }
  if (elRefiCurrentInt) elRefiCurrentInt.textContent = formatCurrency(refiResult.currentTotalRemainingInterest);
  if (elRefiNewInt) elRefiNewInt.textContent = formatCurrency(refiResult.newTotalInterest);
  if (elRefiClosingCosts) elRefiClosingCosts.textContent = formatCurrency(refiResult.closingCosts);

  if (elRefiVerdict) {
    if (refiResult.isFavorable) {
      elRefiVerdict.textContent = `Refinancing is financially favorable with ${formatCurrency(refiResult.monthlySavings)}/mo savings, rapid ${refiResult.breakEvenMonths}-month break-even, and +${formatCurrency(refiResult.netLifetimeSavings)} net lifetime savings.`;
    } else if (refiResult.netLifetimeSavings > 0) {
      elRefiVerdict.textContent = `Refinancing produces positive net lifetime savings (+${formatCurrency(refiResult.netLifetimeSavings)}), but break-even takes ${refiResult.breakEvenMonths} months.`;
    } else {
      elRefiVerdict.textContent = `Caution: With closing costs and term adjustments, this refinance scenario results in higher lifetime costs.`;
    }
  }

  // Mortgage Table
  const tbody = document.getElementById('mortgage-schedule-tbody');
  const rowCountSpan = document.getElementById('mortgage-table-row-count');
  const resetBtn = document.getElementById('mortgage-reset-overrides-btn');

  if (tbody) {
    const rows = paydownResult.schedule;
    const visibleCount = mortgageState.isTableExpanded ? rows.length : Math.min(10, rows.length);
    const visibleRows = rows.slice(0, visibleCount);

    if (rowCountSpan) rowCountSpan.textContent = `${rows.length} rows`;
    if (resetBtn) {
      resetBtn.style.display = Object.keys(mortgageState.yearOverrides).length > 0 ? 'inline-block' : 'none';
    }

    tbody.innerHTML = visibleRows.map(r => `
      <tr class="border-b border-border/40 hover:bg-muted/40 transition-colors cursor-pointer group" data-year="${r.year}">
        <td class="p-2.5 font-mono text-xs font-medium text-foreground">
          ${r.isCustom ? '<span class="custom-row-badge" title="Custom prepayment active"></span>' : ''}Year ${r.year}
        </td>
        <td class="p-2.5 font-mono text-xs text-right text-foreground font-medium">${formatCurrency(r.principalPaid)}</td>
        <td class="p-2.5 font-mono text-xs text-right text-muted-foreground">${formatCurrency(r.interestPaid)}</td>
        <td class="p-2.5 font-mono text-xs text-right font-medium text-primary">${r.extraPrepaid > 0 ? `+${formatCurrency(r.extraPrepaid)}` : '$0'}</td>
        <td class="p-2.5 font-mono text-xs text-right font-semibold text-foreground">${formatCurrency(r.remainingBalance)}</td>
      </tr>
    `).join('');

    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const yr = Number(tr.getAttribute('data-year'));
        openMortgageYearModal(yr);
      });
    });
  }

  const toggleText = document.getElementById('mortgage-table-toggle-text');
  const toggleIcon = document.getElementById('mortgage-table-toggle-icon');
  const totalRows = paydownResult.schedule.length;
  if (toggleText) {
    if (mortgageState.isTableExpanded) {
      toggleText.textContent = 'Show fewer years';
      if (toggleIcon) toggleIcon.style.transform = 'rotate(180deg)';
    } else {
      toggleText.textContent = `Show ${Math.max(0, totalRows - 10)} more years`;
      if (toggleIcon) toggleIcon.style.transform = 'rotate(0deg)';
    }
  }

  renderMortgageChart(paydownResult, mortgageState);
}

function updateUI() {
  if (mortgageState.activeTab === 'growth') {
    updateCompoundUI();
  } else {
    updateMortgageUI();
  }
}

// ==========================================
// 7. MODAL CONTROLLERS
// ==========================================

function openCompoundYearModal(year) {
  compoundState.activeModalYear = year;
  const modal = document.getElementById('year-modal-backdrop');
  const card = document.getElementById('year-modal-card');
  const title = document.getElementById('modal-year-title');
  const contribInput = document.getElementById('modal-contrib-input');
  const rateInput = document.getElementById('modal-rate-input');
  const contribHint = document.getElementById('modal-default-contrib-hint');
  const rateHint = document.getElementById('modal-default-rate-hint');

  if (!modal || !card) return;

  const currentRate = compoundState.yearOverrides[year]?.rate !== undefined ? compoundState.yearOverrides[year].rate : compoundState.rate;
  const currentContrib = compoundState.yearOverrides[year]?.contribution !== undefined ? compoundState.yearOverrides[year].contribution : compoundState.monthly * 12;

  if (title) title.textContent = `Customize Growth Year ${year}`;
  if (contribInput) contribInput.value = formatNumberWithCommas(currentContrib);
  if (rateInput) rateInput.value = currentRate;
  if (contribHint) contribHint.textContent = `Default: ${formatCurrency(compoundState.monthly * 12)}`;
  if (rateHint) rateHint.textContent = `Default: ${compoundState.rate}%`;

  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    card.classList.remove('scale-95');
    card.classList.add('scale-100');
  }, 10);
}

function closeCompoundYearModal() {
  compoundState.activeModalYear = null;
  const modal = document.getElementById('year-modal-backdrop');
  const card = document.getElementById('year-modal-card');
  if (!modal || !card) return;

  modal.classList.add('opacity-0');
  card.classList.remove('scale-100');
  card.classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 200);
}

function saveCompoundYearModal() {
  const year = compoundState.activeModalYear;
  if (!year) return;

  const contrib = parseFormattedNumber(document.getElementById('modal-contrib-input').value);
  const rate = parseFormattedNumber(document.getElementById('modal-rate-input').value);

  compoundState.yearOverrides[year] = {
    contribution: Math.max(0, contrib),
    rate: Math.max(0, rate)
  };

  closeCompoundYearModal();
  updateUI();
}

function resetCompoundCurrentYearModal() {
  const year = compoundState.activeModalYear;
  if (year && compoundState.yearOverrides[year]) {
    delete compoundState.yearOverrides[year];
  }
  closeCompoundYearModal();
  updateUI();
}

function openMortgageYearModal(year) {
  mortgageState.activeModalYear = year;
  const modal = document.getElementById('mortgage-year-modal-backdrop');
  const card = document.getElementById('mortgage-year-modal-card');
  const title = document.getElementById('mortgage-modal-year-title');
  const extraInput = document.getElementById('mortgage-modal-extra-input');
  const rateInput = document.getElementById('mortgage-modal-rate-input');
  const extraHint = document.getElementById('mortgage-modal-default-extra-hint');
  const rateHint = document.getElementById('mortgage-modal-default-rate-hint');

  if (!modal || !card) return;

  const currentRate = mortgageState.yearOverrides[year]?.rate !== undefined ? mortgageState.yearOverrides[year].rate : mortgageState.rate;
  const currentExtra = mortgageState.yearOverrides[year]?.extraPrepayment !== undefined ? mortgageState.yearOverrides[year].extraPrepayment : 0;

  if (title) title.textContent = `Customize Mortgage Year ${year}`;
  if (extraInput) extraInput.value = formatNumberWithCommas(currentExtra);
  if (rateInput) rateInput.value = currentRate;
  if (extraHint) extraHint.textContent = `Default extra: $0`;
  if (rateHint) rateHint.textContent = `Default rate: ${mortgageState.rate}%`;

  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    card.classList.remove('scale-95');
    card.classList.add('scale-100');
  }, 10);
}

function closeMortgageYearModal() {
  mortgageState.activeModalYear = null;
  const modal = document.getElementById('mortgage-year-modal-backdrop');
  const card = document.getElementById('mortgage-year-modal-card');
  if (!modal || !card) return;

  modal.classList.add('opacity-0');
  card.classList.remove('scale-100');
  card.classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 200);
}

function saveMortgageYearModal() {
  const year = mortgageState.activeModalYear;
  if (!year) return;

  const extra = parseFormattedNumber(document.getElementById('mortgage-modal-extra-input').value);
  const rate = parseFormattedNumber(document.getElementById('mortgage-modal-rate-input').value);

  mortgageState.yearOverrides[year] = {
    extraPrepayment: Math.max(0, extra),
    rate: Math.max(0, rate)
  };

  closeMortgageYearModal();
  updateUI();
}

function resetMortgageCurrentYearModal() {
  const year = mortgageState.activeModalYear;
  if (year && mortgageState.yearOverrides[year]) {
    delete mortgageState.yearOverrides[year];
  }
  closeMortgageYearModal();
  updateUI();
}

function openCreatorModal() {
  const modal = document.getElementById('creator-modal-backdrop');
  const card = document.getElementById('creator-modal-card');
  if (!modal || !card) return;

  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    card.classList.remove('scale-95');
    card.classList.add('scale-100');
  }, 10);
}

function closeCreatorModal() {
  const modal = document.getElementById('creator-modal-backdrop');
  const card = document.getElementById('creator-modal-card');
  if (!modal || !card) return;

  modal.classList.add('opacity-0');
  card.classList.remove('scale-100');
  card.classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 200);
}

function openPhotoLightbox() {
  const modal = document.getElementById('photo-lightbox-backdrop');
  const card = document.getElementById('photo-lightbox-card');
  if (!modal || !card) return;

  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    card.classList.remove('scale-95');
    card.classList.add('scale-100');
  }, 10);
}

function closePhotoLightbox() {
  const modal = document.getElementById('photo-lightbox-backdrop');
  const card = document.getElementById('photo-lightbox-card');
  if (!modal || !card) return;

  modal.classList.add('opacity-0');
  card.classList.remove('scale-100');
  card.classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 200);
}

// ==========================================
// 8. EVENT LISTENERS SETUP
// ==========================================

function setupEventListeners() {
  // Navigation Tabs
  const tabGrowth = document.getElementById('tab-btn-growth');
  const tabMortgage = document.getElementById('tab-btn-mortgage');
  const viewGrowth = document.getElementById('view-growth');
  const viewMortgage = document.getElementById('view-mortgage');
  const categoryLabel = document.getElementById('header-category-label');

  if (tabGrowth && tabMortgage) {
    tabGrowth.addEventListener('click', () => {
      mortgageState.activeTab = 'growth';
      tabGrowth.classList.add('active');
      tabGrowth.setAttribute('aria-selected', 'true');
      tabMortgage.classList.remove('active');
      tabMortgage.setAttribute('aria-selected', 'false');

      viewGrowth.classList.remove('hidden');
      viewGrowth.classList.add('block');
      viewMortgage.classList.remove('block');
      viewMortgage.classList.add('hidden');

      if (categoryLabel) categoryLabel.textContent = 'Investment Growth & Appreciation';
      updateUI();
    });

    tabMortgage.addEventListener('click', () => {
      mortgageState.activeTab = 'mortgage';
      tabMortgage.classList.add('active');
      tabMortgage.setAttribute('aria-selected', 'true');
      tabGrowth.classList.remove('active');
      tabGrowth.setAttribute('aria-selected', 'false');

      viewMortgage.classList.remove('hidden');
      viewMortgage.classList.add('block');
      viewGrowth.classList.remove('block');
      viewGrowth.classList.add('hidden');

      if (categoryLabel) categoryLabel.textContent = 'Mortgage Paydowns & Refinancing';
      updateUI();
    });
  }

  // Mortgage Submodes
  const subPaydown = document.getElementById('submode-btn-paydown');
  const subRefi = document.getElementById('submode-btn-refinance');
  const paydownInputs = document.getElementById('mortgage-paydown-inputs');
  const refiInputs = document.getElementById('mortgage-refinance-inputs');
  const summaryPaydown = document.getElementById('mortgage-summary-paydown');
  const summaryRefi = document.getElementById('mortgage-summary-refinance');

  if (subPaydown && subRefi) {
    subPaydown.addEventListener('click', () => {
      mortgageState.activeSubmode = 'paydown';
      subPaydown.classList.add('active');
      subPaydown.setAttribute('aria-selected', 'true');
      subRefi.classList.remove('active');
      subRefi.setAttribute('aria-selected', 'false');

      paydownInputs.classList.remove('hidden');
      refiInputs.classList.add('hidden');
      summaryPaydown.classList.remove('hidden');
      summaryRefi.classList.add('hidden');

      updateUI();
    });

    subRefi.addEventListener('click', () => {
      mortgageState.activeSubmode = 'refinance';
      subRefi.classList.add('active');
      subRefi.setAttribute('aria-selected', 'true');
      subPaydown.classList.remove('active');
      subPaydown.setAttribute('aria-selected', 'false');

      refiInputs.classList.remove('hidden');
      paydownInputs.classList.add('hidden');
      summaryRefi.classList.remove('hidden');
      summaryPaydown.classList.add('hidden');

      updateUI();
    });
  }

  // Binding for Compound Fields
  const bindCompoundField = (key) => {
    const input = document.getElementById(`${key}-input`);
    const slider = document.getElementById(`${key}-slider`);
    const rangeSelect = document.getElementById(`${key}-range-select`);

    if (input) {
      input.addEventListener('input', (e) => {
        let val = parseFormattedNumber(e.target.value);
        compoundState[key] = val;
        if (val > compoundState.ranges[key].max) {
          compoundState.ranges[key].max = val;
          if (slider) slider.max = val;
        }
        if (slider) slider.value = val;
        updateCompoundUI();
      });

      input.addEventListener('blur', (e) => {
        let val = parseFormattedNumber(e.target.value);
        e.target.value = (key === 'rate') ? val.toFixed(1) : (key === 'years') ? val : formatNumberWithCommas(val);
      });
    }

    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        compoundState[key] = val;
        if (input) input.value = (key === 'rate') ? val.toFixed(1) : (key === 'years') ? val : formatNumberWithCommas(val);
        updateCompoundUI();
      });
    }

    if (rangeSelect) {
      rangeSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'custom') {
          const customMax = prompt(`Enter custom max limit for ${key}:`, compoundState.ranges[key].max);
          const num = Number(customMax);
          if (num > 0) {
            compoundState.ranges[key].max = num;
            if (slider) slider.max = num;
            updateCompoundUI();
          }
        } else {
          const num = Number(val);
          compoundState.ranges[key].max = num;
          if (slider) slider.max = num;
          if (compoundState[key] > num) {
            compoundState[key] = num;
            if (input) input.value = (key === 'rate') ? num.toFixed(1) : (key === 'years') ? num : formatNumberWithCommas(num);
          }
          updateCompoundUI();
        }
      });
    }
  };

  bindCompoundField('principal');
  bindCompoundField('monthly');
  bindCompoundField('rate');
  bindCompoundField('years');

  // Compounding Frequency
  document.querySelectorAll('.toggle-item:not(.mortgage-freq-btn)').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-item:not(.mortgage-freq-btn)').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      compoundState.frequency = Number(btn.getAttribute('data-value'));
      updateCompoundUI();
    });
  });

  // Table Toggle Button for Growth
  const tableToggleBtn = document.getElementById('table-toggle-btn');
  if (tableToggleBtn) {
    tableToggleBtn.addEventListener('click', () => {
      compoundState.isTableExpanded = !compoundState.isTableExpanded;
      updateCompoundUI();
    });
  }

  const resetOverridesBtn = document.getElementById('reset-overrides-btn');
  if (resetOverridesBtn) {
    resetOverridesBtn.addEventListener('click', () => {
      compoundState.yearOverrides = {};
      updateCompoundUI();
    });
  }

  // Mortgage Inputs
  const priceInput = document.getElementById('mortgage-price-input');
  const priceSlider = document.getElementById('mortgage-price-slider');
  const priceRange = document.getElementById('mortgage-price-range-select');

  if (priceInput) {
    priceInput.addEventListener('input', (e) => {
      const val = parseFormattedNumber(e.target.value);
      mortgageState.price = val;
      mortgageState.downPayment = Math.round(val * (mortgageState.downPercent / 100));
      if (priceSlider) priceSlider.value = val;
      updateMortgageUI();
    });

    priceInput.addEventListener('blur', (e) => {
      const val = parseFormattedNumber(e.target.value);
      e.target.value = formatNumberWithCommas(val);
    });
  }
  if (priceSlider) {
    priceSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      mortgageState.price = val;
      mortgageState.downPayment = Math.round(val * (mortgageState.downPercent / 100));
      updateMortgageUI();
    });
  }
  if (priceRange) {
    priceRange.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'custom') {
        const customMax = prompt('Enter custom maximum price scale:', mortgageState.ranges.price.max);
        const num = Number(customMax);
        if (num > 0) {
          mortgageState.ranges.price.max = num;
          if (priceSlider) priceSlider.max = num;
          updateMortgageUI();
        }
      } else {
        const num = Number(val);
        mortgageState.ranges.price.max = num;
        if (priceSlider) priceSlider.max = num;
        if (mortgageState.price > num) mortgageState.price = num;
        updateMortgageUI();
      }
    });
  }

  // Down Payment
  const downAmtInput = document.getElementById('mortgage-down-amount');
  const downPctInput = document.getElementById('mortgage-down-percent');
  const downSlider = document.getElementById('mortgage-down-slider');

  if (downAmtInput) {
    downAmtInput.addEventListener('input', (e) => {
      const val = parseFormattedNumber(e.target.value);
      mortgageState.downPayment = val;
      mortgageState.downPercent = mortgageState.price > 0 ? Number(((val / mortgageState.price) * 100).toFixed(1)) : 0;
      updateMortgageUI();
    });

    downAmtInput.addEventListener('blur', (e) => {
      const val = parseFormattedNumber(e.target.value);
      e.target.value = formatNumberWithCommas(val);
    });
  }
  if (downPctInput) {
    downPctInput.addEventListener('input', (e) => {
      const val = parseFormattedNumber(e.target.value);
      mortgageState.downPercent = Math.min(100, val);
      mortgageState.downPayment = Math.round(mortgageState.price * (mortgageState.downPercent / 100));
      updateMortgageUI();
    });
  }
  if (downSlider) {
    downSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      mortgageState.downPercent = val;
      mortgageState.downPayment = Math.round(mortgageState.price * (val / 100));
      updateMortgageUI();
    });
  }

  // Mortgage Rate
  const mRateInput = document.getElementById('mortgage-rate-input');
  const mRateSlider = document.getElementById('mortgage-rate-slider');
  const mRateRange = document.getElementById('mortgage-rate-range-select');

  if (mRateInput) {
    mRateInput.addEventListener('input', (e) => {
      const val = parseFormattedNumber(e.target.value);
      mortgageState.rate = val;
      if (mRateSlider) mRateSlider.value = val;
      updateMortgageUI();
    });
    mRateInput.addEventListener('blur', (e) => {
      const val = parseFormattedNumber(e.target.value);
      e.target.value = val.toFixed(2);
    });
  }
  if (mRateSlider) {
    mRateSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      mortgageState.rate = val;
      updateMortgageUI();
    });
  }
  if (mRateRange) {
    mRateRange.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'custom') {
        const customMax = prompt('Enter custom maximum rate scale (%):', mortgageState.ranges.rate.max);
        const num = Number(customMax);
        if (num > 0) {
          mortgageState.ranges.rate.max = num;
          if (mRateSlider) mRateSlider.max = num;
          updateMortgageUI();
        }
      } else {
        const num = Number(val);
        mortgageState.ranges.rate.max = num;
        if (mRateSlider) mRateSlider.max = num;
        if (mortgageState.rate > num) mortgageState.rate = num;
        updateMortgageUI();
      }
    });
  }

  // Loan Term Presets
  document.querySelectorAll('.term-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = Number(btn.getAttribute('data-term'));
      mortgageState.term = t;
      updateMortgageUI();
    });
  });

  const termSlider = document.getElementById('mortgage-term-slider');
  if (termSlider) {
    termSlider.addEventListener('input', (e) => {
      mortgageState.term = Number(e.target.value);
      updateMortgageUI();
    });
  }

  // Extra Monthly Principal
  const extraMonInput = document.getElementById('mortgage-extra-monthly-input');
  const extraMonSlider = document.getElementById('mortgage-extra-monthly-slider');
  const extraMonRange = document.getElementById('mortgage-extra-monthly-range-select');

  if (extraMonInput) {
    extraMonInput.addEventListener('input', (e) => {
      const val = parseFormattedNumber(e.target.value);
      mortgageState.extraMonthly = val;
      if (extraMonSlider) extraMonSlider.value = val;
      updateMortgageUI();
    });
    extraMonInput.addEventListener('blur', (e) => {
      const val = parseFormattedNumber(e.target.value);
      e.target.value = formatNumberWithCommas(val);
    });
  }
  if (extraMonSlider) {
    extraMonSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      mortgageState.extraMonthly = val;
      updateMortgageUI();
    });
  }
  if (extraMonRange) {
    extraMonRange.addEventListener('change', (e) => {
      const num = Number(e.target.value);
      mortgageState.ranges.extraMonthly.max = num;
      if (extraMonSlider) extraMonSlider.max = num;
      if (mortgageState.extraMonthly > num) mortgageState.extraMonthly = num;
      updateMortgageUI();
    });
  }

  // Extra Annual Lump Sum
  const extraAnnInput = document.getElementById('mortgage-extra-annual-input');
  const extraAnnSlider = document.getElementById('mortgage-extra-annual-slider');
  const extraAnnRange = document.getElementById('mortgage-extra-annual-range-select');

  if (extraAnnInput) {
    extraAnnInput.addEventListener('input', (e) => {
      const val = parseFormattedNumber(e.target.value);
      mortgageState.extraAnnual = val;
      if (extraAnnSlider) extraAnnSlider.value = val;
      updateMortgageUI();
    });
    extraAnnInput.addEventListener('blur', (e) => {
      const val = parseFormattedNumber(e.target.value);
      e.target.value = formatNumberWithCommas(val);
    });
  }
  if (extraAnnSlider) {
    extraAnnSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      mortgageState.extraAnnual = val;
      updateMortgageUI();
    });
  }
  if (extraAnnRange) {
    extraAnnRange.addEventListener('change', (e) => {
      const num = Number(e.target.value);
      mortgageState.ranges.extraAnnual.max = num;
      if (extraAnnSlider) extraAnnSlider.max = num;
      if (mortgageState.extraAnnual > num) mortgageState.extraAnnual = num;
      updateMortgageUI();
    });
  }

  // Payment Frequency
  document.querySelectorAll('.mortgage-freq-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mortgage-freq-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      mortgageState.frequency = Number(btn.getAttribute('data-freq'));
      updateMortgageUI();
    });
  });

  // Refinance Inputs
  const bindRefiField = (id, key, isFloat = false) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', (e) => {
        const val = parseFormattedNumber(e.target.value);
        mortgageState[key] = val;
        updateMortgageUI();
      });
      el.addEventListener('blur', (e) => {
        const val = parseFormattedNumber(e.target.value);
        e.target.value = isFloat ? val.toFixed(2) : (key === 'refiCurrentTerm' || key === 'refiNewTerm') ? val : formatNumberWithCommas(val);
      });
    }
  };

  bindRefiField('refi-current-balance-input', 'refiCurrentBalance', false);
  bindRefiField('refi-current-rate-input', 'refiCurrentRate', true);
  bindRefiField('refi-current-term-input', 'refiCurrentTerm', false);
  bindRefiField('refi-new-rate-input', 'refiNewRate', true);
  bindRefiField('refi-new-term-input', 'refiNewTerm', false);
  bindRefiField('refi-closing-costs-input', 'refiClosingCosts', false);

  const refiRollCheckbox = document.getElementById('refi-roll-costs-checkbox');
  if (refiRollCheckbox) {
    refiRollCheckbox.addEventListener('change', (e) => {
      mortgageState.refiRollCosts = e.target.checked;
      updateMortgageUI();
    });
  }

  // Mortgage Table Toggle
  const mTableToggleBtn = document.getElementById('mortgage-table-toggle-btn');
  if (mTableToggleBtn) {
    mTableToggleBtn.addEventListener('click', () => {
      mortgageState.isTableExpanded = !mortgageState.isTableExpanded;
      updateMortgageUI();
    });
  }

  const mResetOverridesBtn = document.getElementById('mortgage-reset-overrides-btn');
  if (mResetOverridesBtn) {
    mResetOverridesBtn.addEventListener('click', () => {
      mortgageState.yearOverrides = {};
      updateMortgageUI();
    });
  }

  // Modal Listeners
  document.getElementById('modal-close-btn')?.addEventListener('click', closeCompoundYearModal);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeCompoundYearModal);
  document.getElementById('modal-save-btn')?.addEventListener('click', saveCompoundYearModal);
  document.getElementById('modal-reset-btn')?.addEventListener('click', resetCompoundCurrentYearModal);
  document.getElementById('year-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'year-modal-backdrop') closeCompoundYearModal();
  });

  document.getElementById('mortgage-modal-close-btn')?.addEventListener('click', closeMortgageYearModal);
  document.getElementById('mortgage-modal-cancel-btn')?.addEventListener('click', closeMortgageYearModal);
  document.getElementById('mortgage-modal-save-btn')?.addEventListener('click', saveMortgageYearModal);
  document.getElementById('mortgage-modal-reset-btn')?.addEventListener('click', resetMortgageCurrentYearModal);
  document.getElementById('mortgage-year-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'mortgage-year-modal-backdrop') closeMortgageYearModal();
  });

  // Creator Modal
  document.getElementById('creator-info-btn')?.addEventListener('click', openCreatorModal);
  document.getElementById('creator-modal-close-btn')?.addEventListener('click', closeCreatorModal);
  document.getElementById('creator-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'creator-modal-backdrop') closeCreatorModal();
  });

  // Photo Lightbox Modal
  document.getElementById('creator-avatar-btn')?.addEventListener('click', openPhotoLightbox);
  document.getElementById('photo-lightbox-close-btn')?.addEventListener('click', closePhotoLightbox);
  document.getElementById('photo-lightbox-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'photo-lightbox-backdrop') closePhotoLightbox();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePhotoLightbox();
      closeCreatorModal();
      if (compoundState.activeModalYear !== null) closeCompoundYearModal();
      if (mortgageState.activeModalYear !== null) closeMortgageYearModal();
    }
    if (e.key === 'Enter') {
      if (compoundState.activeModalYear !== null) saveCompoundYearModal();
      if (mortgageState.activeModalYear !== null) saveMortgageYearModal();
    }
  });

  // Theme Switcher
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

  if (typeof ResizeObserver !== 'undefined') {
    const chartGrowth = document.getElementById('chart-container');
    const chartMortgage = document.getElementById('mortgage-chart-container');
    const observer = new ResizeObserver(() => updateUI());
    if (chartGrowth) observer.observe(chartGrowth);
    if (chartMortgage) observer.observe(chartMortgage);
  }

  window.addEventListener('resize', () => updateUI());
}

// ==========================================
// 9. INITIALIZER
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.classList.add(savedTheme);
  }

  setupEventListeners();
  updateUI();
});
