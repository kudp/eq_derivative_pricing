const JUNE_2025_SAMPLE_DATA = [
  { date: "2025-06-02", todayTemperature: 18.4, tomorrowTemperature: 19.1, ftseReturn: 0.34 },
  { date: "2025-06-03", todayTemperature: 19.1, tomorrowTemperature: 17.8, ftseReturn: -0.52 },
  { date: "2025-06-04", todayTemperature: 17.8, tomorrowTemperature: 18.6, ftseReturn: 0.21 },
  { date: "2025-06-05", todayTemperature: 18.6, tomorrowTemperature: 20.4, ftseReturn: 0.63 },
  { date: "2025-06-06", todayTemperature: 20.4, tomorrowTemperature: 21.0, ftseReturn: 0.29 },
  { date: "2025-06-09", todayTemperature: 21.2, tomorrowTemperature: 19.9, ftseReturn: -0.41 },
  { date: "2025-06-10", todayTemperature: 19.9, tomorrowTemperature: 20.7, ftseReturn: 0.18 },
  { date: "2025-06-11", todayTemperature: 20.7, tomorrowTemperature: 22.3, ftseReturn: 0.57 },
  { date: "2025-06-12", todayTemperature: 22.3, tomorrowTemperature: 23.8, ftseReturn: 0.66 },
  { date: "2025-06-13", todayTemperature: 23.8, tomorrowTemperature: 22.6, ftseReturn: -0.27 },
  { date: "2025-06-16", todayTemperature: 22.1, tomorrowTemperature: 21.5, ftseReturn: -0.09 },
  { date: "2025-06-17", todayTemperature: 21.5, tomorrowTemperature: 20.2, ftseReturn: -0.44 },
  { date: "2025-06-18", todayTemperature: 20.2, tomorrowTemperature: 21.1, ftseReturn: 0.24 },
  { date: "2025-06-19", todayTemperature: 21.1, tomorrowTemperature: 24.0, ftseReturn: 0.98 },
  { date: "2025-06-20", todayTemperature: 24.0, tomorrowTemperature: 25.2, ftseReturn: 0.51 },
  { date: "2025-06-23", todayTemperature: 24.6, tomorrowTemperature: 23.1, ftseReturn: -0.38 },
  { date: "2025-06-24", todayTemperature: 23.1, tomorrowTemperature: 22.0, ftseReturn: -0.31 },
  { date: "2025-06-25", todayTemperature: 22.0, tomorrowTemperature: 23.4, ftseReturn: 0.49 },
  { date: "2025-06-26", todayTemperature: 23.4, tomorrowTemperature: 24.7, ftseReturn: 0.46 },
  { date: "2025-06-27", todayTemperature: 24.7, tomorrowTemperature: 26.1, ftseReturn: 0.72 },
  { date: "2025-06-30", todayTemperature: 26.1, tomorrowTemperature: 25.0, ftseReturn: -0.35 },
];

const HISTORICAL_DATA = JUNE_2025_SAMPLE_DATA.map((point) => ({
  ...point,
  temperatureChangeRate: ((point.tomorrowTemperature - point.todayTemperature) / point.todayTemperature) * 100,
}));

const DEFAULT_TODAY_TEMPERATURE = 24.0;
const DEFAULT_TOMORROW_TEMPERATURE = 25.2;
const DEFAULT_TEMPERATURE_LOCATION = "London";
const DEFAULT_FORECAST_DATE = "2026-06-23";
const SVG_NS = "http://www.w3.org/2000/svg";

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateTemperatureChangeRate(todayTemperature, tomorrowTemperature) {
  if (todayTemperature === 0) return 0;
  return ((tomorrowTemperature - todayTemperature) / todayTemperature) * 100;
}

