const CONTRACT_SIZE_DEFAULT = 100;
const DAY_COUNT = 365.0;

const refs = {
  tradeInput: document.getElementById("tradeInput"),
  modelSelect: document.getElementById("modelSelect"),
  currencySelect: document.getElementById("currencySelect"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  spotInput: document.getElementById("spotInput"),
  rateInput: document.getElementById("rateInput"),
  dividendInput: document.getElementById("dividendInput"),
  volInput: document.getElementById("volInput"),
  lookbackInput: document.getElementById("lookbackInput"),
  multiplierInput: document.getElementById("multiplierInput"),
  usdJpyInput: document.getElementById("usdJpyInput"),
  mcPathsInput: document.getElementById("mcPathsInput"),
  mcStepsInput: document.getElementById("mcStepsInput"),
  sabrBetaInput: document.getElementById("sabrBetaInput"),
  sabrNuInput: document.getElementById("sabrNuInput"),
  sabrRhoInput: document.getElementById("sabrRhoInput"),
  hestonV0Input: document.getElementById("hestonV0Input"),
  hestonThetaInput: document.getElementById("hestonThetaInput"),
  hestonKappaInput: document.getElementById("hestonKappaInput"),
  hestonXiInput: document.getElementById("hestonXiInput"),
  hestonRhoInput: document.getElementById("hestonRhoInput"),
  priceButton: document.getElementById("priceButton"),
  statusMessage: document.getElementById("statusMessage"),
  parsedTrade: document.getElementById("parsedTrade"),
  marketSnapshot: document.getElementById("marketSnapshot"),
  metrics: document.getElementById("metrics"),
};

function setStatus(message, type = "idle") {
  refs.statusMessage.textContent = message;
  refs.statusMessage.className = `status ${type}`;
}

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function capitalize(value) {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function extractAssignedExpression(text, labels) {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*(?:=|:)\\s*([^\\s,;]+)`, "i");
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function evaluateFormulaExpression(expression, variables) {
  if (!expression) {
    return null;
  }

  const normalized = expression.replace(/\^/g, "**");
  if (!/^[0-9+\-*/()._\sA-Za-z]+$/.test(normalized)) {
    throw new Error(`Unsupported formula: ${expression}`);
  }

  const tokens = normalized.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  const allowed = new Set(Object.keys(variables));
  for (const token of tokens) {
    if (!allowed.has(token)) {
      throw new Error(`Unsupported formula variable: ${token}`);
    }
  }

  const argNames = Object.keys(variables);
  const argValues = Object.values(variables);
  const evaluator = new Function(...argNames, `return (${normalized});`);
  const value = evaluator(...argValues);
  return Number.isFinite(value) ? value : null;
}

function normalPdf(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * absX);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX));
  return sign * y;
}

function normalCdf(x) {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

function blackScholes({ spot, strike, rate, dividend, vol, time, optionType }) {
  if (time <= 0) {
    const intrinsic =
      optionType === "call" ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0);
    return {
      price: intrinsic,
      delta: optionType === "call" ? (spot > strike ? 1 : 0) : spot < strike ? -1 : 0,
      gamma: 0,
      vega: 0,
      theta: 0,
    };
  }

  const sigma = Math.max(vol, 1e-6);
  const sqrtT = Math.sqrt(time);
  const d1 =
    (Math.log(spot / strike) + (rate - dividend + 0.5 * sigma * sigma) * time) /
    (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const dfR = Math.exp(-rate * time);
  const dfQ = Math.exp(-dividend * time);

  let price;
  let delta;
  if (optionType === "call") {
    price = spot * dfQ * normalCdf(d1) - strike * dfR * normalCdf(d2);
    delta = dfQ * normalCdf(d1);
  } else {
    price = strike * dfR * normalCdf(-d2) - spot * dfQ * normalCdf(-d1);
    delta = dfQ * (normalCdf(d1) - 1);
  }

  const gamma = (dfQ * normalPdf(d1)) / (spot * sigma * sqrtT);
  const vega = spot * dfQ * normalPdf(d1) * sqrtT;
  const thetaCommon = -(spot * dfQ * normalPdf(d1) * sigma) / (2 * sqrtT);
  const theta =
    optionType === "call"
      ? thetaCommon - rate * strike * dfR * normalCdf(d2) + dividend * spot * dfQ * normalCdf(d1)
      : thetaCommon + rate * strike * dfR * normalCdf(-d2) - dividend * spot * dfQ * normalCdf(-d1);

  return { price, delta, gamma, vega, theta };
}

function parseNaturalLanguageTrade(input) {
  const text = input.trim();
  const normalized = text
    .replace(/[，、]/g, " ")
    .replace(/[．。]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const upperText = normalized.toUpperCase();
  const symbolMatch = upperText.match(/\b[A-Z]{1,5}(?:\.[A-Z]{1,3})?\b/);
  const symbol = symbolMatch ? symbolMatch[0] : null;

  let optionType = null;
  if (/コール|CALL/.test(upperText)) {
    optionType = "call";
  } else if (/プット|PUT/.test(upperText)) {
    optionType = "put";
  }

  let side = 1;
  if (/売り|ショート|SELL|SHORT/.test(upperText)) {
    side = -1;
  }

  const quantityPatterns = [
    /(?:QTY|QUANTITY|NOTIONAL|N)\s*(?:=|:)?\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:枚|LOT|LOTS|CONTRACT|CONTRACTS)/i,
    /(\d+(?:\.\d+)?)\s*(?:買い|売り)/i,
    /(?:BUY|SELL|LONG|SHORT)\s+(\d+(?:\.\d+)?)/i,
  ];
  let quantity = 1;
  const quantityExpression = extractAssignedExpression(normalized, ["QTY", "QUANTITY", "N", "NOTIONAL"]);
  for (const pattern of quantityPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      quantity = Number(match[1]);
      break;
    }
  }

  const strikePatterns = [
    /(?:K|STRIKE)\s*(?:=|:)?\s*(\d+(?:\.\d+)?)/i,
    /(?:権利行使価格|ストライク|STRIKE)\s*(?:は|=|:)?\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:ドル|USD|円|JPY)\s*(?:の)?\s*(?:コール|プット|CALL|PUT)/i,
    /\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b\s+(\d+(?:\.\d+)?)\s+(?:CALL|PUT)\b/i,
    /\b(\d+(?:\.\d+)?)\s+(?:CALL|PUT)\b/i,
  ];
  let strike = null;
  const strikeExpression = extractAssignedExpression(normalized, ["K", "STRIKE"]);
  for (const pattern of strikePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      strike = Number(match[1]);
      break;
    }
  }

  let expiry = null;
  const formulaDateMatch = normalized.match(/(?:T|EXP|EXPIRY|EXPIRATION|MATURITY)\s*(?:=|:)?\s*(20\d{2}[-/]\d{1,2}[-/]\d{1,2})/i);
  if (formulaDateMatch) {
    const [year, month, day] = formulaDateMatch[1].split(/[-/]/).map(Number);
    expiry = new Date(Date.UTC(year, month - 1, day));
  }
  const isoMatch = normalized.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    expiry = new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])));
  }
  if (!expiry) {
    const jpMatch = normalized.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);
    if (jpMatch) {
      expiry = new Date(Date.UTC(Number(jpMatch[1]), Number(jpMatch[2]) - 1, Number(jpMatch[3])));
    }
  }

  const hasStrike = Number.isFinite(strike) || Boolean(strikeExpression);
  if (!symbol || !optionType || !hasStrike || !expiry) {
    const extracted = {
      ticker: symbol,
      optionType,
      side: side > 0 ? "long" : "short",
      quantity,
      strike,
      strikeExpression,
      expiry: expiry ? expiry.toISOString().slice(0, 10) : null,
    };
    const missing = [];
    if (!symbol) {
      missing.push("ticker");
    }
    if (!optionType) {
      missing.push("call/put");
    }
    if (!hasStrike) {
      missing.push("strike");
    }
    if (!expiry) {
      missing.push("expiry");
    }

    const error = new Error(
      `Could not fully parse the trade. Missing: ${missing.join(", ")}. Example: Buy 10 AAPL 2026-12-18 220 call`
      + ` or Buy qty=10 AAPL call K=220 T=2026-12-18`
    );
    error.code = "PARSE_INCOMPLETE";
    error.details = { extracted, missing };
    throw error;
  }

  return {
    symbol,
    optionType,
    side,
    quantity,
    strike,
    quantityExpression,
    strikeExpression,
    expiry: expiry.toISOString().slice(0, 10),
    rawText: text,
  };
}

function yearFraction(expiryIso) {
  const now = new Date();
  const expiry = new Date(`${expiryIso}T00:00:00Z`);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.max(diffMs / (1000 * 60 * 60 * 24 * DAY_COUNT), 1 / DAY_COUNT);
}

async function fetchAlphaVantageData(symbol, apiKey, lookbackDays) {
  const quoteUrl =
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&datatype=json&apikey=${encodeURIComponent(apiKey)}`;
  const seriesUrl =
    `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&datatype=json&apikey=${encodeURIComponent(apiKey)}`;
  const overviewUrl =
    `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;

  const [quoteRes, seriesRes, overviewRes] = await Promise.all([
    fetch(quoteUrl),
    fetch(seriesUrl),
    fetch(overviewUrl),
  ]);

  if (!quoteRes.ok || !seriesRes.ok || !overviewRes.ok) {
    throw new Error("Could not fetch market data. Please check the API key and any browser CORS restrictions.");
  }

  const [quoteJson, seriesJson, overviewJson] = await Promise.all([
    quoteRes.json(),
    seriesRes.json(),
    overviewRes.json(),
  ]);

  if (quoteJson.Note || seriesJson.Note) {
    throw new Error("Alpha Vantage may have rate-limited the request. Please wait a bit and try again.");
  }

  const quote = quoteJson["Global Quote"];
  const series = seriesJson["Time Series (Daily)"];
  if (!quote || !series) {
    throw new Error("Could not retrieve quote or historical data. Please verify the ticker format.");
  }

  const spot = Number(quote["05. price"]);
  const closeSeries = Object.entries(series)
    .slice(0, Math.max(5, lookbackDays))
    .map(([date, row]) => ({
      date,
      close: Number(row["4. close"]),
    }))
    .filter((row) => Number.isFinite(row.close))
    .sort((a, b) => a.date.localeCompare(b.date));

  const dividendYieldRaw = Number(overviewJson.DividendYield);
  const dividendYield = Number.isFinite(dividendYieldRaw) ? dividendYieldRaw : null;

  return {
    spot,
    closeSeries,
    dividendYield,
    latestTradingDay: quote["07. latest trading day"] || null,
  };
}

function realizedVolatility(closeSeries) {
  if (!Array.isArray(closeSeries) || closeSeries.length < 2) {
    return null;
  }
  const logReturns = [];
  for (let i = 1; i < closeSeries.length; i += 1) {
    const prev = closeSeries[i - 1].close;
    const current = closeSeries[i].close;
    if (prev > 0 && current > 0) {
      logReturns.push(Math.log(current / prev));
    }
  }
  if (logReturns.length < 2) {
    return null;
  }
  const mean = logReturns.reduce((acc, value) => acc + value, 0) / logReturns.length;
  const variance =
    logReturns.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (logReturns.length - 1);
  return Math.sqrt(variance * 252);
}

function sabrImpliedVol({ forward, strike, time, alpha, beta, rho, nu }) {
  const f = Math.max(forward, 1e-8);
  const k = Math.max(strike, 1e-8);
  const oneMinusBeta = 1 - beta;

  if (Math.abs(f - k) < 1e-10) {
    const fkPow = Math.pow(f, oneMinusBeta);
    const term1 = alpha / fkPow;
    const correction =
      ((oneMinusBeta ** 2 * alpha ** 2) / (24 * fkPow * fkPow) +
        (rho * beta * nu * alpha) / (4 * fkPow) +
        ((2 - 3 * rho ** 2) * nu ** 2) / 24) *
      time;
    return Math.max(term1 * (1 + correction), 1e-6);
  }

  const logFk = Math.log(f / k);
  const fkBeta = Math.pow(f * k, oneMinusBeta / 2);
  const z = (nu / alpha) * fkBeta * logFk;
  const xz = Math.log((Math.sqrt(1 - 2 * rho * z + z * z) + z - rho) / (1 - rho));
  const numerator = alpha * z;
  const denominator =
    fkBeta *
    xz *
    (1 +
      ((oneMinusBeta ** 2) / 24) * logFk ** 2 +
      ((oneMinusBeta ** 4) / 1920) * logFk ** 4);

  const correction =
    1 +
    (((oneMinusBeta ** 2 * alpha ** 2) / (24 * fkBeta ** 2)) +
      (rho * beta * nu * alpha) / (4 * fkBeta) +
      ((2 - 3 * rho ** 2) * nu ** 2) / 24) *
      time;

  return Math.max((numerator / denominator) * correction, 1e-6);
}

function simpsonIntegral(fn, lower, upper, intervals = 400) {
  const n = intervals % 2 === 0 ? intervals : intervals + 1;
  const h = (upper - lower) / n;
  let sum = fn(lower) + fn(upper);
  for (let i = 1; i < n; i += 1) {
    const x = lower + i * h;
    sum += fn(x) * (i % 2 === 0 ? 2 : 4);
  }
  return (h / 3) * sum;
}

function sampleStandardNormal() {
  let u1 = 0;
  let u2 = 0;
  while (u1 <= Number.EPSILON) {
    u1 = Math.random();
    u2 = Math.random();
  }
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function hestonMonteCarlo({ spot, strike, rate, dividend, time, optionType, params, paths, steps }) {
  const dt = time / Math.max(steps, 1);
  const sqrtDt = Math.sqrt(dt);
  const kappa = Math.max(params.kappa, 1e-8);
  const theta = Math.max(params.theta, 1e-8);
  const xi = Math.max(params.xi, 1e-8);
  const rho = Math.min(Math.max(params.rho, -0.999), 0.999);
  let payoffSum = 0;

  for (let p = 0; p < paths; p += 1) {
    let s = spot;
    let v = Math.max(params.v0, 1e-8);

    for (let step = 0; step < steps; step += 1) {
      const z1 = sampleStandardNormal();
      const z2 = sampleStandardNormal();
      const w1 = z1;
      const w2 = rho * z1 + Math.sqrt(1 - rho * rho) * z2;
      const vPositive = Math.max(v, 0);
      const varianceDrift = kappa * (theta - vPositive) * dt;
      const varianceShock = xi * Math.sqrt(vPositive) * sqrtDt * w2;
      v = Math.max(v + varianceDrift + varianceShock, 1e-8);

      const drift = (rate - dividend - 0.5 * vPositive) * dt;
      const shock = Math.sqrt(vPositive) * sqrtDt * w1;
      s *= Math.exp(drift + shock);
    }

    const payoff =
      optionType === "call" ? Math.max(s - strike, 0) : Math.max(strike - s, 0);
    payoffSum += payoff;
  }

  return Math.exp(-rate * time) * (payoffSum / paths);
}

function createMetricCard(label, value, detail) {
  return `
    <article class="metric-card">
      <h3>${label}</h3>
      <strong>${value}</strong>
      <small>${detail}</small>
    </article>
  `;
}

function formatMoney(value, currency) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value, digits = 4) {
  return Number(value).toFixed(digits);
}

async function evaluateTrade() {
  try {
    setStatus("Parsing trade description...", "idle");
    refs.metrics.innerHTML = "";

    const trade = parseNaturalLanguageTrade(refs.tradeInput.value);
    const model = refs.modelSelect.value;
    const currency = refs.currencySelect.value;
    const apiKey = refs.apiKeyInput.value.trim();
    const lookbackDays = Math.max(20, safeNumber(refs.lookbackInput.value, 90));
    const multiplier = Math.max(1, safeNumber(refs.multiplierInput.value, CONTRACT_SIZE_DEFAULT));
    const usdJpy = Math.max(0.01, safeNumber(refs.usdJpyInput.value, 150));
    const mcPaths = Math.max(500, Math.floor(safeNumber(refs.mcPathsInput.value, 4000)));
    const mcSteps = Math.max(10, Math.floor(safeNumber(refs.mcStepsInput.value, 90)));

    const market = {
      spot: safeNumber(refs.spotInput.value, NaN),
      rate: safeNumber(refs.rateInput.value, 0.045),
      dividend: safeNumber(refs.dividendInput.value, 0),
      vol: safeNumber(refs.volInput.value, 0.25),
      source: "manual",
      latestTradingDay: null,
    };

    let closeSeries = [];
    if (apiKey) {
      setStatus("Fetching latest spot and historical data...", "idle");
      const live = await fetchAlphaVantageData(trade.symbol, apiKey, lookbackDays);
      if (Number.isFinite(live.spot)) {
        market.spot = live.spot;
      }
      if (live.dividendYield !== null) {
        market.dividend = live.dividendYield;
      }
      closeSeries = live.closeSeries;
      market.source = "alpha_vantage";
      market.latestTradingDay = live.latestTradingDay;
    }

    if (!Number.isFinite(market.spot) || market.spot <= 0) {
      throw new Error("Spot is missing. Enter it manually or provide an API key.");
    }

    if ((!Number.isFinite(trade.strike) || trade.strike <= 0) && trade.strikeExpression) {
      const evaluatedStrike = evaluateFormulaExpression(trade.strikeExpression, {
        Spot: market.spot,
        S: market.spot,
        spot: market.spot,
        s: market.spot,
      });
      if (!Number.isFinite(evaluatedStrike) || evaluatedStrike <= 0) {
        throw new Error(`Could not evaluate strike formula: ${trade.strikeExpression}`);
      }
      trade.strike = evaluatedStrike;
    }

    if (trade.quantityExpression) {
      const evaluatedQuantity = evaluateFormulaExpression(trade.quantityExpression, {
        Spot: market.spot,
        S: market.spot,
        spot: market.spot,
        s: market.spot,
      });
      if (Number.isFinite(evaluatedQuantity) && evaluatedQuantity > 0) {
        trade.quantity = evaluatedQuantity;
      }
    }

    if (!Number.isFinite(trade.strike) || trade.strike <= 0) {
      throw new Error("Strike is missing. Enter K=<number> or a formula such as K=Spot*1.1.");
    }

    const histVol = realizedVolatility(closeSeries);
    if (histVol) {
      market.vol = histVol;
    }

    const time = yearFraction(trade.expiry);
    const signedQuantity = trade.quantity * trade.side;
    let unitPrice;
    let greeks = null;
    let modelVol = market.vol;

    if (model === "sabr") {
      const beta = safeNumber(refs.sabrBetaInput.value, 0.7);
      const nu = safeNumber(refs.sabrNuInput.value, 0.5);
      const rho = safeNumber(refs.sabrRhoInput.value, -0.25);
      const forward = market.spot * Math.exp((market.rate - market.dividend) * time);
      const alpha = market.vol * Math.pow(Math.max(forward, 1e-6), 1 - beta);
      modelVol = sabrImpliedVol({
        forward,
        strike: trade.strike,
        time,
        alpha,
        beta,
        rho,
        nu,
      });
      greeks = blackScholes({
        spot: market.spot,
        strike: trade.strike,
        rate: market.rate,
        dividend: market.dividend,
        vol: modelVol,
        time,
        optionType: trade.optionType,
      });
      unitPrice = greeks.price;
    } else {
      const params = {
        v0: safeNumber(refs.hestonV0Input.value, 0.0625),
        theta: safeNumber(refs.hestonThetaInput.value, 0.0625),
        kappa: safeNumber(refs.hestonKappaInput.value, 1.8),
        xi: safeNumber(refs.hestonXiInput.value, 0.55),
        rho: safeNumber(refs.hestonRhoInput.value, -0.65),
      };
      unitPrice = hestonMonteCarlo({
        spot: market.spot,
        strike: trade.strike,
        rate: market.rate,
        dividend: market.dividend,
        time,
        optionType: trade.optionType,
        params,
        paths: mcPaths,
        steps: mcSteps,
      });
      modelVol = Math.sqrt(Math.max((params.v0 + params.theta) / 2, 1e-8));
      greeks = blackScholes({
        spot: market.spot,
        strike: trade.strike,
        rate: market.rate,
        dividend: market.dividend,
        vol: modelVol,
        time,
        optionType: trade.optionType,
      });
    }

    const fxRate = currency === "JPY" ? usdJpy : 1;
    const unitPriceDisplay = unitPrice * multiplier * fxRate;
    const positionValue = unitPrice * signedQuantity * multiplier * fxRate;

    refs.metrics.innerHTML = [
      createMetricCard("Unit Premium", formatMoney(unitPriceDisplay, currency), `Premium for ${multiplier} underlying shares`),
      createMetricCard("Position MTM", formatMoney(positionValue, currency), `${trade.quantity} contracts x ${trade.side > 0 ? "Long" : "Short"}`),
      createMetricCard("Model Vol", formatNumber(modelVol * 100, 2) + "%", `Effective volatility used by ${model.toUpperCase()}`),
      createMetricCard("Delta", formatNumber(greeks.delta * signedQuantity * multiplier, 2), "Position delta"),
      createMetricCard("Gamma", formatNumber(greeks.gamma * signedQuantity * multiplier, 6), "Position gamma"),
      createMetricCard("Vega", formatNumber((greeks.vega / 100) * signedQuantity * multiplier, 4), "Per 1 vol point"),
    ].join("");

    refs.parsedTrade.textContent = JSON.stringify(
      {
        ...trade,
        model,
        timeToExpiryYears: Number(formatNumber(time, 6)),
      },
      null,
      2
    );

    refs.marketSnapshot.textContent = JSON.stringify(
      {
        source: market.source,
        latestTradingDay: market.latestTradingDay,
        spot: market.spot,
        rate: market.rate,
        dividend: market.dividend,
        inputVol: safeNumber(refs.volInput.value, 0.25),
        realizedVol: histVol,
        effectiveVol: modelVol,
        fxRateApplied: fxRate,
        lookbackDays,
        mcPaths: model === "heston" ? mcPaths : null,
        mcSteps: model === "heston" ? mcSteps : null,
      },
      null,
      2
    );

    setStatus("Pricing completed. Manual inputs were used unless live data was available through the API key.", "success");
  } catch (error) {
    if (error.code === "PARSE_INCOMPLETE" && error.details) {
      refs.metrics.innerHTML = [
        createMetricCard(
          "Parse Status",
          "Incomplete",
          `Missing ${error.details.missing.length} required field(s)`
        ),
      ].join("");

      refs.parsedTrade.textContent = JSON.stringify(
        {
          extracted: error.details.extracted,
          missing: error.details.missing,
          guidance: error.details.missing.map((field) => `Please add ${field} to the trade description.`),
        },
        null,
        2
      );

      refs.marketSnapshot.textContent = JSON.stringify(
        {
          parseExample: "Buy 10 AAPL 2026-12-18 220 call",
          supportedFields: ["ticker", "call/put", "strike", "expiry", "quantity", "side"],
          note: "Pricing starts only after ticker, call/put, strike, and expiry are all available.",
        },
        null,
        2
      );
    }
    setStatus(error.message || "An error occurred while pricing the trade.", "error");
  }
}

refs.priceButton.addEventListener("click", evaluateTrade);
window.addEventListener("load", evaluateTrade);
