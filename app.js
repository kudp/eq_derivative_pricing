const HISTORICAL_DATA = [
  { date: "2026-05-20", temperature: 16.2, ftse: 8706.2 },
  { date: "2026-05-21", temperature: 15.4, ftse: 8739.3 },
  { date: "2026-05-22", temperature: 17.1, ftse: 8778.1 },
  { date: "2026-05-23", temperature: 18.0, ftse: 8796.4 },
  { date: "2026-05-24", temperature: 18.8, ftse: 8821.8 },
  { date: "2026-05-25", temperature: 19.6, ftse: 8842.5 },
  { date: "2026-05-26", temperature: 17.9, ftse: 8809.7 },
  { date: "2026-05-27", temperature: 20.3, ftse: 8874.9 },
  { date: "2026-05-28", temperature: 21.2, ftse: 8908.6 },
  { date: "2026-05-29", temperature: 22.5, ftse: 8956.3 },
  { date: "2026-05-30", temperature: 23.1, ftse: 8968.7 },
  { date: "2026-05-31", temperature: 20.9, ftse: 8898.2 },
  { date: "2026-06-01", temperature: 19.8, ftse: 8862.1 },
  { date: "2026-06-02", temperature: 18.6, ftse: 8824.5 },
  { date: "2026-06-03", temperature: 17.4, ftse: 8789.4 },
  { date: "2026-06-04", temperature: 16.9, ftse: 8761.6 },
  { date: "2026-06-05", temperature: 18.3, ftse: 8817.2 },
  { date: "2026-06-06", temperature: 20.1, ftse: 8872.6 },
  { date: "2026-06-07", temperature: 21.7, ftse: 8916.9 },
  { date: "2026-06-08", temperature: 22.9, ftse: 8951.5 },
  { date: "2026-06-09", temperature: 24.0, ftse: 9004.8 },
  { date: "2026-06-10", temperature: 23.6, ftse: 8988.0 },
  { date: "2026-06-11", temperature: 22.1, ftse: 8935.1 },
  { date: "2026-06-12", temperature: 20.7, ftse: 8891.0 },
  { date: "2026-06-13", temperature: 19.5, ftse: 8850.4 },
  { date: "2026-06-14", temperature: 18.7, ftse: 8829.8 },
  { date: "2026-06-15", temperature: 19.9, ftse: 8868.3 },
  { date: "2026-06-16", temperature: 21.0, ftse: 8910.6 },
  { date: "2026-06-17", temperature: 22.4, ftse: 8954.9 },
  { date: "2026-06-18", temperature: 23.3, ftse: 8986.4 },
  { date: "2026-06-19", temperature: 24.4, ftse: 9027.7 },
  { date: "2026-06-20", temperature: 25.1, ftse: 9042.5 },
  { date: "2026-06-21", temperature: 23.8, ftse: 8999.3 },
];

const DEFAULT_TOMORROW_TEMPERATURE = 37.0;
const DEFAULT_TEMPERATURE_LOCATION = "London";
const DEFAULT_TEMPERATURE_DATE = "2026-06-23";
const SVG_NS = "http://www.w3.org/2000/svg";

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateRegression(data) {
  const temperatures = data.map((point) => point.temperature);
  const prices = data.map((point) => point.ftse);
  const temperatureMean = mean(temperatures);
  const priceMean = mean(prices);
  const centered = data.map((point) => ({
    x: point.temperature - temperatureMean,
    y: point.ftse - priceMean,
  }));
  const covariance = centered.reduce((sum, point) => sum + point.x * point.y, 0);
  const xVariance = centered.reduce((sum, point) => sum + point.x ** 2, 0);
  const yVariance = centered.reduce((sum, point) => sum + point.y ** 2, 0);
  const slope = covariance / xVariance;
  const intercept = priceMean - slope * temperatureMean;
  const correlation = covariance / Math.sqrt(xVariance * yVariance);
  const rSquared = correlation ** 2;
  const residuals = data.map((point) => point.ftse - (intercept + slope * point.temperature));
  const rmse = Math.sqrt(mean(residuals.map((value) => value ** 2)));

  return { slope, intercept, correlation, rSquared, rmse };
}