function calculateRegression(data) {
  const temperatureChangeRates = data.map((point) => point.temperatureChangeRate);
  const ftseReturns = data.map((point) => point.ftseReturn);
  const xMean = mean(temperatureChangeRates);
  const yMean = mean(ftseReturns);
  const centered = data.map((point) => ({
    x: point.temperatureChangeRate - xMean,
    y: point.ftseReturn - yMean,
  }));
  const covariance = centered.reduce((sum, point) => sum + point.x * point.y, 0);
  const xVariance = centered.reduce((sum, point) => sum + point.x ** 2, 0);
  const yVariance = centered.reduce((sum, point) => sum + point.y ** 2, 0);
  const slope = covariance / xVariance;
  const intercept = yMean - slope * xMean;
  const correlation = covariance / Math.sqrt(xVariance * yVariance);
  const rSquared = correlation ** 2;
  const residuals = data.map((point) => point.ftseReturn - (intercept + slope * point.temperatureChangeRate));
  const rmse = Math.sqrt(mean(residuals.map((value) => value ** 2)));

  return { slope, intercept, correlation, rSquared, rmse };
}

function predictFtseReturn(regression, temperatureChangeRate) {
  return regression.intercept + regression.slope * temperatureChangeRate;
}

function createSvgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function appendSvgText(parent, attributes, text) {
  const element = createSvgElement("text", attributes);
  element.textContent = text;
  parent.append(element);
  return element;
}

