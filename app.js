const form = document.querySelector("#pricingForm");
const valuationDate = document.querySelector("#valuationDate");
const cvaAmount = document.querySelector("#cvaAmount");
const cvaBps = document.querySelector("#cvaBps");
const swapNpv = document.querySelector("#swapNpv");
const peakExposure = document.querySelector("#peakExposure");
const exposureTable = document.querySelector("#exposureTable");
const chart = document.querySelector("#exposureChart");
const ctx = chart.getContext("2d");

const STEPS_PER_YEAR = 12;
const PAYMENT_FREQUENCY = 1;
const EXPOSURES_PER_YEAR = 4;
const RNG_SEED = 20260529;

valuationDate.textContent = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

function readInputs() {
  const data = new FormData(form);
  return {
    notional: Number(data.get("notional")),
    maturity: Number(data.get("maturity")),
    side: data.get("side"),
    fixedRate: Number(data.get("fixedRate")) / 100,
    recoveryRate: Number(data.get("recoveryRate")) / 100,
    initialRate: Number(data.get("initialRate")) / 100,
    theta: Number(data.get("theta")) / 100,
    meanReversion: Number(data.get("meanReversion")),
    volatility: Number(data.get("volatility")) / 100,
    creditSpread: Number(data.get("creditSpread")) / 10000,
    paths: Number(data.get("paths")),
  };
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function normalRandom(random) {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function discount(rate, time) {
  return Math.exp(-rate * Math.max(time, 0));
}

function annuity(rate, timeToMaturity) {
  let value = 0;
  for (let t = PAYMENT_FREQUENCY; t <= timeToMaturity + 1e-9; t += PAYMENT_FREQUENCY) {
    value += PAYMENT_FREQUENCY * discount(rate, t);
  }
  return value;
}

function swapValue(params, shortRate, timeToMaturity) {
  if (timeToMaturity <= 0) {
    return 0;
  }

  const fixedLeg = params.fixedRate * annuity(shortRate, timeToMaturity);
  const floatingLeg = 1 - discount(shortRate, timeToMaturity);
  const payerFixedValue = params.notional * (floatingLeg - fixedLeg);

  return params.side === "payFixed" ? payerFixedValue : -payerFixedValue;
}

function calculateInitialNpv(params) {
  return swapValue(params, params.initialRate, params.maturity);
}

function calculateCva(params) {
  const exposureDates = Array.from(
    { length: params.maturity * EXPOSURES_PER_YEAR },
    (_, index) => (index + 1) / EXPOSURES_PER_YEAR,
  );
  const exposureSums = new Array(exposureDates.length).fill(0);
  const random = createSeededRandom(RNG_SEED + params.paths + Math.round(params.notional / 1000000));
  const dt = 1 / STEPS_PER_YEAR;
  const totalSteps = params.maturity * STEPS_PER_YEAR;

  for (let path = 0; path < params.paths; path += 1) {
    let shortRate = params.initialRate;

    for (let step = 1; step <= totalSteps; step += 1) {
      const drift = params.meanReversion * (params.theta - shortRate) * dt;
      const diffusion = params.volatility * Math.sqrt(dt) * normalRandom(random);
      shortRate = Math.max(-0.02, shortRate + drift + diffusion);

      if (step % (STEPS_PER_YEAR / EXPOSURES_PER_YEAR) === 0) {
        const time = step / STEPS_PER_YEAR;
        const exposureIndex = Math.round(time * EXPOSURES_PER_YEAR) - 1;
        const remaining = params.maturity - time;
        const exposure = Math.max(swapValue(params, shortRate, remaining), 0);
        exposureSums[exposureIndex] += exposure;
      }
    }
  }

  const hazardRate = params.creditSpread / Math.max(1 - params.recoveryRate, 0.0001);
  let previousSurvival = 1;
  let cva = 0;

  const profile = exposureDates.map((time, index) => {
    const expectedExposure = exposureSums[index] / params.paths;
    const survival = Math.exp(-hazardRate * time);
    const marginalDefaultProbability = Math.max(previousSurvival - survival, 0);
    previousSurvival = survival;
    const df = discount(params.initialRate, time);
    const contribution = (1 - params.recoveryRate) * df * expectedExposure * marginalDefaultProbability;
    cva += contribution;

    return {
      time,
      expectedExposure,
      discountFactor: df,
      marginalDefaultProbability,
      contribution,
    };
  });

  return {
    cva,
    cvaBps: (cva / params.notional) * 10000,
    npv: calculateInitialNpv(params),
    profile,
  };
}

function formatTenor(time) {
  return Number.isInteger(time) ? `${time}Y` : `${(time * 12).toFixed(0)}M`;
}

function formatMoney(value) {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absValue >= 1000000000) {
    return `${sign}¥${(absValue / 1000000000).toFixed(2)}bn`;
  }
  if (absValue >= 1000000) {
    return `${sign}¥${(absValue / 1000000).toFixed(2)}mm`;
  }
  return `${sign}¥${Math.round(absValue).toLocaleString("ja-JP")}`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(3)}%`;
}

function renderSummary(results) {
  cvaAmount.textContent = formatMoney(results.cva);
  cvaBps.textContent = `${results.cvaBps.toFixed(2)} bp`;
  swapNpv.textContent = formatMoney(results.npv);
  swapNpv.classList.toggle("negative", results.npv < 0);

  const maxExposure = Math.max(...results.profile.map((row) => row.expectedExposure), 0);
  peakExposure.textContent = `Peak EE: ${formatMoney(maxExposure)}`;
}

function renderTable(profile) {
  exposureTable.innerHTML = profile
    .map(
      (row) => `
        <tr>
          <td>${formatTenor(row.time)}</td>
          <td>${formatMoney(row.expectedExposure)}</td>
          <td>${row.discountFactor.toFixed(4)}</td>
          <td>${formatPercent(row.marginalDefaultProbability)}</td>
          <td>${formatMoney(row.contribution)}</td>
        </tr>
      `,
    )
    .join("");
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const rect = chart.getBoundingClientRect();
  chart.width = Math.floor(rect.width * ratio);
  chart.height = Math.floor(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawChart(profile) {
  resizeCanvas();
  const { width, height } = chart.getBoundingClientRect();
  const padding = { top: 24, right: 24, bottom: 38, left: 76 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxExposure = Math.max(...profile.map((row) => row.expectedExposure), 1);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#050604";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255, 158, 24, 0.18)";
  ctx.lineWidth = 1;
  ctx.font = "12px Roboto Mono";
  ctx.fillStyle = "#9f9a82";

  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (plotHeight / 4) * i;
    const level = maxExposure * (1 - i / 4);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(formatMoney(level), 10, y + 4);
  }

  const barGap = 10;
  const barWidth = Math.max(14, (plotWidth - barGap * (profile.length - 1)) / profile.length);

  profile.forEach((row, index) => {
    const x = padding.left + index * (barWidth + barGap);
    const barHeight = (row.expectedExposure / maxExposure) * plotHeight;
    const y = padding.top + plotHeight - barHeight;

    const gradient = ctx.createLinearGradient(0, y, 0, padding.top + plotHeight);
    gradient.addColorStop(0, "#64ff57");
    gradient.addColorStop(1, "rgba(100, 255, 87, 0.18)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#ff9e18";
    ctx.fillText(formatTenor(row.time), x + barWidth / 2 - 14, height - 14);
  });

  ctx.strokeStyle = "#ff9e18";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + plotHeight);
  ctx.lineTo(width - padding.right, padding.top + plotHeight);
  ctx.stroke();
}

function runPricing() {
  const params = readInputs();
  const results = calculateCva(params);
  renderSummary(results);
  renderTable(results.profile);
  drawChart(results.profile);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  runPricing();
});

window.addEventListener("resize", runPricing);

runPricing();
