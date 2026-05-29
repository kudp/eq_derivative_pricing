const YEAR_STEPS = 12;
const BASE_SHORT_RATE = 0.032;
const FLOAT_RATE = 0.033;
const DEFAULT_SEED = 90210;

function createRng(seed = DEFAULT_SEED) {
  let state = seed >>> 0;
  return function random() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function normalPair(random) {
  const u1 = Math.max(random(), Number.EPSILON);
  const u2 = random();
  const radius = Math.sqrt(-2 * Math.log(u1));
  const angle = 2 * Math.PI * u2;
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function swapValue({ notional, maturity, fixedRate, side, shortRate }) {
  const remainingPayments = Math.max(1, Math.round(maturity));
  let annuity = 0;

  for (let payment = 1; payment <= remainingPayments; payment += 1) {
    annuity += Math.exp(-shortRate * payment);
  }

  const fixedLeg = fixedRate * annuity * notional;
  const floatingLeg = (1 - Math.exp(-shortRate * remainingPayments) + FLOAT_RATE * 0.18 * annuity) * notional;
  const payerValue = floatingLeg - fixedLeg;

  return side === "payer" ? payerValue : -payerValue;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[index];
}

function priceCva(input) {
  const params = {
    notional: Number(input.notional),
    maturity: Number(input.maturity),
    side: input.side,
    fixedRate: Number(input.fixedRate),
    recoveryRate: Number(input.recoveryRate),
    meanReversion: Number(input.meanReversion),
    volatility: Number(input.volatility),
    creditSpread: Number(input.creditSpread),
    paths: Number(input.paths),
    seed: Number(input.seed ?? DEFAULT_SEED),
  };

  const dt = 1 / YEAR_STEPS;
  const totalSteps = Math.round(params.maturity * YEAR_STEPS);
  const defaultIntensity = params.creditSpread / Math.max(0.01, 1 - params.recoveryRate);
  const random = createRng(params.seed);
  const exposureSums = Array(totalSteps + 1).fill(0);
  const positiveExposureByStep = Array.from({ length: totalSteps + 1 }, () => []);
  let discountedLoss = 0;

  for (let path = 0; path < params.paths; path += 1) {
    let shortRate = BASE_SHORT_RATE;
    let discountFactor = 1;

    for (let step = 1; step <= totalSteps; step += 1) {
      const [z] = normalPair(random);
      shortRate += params.meanReversion * (BASE_SHORT_RATE - shortRate) * dt + params.volatility * Math.sqrt(dt) * z;
      shortRate = Math.max(-0.01, shortRate);
      discountFactor *= Math.exp(-shortRate * dt);

      const elapsed = step * dt;
      const remaining = Math.max(dt, params.maturity - elapsed);
      const mtm = swapValue({
        notional: params.notional,
        maturity: remaining,
        fixedRate: params.fixedRate,
        side: params.side,
        shortRate,
      });
      const positiveExposure = Math.max(mtm, 0);
      const defaultProbability = Math.exp(-defaultIntensity * (elapsed - dt)) - Math.exp(-defaultIntensity * elapsed);

      exposureSums[step] += positiveExposure;
      positiveExposureByStep[step].push(positiveExposure);
      discountedLoss += (1 - params.recoveryRate) * discountFactor * positiveExposure * defaultProbability;
    }
  }

  const expectedExposure = exposureSums.map((sum, step) => ({
    year: step / YEAR_STEPS,
    amount: sum / params.paths,
  }));
  const annualExposure = expectedExposure.filter((point, index) => index > 0 && index % YEAR_STEPS === 0);
  const averageEe = expectedExposure.slice(1).reduce((sum, point) => sum + point.amount, 0) / totalSteps;
  const peakEe = Math.max(...expectedExposure.map((point) => point.amount));
  const pfe95 = Math.max(...positiveExposureByStep.map((bucket) => percentile(bucket, 0.95)));

  return {
    cva: discountedLoss / params.paths,
    averageEe,
    peakEe,
    pfe95,
    swapNpv: swapValue({
      notional: params.notional,
      maturity: params.maturity,
      fixedRate: params.fixedRate,
      side: params.side,
      shortRate: BASE_SHORT_RATE,
    }),
    annualExposure,
    params,
  };
}

function formInput(form) {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
}

function drawChart(canvas, points) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = 34;
  const maxAmount = Math.max(...points.map((point) => point.amount), 1);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#07120c";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(246, 184, 59, 0.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = padding + ((height - padding * 2) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#ffb000";
  ctx.lineWidth = 4;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = padding + ((width - padding * 2) * index) / Math.max(1, points.length - 1);
    const y = height - padding - (point.amount / maxAmount) * (height - padding * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#8cff32";
  ctx.font = "22px IBM Plex Mono";
  ctx.fillText("EE", padding, 28);
}

function renderResult(result) {
  document.querySelector("#cvaPrice").value = currency(result.cva);
  document.querySelector("#avgEe").textContent = currency(result.averageEe);
  document.querySelector("#peakEe").textContent = currency(result.peakEe);
  document.querySelector("#swapNpv").textContent = currency(result.swapNpv);
  document.querySelector("#pfe95").textContent = currency(result.pfe95);
  document.querySelector("#valuationTime").textContent = new Date().toLocaleString("ja-JP");

  const sideLabel = result.params.side === "payer" ? "固定支払" : "固定受取";
  const summary = [
    "IRS CVA PRICING RESULT",
    `CVA=${currency(result.cva)}`,
    `Notional=${currency(result.params.notional)}`,
    `Maturity=${result.params.maturity}Y`,
    `Side=${sideLabel}`,
    `Fixed=${percent(result.params.fixedRate)}`,
    `CreditSpread=${percent(result.params.creditSpread)}`,
    `HW a=${result.params.meanReversion.toFixed(3)} sigma=${result.params.volatility.toFixed(3)}`,
    `Paths=${result.params.paths.toLocaleString("en-US")}`,
  ].join("\n");
  document.querySelector("#copyText").textContent = summary;
  drawChart(document.querySelector("#exposureChart"), result.annualExposure);
}

function initApp() {
  const form = document.querySelector("#pricingForm");
  const copyButton = document.querySelector("#copyButton");

  function runPricing(event) {
    event?.preventDefault();
    const result = priceCva(formInput(form));
    renderResult(result);
  }

  form.addEventListener("submit", runPricing);
  copyButton.addEventListener("click", async () => {
    const text = document.querySelector("#copyText").textContent;
    await navigator.clipboard.writeText(text);
    copyButton.textContent = "COPIED";
    setTimeout(() => { copyButton.textContent = "COPY"; }, 1200);
  });

  runPricing();
}

if (typeof document !== "undefined") {
  initApp();
}

if (typeof module !== "undefined") {
  module.exports = { priceCva, currency, swapValue };
}