function formatNumber(value, digits = 1) {
  return new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value, digits = 2) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, digits)}%`;
}

function renderMetrics(regression, predictedReturn, temperatureChangeRate, todayTemperature, tomorrowTemperature) {
  const metrics = [
    { label: "相関係数 r", value: regression.correlation.toFixed(3), note: regression.correlation >= 0 ? "正の相関" : "負の相関" },
    { label: "決定係数 R²", value: regression.rSquared.toFixed(3), note: "単回帰の説明力" },
    { label: "回帰式", value: `FTSE騰落率 = ${regression.intercept.toFixed(2)} + ${regression.slope.toFixed(2)} × 気温変化率`, note: "気温変化率1%ptあたり" },
    { label: "予想騰落率", value: formatPercent(predictedReturn), note: `${formatNumber(todayTemperature)}℃ → ${formatNumber(tomorrowTemperature)}℃（${formatPercent(temperatureChangeRate)}）` },
  ];

  document.querySelector("#metricGrid").innerHTML = metrics.map((metric) => `
    <article class="metric-card">
      <span>${metric.label}</span>
      <strong>${metric.value}</strong>
      <small>${metric.note}</small>
    </article>
  `).join("");
}

function renderScatterPlot(data, regression, temperatureChangeRate) {
  const svg = document.querySelector("#scatterPlot");
  svg.innerHTML = "";
  const predictedReturn = predictFtseReturn(regression, temperatureChangeRate);
  const xValues = [...data.map((point) => point.temperatureChangeRate), temperatureChangeRate];
  const yValues = [...data.map((point) => point.ftseReturn), predictedReturn];
  const padding = 58;
  const width = 920;
  const height = 560;
  const minX = Math.floor(Math.min(...xValues) - 1);
  const maxX = Math.ceil(Math.max(...xValues) + 1);
  const minY = Math.floor((Math.min(...yValues) - 0.25) * 2) / 2;
  const maxY = Math.ceil((Math.max(...yValues) + 0.25) * 2) / 2;
  const xScale = (value) => padding + ((value - minX) / (maxX - minX)) * (width - padding * 2);
  const yScale = (value) => height - padding - ((value - minY) / (maxY - minY)) * (height - padding * 2);

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.append(createSvgElement("rect", { width, height, rx: 18, class: "plot-bg" }));

  for (let i = 0; i <= 5; i += 1) {
    const xValue = minX + ((maxX - minX) / 5) * i;
    const yValue = minY + ((maxY - minY) / 5) * i;
    svg.append(createSvgElement("line", { x1: xScale(xValue), x2: xScale(xValue), y1: padding, y2: height - padding, class: "grid-line" }));
    svg.append(createSvgElement("line", { x1: padding, x2: width - padding, y1: yScale(yValue), y2: yScale(yValue), class: "grid-line" }));
    appendSvgText(svg, { x: xScale(xValue), y: height - 22, class: "axis-label", "text-anchor": "middle" }, formatPercent(xValue, 0));
    appendSvgText(svg, { x: 18, y: yScale(yValue) + 4, class: "axis-label" }, formatPercent(yValue, 1));
  }

  const lineStart = { x: minX, y: predictFtseReturn(regression, minX) };
  const lineEnd = { x: maxX, y: predictFtseReturn(regression, maxX) };
  svg.append(createSvgElement("line", {
    x1: xScale(lineStart.x), y1: yScale(lineStart.y),
    x2: xScale(lineEnd.x), y2: yScale(lineEnd.y), class: "regression-line",
  }));

  data.forEach((point) => {
    const circle = createSvgElement("circle", { cx: xScale(point.temperatureChangeRate), cy: yScale(point.ftseReturn), r: 6.5, class: "history-dot" });
    const title = createSvgElement("title");
    title.textContent = `${point.date}: 気温変化率 ${formatPercent(point.temperatureChangeRate)} / FTSE騰落率 ${formatPercent(point.ftseReturn)}`;
    circle.append(title);
    svg.append(circle);
  });

  svg.append(createSvgElement("circle", { cx: xScale(temperatureChangeRate), cy: yScale(predictedReturn), r: 10, class: "forecast-dot" }));
  appendSvgText(svg, { x: xScale(temperatureChangeRate) + 14, y: yScale(predictedReturn) - 12, class: "forecast-label" }, "予想騰落率");
  appendSvgText(svg, { x: width / 2, y: height - 6, class: "axis-title", "text-anchor": "middle" }, "気温の日次変化率（%）");
  appendSvgText(svg, { x: 18, y: 28, class: "axis-title" }, "FTSE 100 日次騰落率（%）");

  return predictedReturn;
}

function renderTable(data) {
  document.querySelector("#dataRows").innerHTML = data.map((point) => `
    <tr>
      <td>${point.date}</td>
      <td>${formatNumber(point.todayTemperature)}℃</td>
      <td>${formatNumber(point.tomorrowTemperature)}℃</td>
      <td>${formatPercent(point.temperatureChangeRate)}</td>
      <td>${formatPercent(point.ftseReturn)}</td>
    </tr>
  `).join("");
}

function updateDashboard() {
  const todayTemperature = Number(document.querySelector("#todayTemperature").value || DEFAULT_TODAY_TEMPERATURE);
  const tomorrowTemperature = Number(document.querySelector("#tomorrowTemperature").value || DEFAULT_TOMORROW_TEMPERATURE);
  const temperatureChangeRate = calculateTemperatureChangeRate(todayTemperature, tomorrowTemperature);
  const regression = calculateRegression(HISTORICAL_DATA);
  const predictedReturn = renderScatterPlot(HISTORICAL_DATA, regression, temperatureChangeRate);
  renderMetrics(regression, predictedReturn, temperatureChangeRate, todayTemperature, tomorrowTemperature);
  renderTable(HISTORICAL_DATA);
  document.querySelector("#formulaText").textContent = `${DEFAULT_TEMPERATURE_LOCATION}（${DEFAULT_FORECAST_DATE}）の気温変化率 ${formatPercent(temperatureChangeRate)} を使ったFTSE騰落率予想 = ${regression.intercept.toFixed(2)} + ${regression.slope.toFixed(2)} × ${formatNumber(temperatureChangeRate, 2)} = ${formatPercent(predictedReturn)}`;
}

function initApp() {
  document.querySelector("#todayTemperature").value = DEFAULT_TODAY_TEMPERATURE;
  document.querySelector("#tomorrowTemperature").value = DEFAULT_TOMORROW_TEMPERATURE;
  document.querySelector("#todayTemperature").addEventListener("input", updateDashboard);
  document.querySelector("#tomorrowTemperature").addEventListener("input", updateDashboard);
  updateDashboard();
}

if (typeof document !== "undefined") {
  initApp();
}

if (typeof module !== "undefined") {
  module.exports = {
    HISTORICAL_DATA,
    calculateRegression,
    calculateTemperatureChangeRate,
    predictFtseReturn,
    DEFAULT_TODAY_TEMPERATURE,
    DEFAULT_TOMORROW_TEMPERATURE,
    DEFAULT_TEMPERATURE_LOCATION,
    DEFAULT_FORECAST_DATE,
  };
}