function predictFtse(regression, temperature) {
  return regression.intercept + regression.slope * temperature;
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

function renderMetrics(regression, predictedPrice, tomorrowTemperature) {
  const metrics = [
    { label: "相関係数 r", value: regression.correlation.toFixed(3), note: regression.correlation >= 0 ? "正の相関" : "負の相関" },
    { label: "決定係数 R²", value: regression.rSquared.toFixed(3), note: "単回帰の説明力" },
    { label: "回帰式", value: `FTSE = ${regression.intercept.toFixed(1)} + ${regression.slope.toFixed(1)} × 気温`, note: "気温1℃あたりの指数変化" },
    { label: "明日の予想", value: `${formatNumber(predictedPrice)} pt`, note: `${DEFAULT_TEMPERATURE_LOCATION} ${DEFAULT_TEMPERATURE_DATE} の${formatNumber(tomorrowTemperature)}℃を使用` },
  ];

  document.querySelector("#metricGrid").innerHTML = metrics.map((metric) => `
    <article class="metric-card">
      <span>${metric.label}</span>
      <strong>${metric.value}</strong>
      <small>${metric.note}</small>
    </article>
  `).join("");
}

function renderScatterPlot(data, regression, tomorrowTemperature) {
  const svg = document.querySelector("#scatterPlot");
  svg.innerHTML = "";
  const predictedPrice = predictFtse(regression, tomorrowTemperature);
  const temperatures = [...data.map((point) => point.temperature), tomorrowTemperature];
  const prices = [...data.map((point) => point.ftse), predictedPrice];
  const padding = 58;
  const width = 920;
  const height = 560;
  const minTemp = Math.floor(Math.min(...temperatures) - 1);
  const maxTemp = Math.ceil(Math.max(...temperatures) + 1);
  const minPrice = Math.floor((Math.min(...prices) - 80) / 50) * 50;
  const maxPrice = Math.ceil((Math.max(...prices) + 80) / 50) * 50;
  const xScale = (value) => padding + ((value - minTemp) / (maxTemp - minTemp)) * (width - padding * 2);
  const yScale = (value) => height - padding - ((value - minPrice) / (maxPrice - minPrice)) * (height - padding * 2);

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.append(createSvgElement("rect", { width, height, rx: 18, class: "plot-bg" }));

  for (let i = 0; i <= 5; i += 1) {
    const temp = minTemp + ((maxTemp - minTemp) / 5) * i;
    const price = minPrice + ((maxPrice - minPrice) / 5) * i;
    svg.append(createSvgElement("line", { x1: xScale(temp), x2: xScale(temp), y1: padding, y2: height - padding, class: "grid-line" }));
    svg.append(createSvgElement("line", { x1: padding, x2: width - padding, y1: yScale(price), y2: yScale(price), class: "grid-line" }));
    appendSvgText(svg, { x: xScale(temp), y: height - 22, class: "axis-label", "text-anchor": "middle" }, `${formatNumber(temp, 0)}℃`);
    appendSvgText(svg, { x: 18, y: yScale(price) + 4, class: "axis-label" }, formatNumber(price, 0));
  }

  const lineStart = { temperature: minTemp, ftse: predictFtse(regression, minTemp) };
  const lineEnd = { temperature: maxTemp, ftse: predictFtse(regression, maxTemp) };
  svg.append(createSvgElement("line", {
    x1: xScale(lineStart.temperature), y1: yScale(lineStart.ftse),
    x2: xScale(lineEnd.temperature), y2: yScale(lineEnd.ftse), class: "regression-line",
  }));

  data.forEach((point) => {
    const circle = createSvgElement("circle", { cx: xScale(point.temperature), cy: yScale(point.ftse), r: 6.5, class: "history-dot" });
    const title = createSvgElement("title");
    title.textContent = `${point.date}: ${point.temperature}℃ / FTSE ${formatNumber(point.ftse)}`;
    circle.append(title);
    svg.append(circle);
  });

  svg.append(createSvgElement("circle", { cx: xScale(tomorrowTemperature), cy: yScale(predictedPrice), r: 10, class: "forecast-dot" }));
  appendSvgText(svg, { x: xScale(tomorrowTemperature) + 14, y: yScale(predictedPrice) - 12, class: "forecast-label" }, "明日の予想");
  appendSvgText(svg, { x: width / 2, y: height - 6, class: "axis-title", "text-anchor": "middle" }, "日次平均気温（℃）");
  appendSvgText(svg, { x: 18, y: 28, class: "axis-title" }, "FTSE 100 終値（pt）");

  return predictedPrice;
}

function renderTable(data) {
  document.querySelector("#dataRows").innerHTML = data.map((point) => `
    <tr>
      <td>${point.date}</td>
      <td>${formatNumber(point.temperature)}℃</td>
      <td>${formatNumber(point.ftse)} pt</td>
    </tr>
  `).join("");
}

function updateDashboard() {
  const temperatureInput = document.querySelector("#tomorrowTemperature");
  const tomorrowTemperature = Number(temperatureInput.value || DEFAULT_TOMORROW_TEMPERATURE);
  const regression = calculateRegression(HISTORICAL_DATA);
  const predictedPrice = renderScatterPlot(HISTORICAL_DATA, regression, tomorrowTemperature);
  renderMetrics(regression, predictedPrice, tomorrowTemperature);
  renderTable(HISTORICAL_DATA);
  document.querySelector("#formulaText").textContent = `${DEFAULT_TEMPERATURE_LOCATION}（${DEFAULT_TEMPERATURE_DATE}）の気温を使ったFTSE予想 = ${regression.intercept.toFixed(1)} + ${regression.slope.toFixed(1)} × ${formatNumber(tomorrowTemperature)} = ${formatNumber(predictedPrice)} pt`;
}

function initApp() {
  document.querySelector("#tomorrowTemperature").value = DEFAULT_TOMORROW_TEMPERATURE;
  document.querySelector("#tomorrowTemperature").addEventListener("input", updateDashboard);
  updateDashboard();
}

if (typeof document !== "undefined") {
  initApp();
}

if (typeof module !== "undefined") {
  module.exports = { HISTORICAL_DATA, calculateRegression, predictFtse, DEFAULT_TOMORROW_TEMPERATURE, DEFAULT_TEMPERATURE_LOCATION, DEFAULT_TEMPERATURE_DATE };
}
