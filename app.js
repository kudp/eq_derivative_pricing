const STEPS_PER_YEAR = 12;
const EXPOSURES_PER_YEAR = 4;
const SEED = 271828;

const $ = (selector) => document.querySelector(selector);
const form = $("#pricingForm");

function toRate(percent) {
  return Number(percent) / 100;
}

function readTrade() {
  const data = new FormData(form);
  return {
    notional: Number(data.get("notional")),
    maturity: Number(data.get("maturity")),
    side: data.get("side"),
    fixedRate: toRate(data.get("fixedRate")),
    recoveryRate: toRate(data.get("recoveryRate")),
    r0: toRate(data.get("initialRate")),
    theta: toRate(data.get("theta")),
    meanReversion: Number(data.get("meanReversion")),
    sigma: toRate(data.get("volatility")),
    creditSpread: Number(data.get("creditSpread")) / 10000,
    paths: Number(data.get("paths")),
  };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function standardNormal(random) {
  const u1 = Math.max(random(), Number.EPSILON);
  const u2 = Math.max(random(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function discount(rate, time) {
  return Math.exp(-rate * time);
}

function swapAnnuity(rate, maturity) {
  if (maturity <= 0) return 0;
  if (Math.abs(rate) < 1e-8) return maturity;
  return (1 - discount(rate, maturity)) / rate;
}

function swapValue(trade, shortRate, remainingMaturity) {
  if (remainingMaturity <= 0) return 0;
  const annuity = swapAnnuity(shortRate, remainingMaturity);
  const parRate = (1 - discount(shortRate, remainingMaturity)) / annuity;
  const payerValue = trade.notional * (parRate - trade.fixedRate) * annuity;
  return trade.side === "payFixed" ? payerValue : -payerValue;
}

function calculateCva(trade) {
  const exposureCount = trade.maturity * EXPOSURES_PER_YEAR;
  const exposureSums = Array(exposureCount).fill(0);
  const random = seededRandom(SEED + trade.paths + Math.round(trade.notional / 1_000_000));
  const dt = 1 / STEPS_PER_YEAR;
  const sampleEvery = STEPS_PER_YEAR / EXPOSURES_PER_YEAR;
  const totalSteps = trade.maturity * STEPS_PER_YEAR;

  for (let path = 0; path < trade.paths; path += 1) {
    let shortRate = trade.r0;

    for (let step = 1; step <= totalSteps; step += 1) {
      shortRate +=
        trade.meanReversion * (trade.theta - shortRate) * dt +
        trade.sigma * Math.sqrt(dt) * standardNormal(random);
      shortRate = Math.max(shortRate, -0.02);

      if (step % sampleEvery === 0) {
        const time = step / STEPS_PER_YEAR;
        const index = Math.round(time * EXPOSURES_PER_YEAR) - 1;
        const mtm = swapValue(trade, shortRate, trade.maturity - time);
        exposureSums[index] += Math.max(mtm, 0);
      }
    }
  }

  const lgd = 1 - trade.recoveryRate;
  const hazardRate = trade.creditSpread / Math.max(lgd, 0.0001);
  let previousSurvival = 1;
  let cva = 0;

  const rows = exposureSums.map((sum, index) => {
    const time = (index + 1) / EXPOSURES_PER_YEAR;
    const ee = sum / trade.paths;
    const survival = Math.exp(-hazardRate * time);
    const marginalPd = previousSurvival - survival;
    previousSurvival = survival;
    const contribution = lgd * discount(trade.r0, time) * ee * marginalPd;
    cva += contribution;
    return { time, ee, marginalPd, contribution };
  });

  return {
    cva,
    cvaBp: (cva / trade.notional) * 10000,
    swapNpv: swapValue(trade, trade.r0, trade.maturity),
    rows,
  };
}

function yen(value) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}¥${(abs / 1_000_000_000).toFixed(2)}bn`;
  if (abs >= 1_000_000) return `${sign}¥${(abs / 1_000_000).toFixed(2)}mm`;
  return `${sign}¥${Math.round(abs).toLocaleString("ja-JP")}`;
}

function tenor(time) {
  return Number.isInteger(time) ? `${time}Y` : `${Math.round(time * 12)}M`;
}

function render(result) {
  $("#cvaPrice").textContent = yen(result.cva);
  $("#cvaBp").textContent = `${result.cvaBp.toFixed(2)} bp`;
  $("#swapNpv").textContent = yen(result.swapNpv);
  $("#swapNpv").classList.toggle("negative", result.swapNpv < 0);

  const peak = Math.max(...result.rows.map((row) => row.ee), 0);
  $("#peakEe").textContent = `Peak EE: ${yen(peak)}`;
  $("#eeChart").innerHTML = result.rows
    .map((row) => `<div class="bar" style="height:${peak ? (row.ee / peak) * 100 : 0}%" title="${tenor(row.time)} ${yen(row.ee)}"></div>`)
    .join("");
  $("#resultRows").innerHTML = result.rows
    .map(
      (row) => `<tr><td>${tenor(row.time)}</td><td>${yen(row.ee)}</td><td>${(row.marginalPd * 100).toFixed(3)}%</td><td>${yen(row.contribution)}</td></tr>`,
    )
    .join("");
}

function price() {
  const trade = readTrade();
  const result = calculateCva(trade);
  render(result);
  return result;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  price();
});

window.CvaPricer = { calculateCva, price, swapValue };
price();
