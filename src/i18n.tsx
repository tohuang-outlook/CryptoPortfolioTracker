import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Language = "en" | "zh-TW";
type Variables = Record<string, string | number>;

const LANGUAGE_STORAGE_KEY = "crypto-portfolio-language";

const zhTW: Record<string, string> = {
  Portfolio: "投資組合",
  "Bitcoin Forecast": "比特幣預測",
  "Calm portfolio tracking": "安心追蹤投資組合",
  "Adaptive market intelligence": "自適應市場分析",
  "Crypto Portfolio Tracker": "加密貨幣投資追蹤",
  "Track your crypto portfolio with clarity, confidence, and less stress.": "用清楚、安心的方式掌握你的加密貨幣投資組合。",
  "Understand the BTC trend, tomorrow's estimated close, and how the model learns from its past calls.": "掌握 BTC 趨勢、明日預估收盤價，以及模型如何從過往預測中持續校正。",
  "Switch to Chinese": "切換為中文",
  "Switch to English": "切換為英文",
  "App workspace": "App 工作區",
  Updated: "更新時間：",
  "Showing the last successful update from": "目前顯示上次成功更新時間：",
  "Portfolio summary": "投資組合摘要",
  Closed: "收盤：",
  confidence: "信心分數",
  "Rename profile name": "重新命名投資組合",
  "Save Profile Rename": "儲存名稱",
  Cancel: "取消",
  "Delete this profile and all of its transactions?": "要刪除這個投資組合及所有交易嗎？",
  "Confirm Delete": "確認刪除",
  Rename: "重新命名",
  Delete: "刪除",
  "Profile Name": "投資組合名稱",
  "Create Profile": "建立投資組合",
  "Create New Profile": "建立新的投資組合",
  "Most recent activity": "最近活動",
  "Transaction history": "交易紀錄",
  Save: "儲存",
  Buy: "買入",
  "Confirm deletion?": "確認刪除？",
  entry: "買入價",
  Edit: "編輯",
  "Live prices updated.": "即時價格已更新。",
  "Loading live prices...": "正在載入即時價格...",
  "Checking the latest market prices now.": "正在取得最新市場價格。",
  "Live prices are temporarily unavailable.": "即時價格暫時無法取得。",
  "We will try again automatically in about a minute.": "系統約一分鐘後會自動再試一次。",
  "Waiting for live prices.": "等待即時價格。",
  "Prices will appear here after the first refresh completes.": "完成第一次更新後，價格會顯示於此。",
  "Active portfolio": "目前投資組合",
  "Dashboard waiting": "儀表板等待中",
  "Add your first crypto buy": "新增第一筆加密貨幣買入交易",
  "Start with one transaction and your holdings, allocation, and history will appear automatically.": "新增一筆交易後，持倉、配置與歷史紀錄會自動顯示。",
  "Add transaction": "新增交易",
  Asset: "資產",
  "Amount Invested": "投資金額",
  "Purchase Price": "買入價格",
  "Purchase Shares": "買入數量",
  "Purchase Date": "買入日期",
  Notes: "備註",
  "Estimated Quantity: {quantity} {symbol}": "預估數量：{quantity} {symbol}",
  "Save Transaction": "儲存交易",
  "Current positions": "目前持倉",
  Holdings: "持倉",
  Quantity: "數量",
  Invested: "已投資",
  Value: "目前價值",
  "Portfolio mix": "投資組合配置",
  Allocation: "配置比例",
  "Total invested": "總投資金額",
  "Portfolio value": "投資組合價值",
  "Unrealized P&L": "未實現損益",
  "Total return": "總報酬率",
  "Adaptive daily forecast": "自適應每日預測",
  "A transparent next-day estimate based on BTC daily trend, momentum, volatility, and prior forecast error.": "依據 BTC 每日趨勢、動能、波動率與過往預測誤差產生透明的隔日預估。",
  "24h bias": "24 小時趨勢",
  Bullish: "偏多",
  Bearish: "偏空",
  Neutral: "中性",
  "BTC daily close": "BTC 日收盤價",
  "Next daily close": "預估隔日收盤價",
  "Expected range": "預估區間",
  "Volatility-adjusted": "已依波動率調整",
  Confidence: "信心分數",
  "Model confidence, not certainty": "模型信心，不代表確定性",
  "7-day forecast": "7 日預測",
  "Expected BTC close in one week": "一週後預估 BTC 收盤價",
  "Uses longer trend weighting and a wider volatility range than the next-day estimate.": "使用較長週期的趨勢權重與比隔日預測更寬的波動區間。",
  "7D bias": "7 日趨勢",
  "Projected close": "預估收盤價",
  "What is influencing today's estimate": "影響今日預測的因素",
  "Active signals": "目前訊號",
  "Self-correction record": "自我校正紀錄",
  "Forecast accuracy": "預測準確度",
  "The first forecast is now saved. Once the next daily close arrives, this model will begin measuring and correcting its error.": "第一筆預測已儲存。下一個日收盤價出現後，模型會開始衡量並校正預測誤差。",
  "Settled forecasts": "已結算預測",
  "Average error": "平均誤差",
  "Direction accuracy": "方向準確率",
  "Forecast calibration": "預測校正",
  "Forecast vs actual close": "預測與實際收盤價",
  "This chart will grow once two daily forecasts have settled.": "累積至少兩筆已結算日預測後，圖表會顯示於此。",
  Forecast: "預測",
  Actual: "實際",
  "This is an educational probabilistic forecast, not financial advice. Crypto prices are volatile and the model can be wrong.": "本功能為教育用途的機率預測，不構成投資建議。加密貨幣價格波動大，模型可能出錯。",
  "Preparing the Bitcoin forecast from daily market data...": "正在使用每日市場資料建立比特幣預測...",
  "Coinbase daily market data is unavailable right now. Please try again shortly.": "Coinbase 每日市場資料目前無法取得，請稍後再試。",
  "7D vs 30D trend": "7 日與 30 日趨勢",
  "RSI (14 days)": "RSI（14 日）",
  "MACD momentum": "MACD 動能",
  "Volume confirmation": "成交量確認",
  "Model correction": "模型校正",
  "Ensemble model": "整合模型",
  "Technical signals": "技術訊號",
  "Trend follow": "趨勢追蹤",
  "Mean reversion": "均值回歸",
  "Weights adapt to each model's recent walk-forward accuracy.": "權重會依各模型近期的 walk-forward 回測準確度自動調整。",
  "Walk-forward testing": "Walk-forward 回測",
  "Model leaderboard": "模型排行榜",
  "Recent 60-day forecasts are evaluated without using future closes. Lower error receives more ensemble weight.": "使用近期 60 日、且不使用未來收盤價的預測進行評估。誤差較低的模型會獲得較高整合權重。",
  Model: "模型",
  Weight: "權重",
  "Test days": "測試天數",
  "Short-term price is above its 30-day trend.": "短期價格位於 30 日趨勢之上。",
  "Short-term price is below its 30-day trend.": "短期價格位於 30 日趨勢之下。",
  "Lower RSI supports a possible rebound.": "較低的 RSI 支持可能反彈。",
  "Higher RSI adds pullback risk.": "較高的 RSI 增加回檔風險。",
  "RSI is in a balanced range.": "RSI 位於平衡區間。",
  "Momentum remains above its longer baseline.": "動能仍高於較長週期基準。",
  "Momentum remains below its longer baseline.": "動能仍低於較長週期基準。",
  "Adjusted using the model's settled forecast errors.": "已依模型過去已結算預測的誤差進行調整。",
  "Waiting for settled forecasts before applying an error correction.": "等待預測結算後才會開始進行誤差校正。",
  "Price was mostly unchanged, so volume is not adding directional weight.": "價格變化不大，成交量不會增加方向權重。",
  "Above-average volume confirms the latest upward move.": "高於平均的成交量確認了最新上漲走勢。",
  "Above-average volume confirms the latest downward move.": "高於平均的成交量確認了最新下跌走勢。",
  "Below-average volume lowers confidence in the latest price move.": "低於平均的成交量降低了對最新價格走勢的信心。",
  "Volume is close to its 20-day average and adds little directional weight.": "成交量接近 20 日平均，對方向的影響有限。"
};

const TranslationContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, variables?: Variables) => string;
}>({ language: "en", setLanguage: () => undefined, t: (key) => key });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try { return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "zh-TW" ? "zh-TW" : "en"; }
    catch { return "en"; }
  });

  useEffect(() => {
    document.documentElement.lang = language;
    try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* Keep the in-memory choice. */ }
  }, [language]);

  function t(key: string, variables: Variables = {}) {
    const template = language === "zh-TW" ? (zhTW[key] ?? key) : key;
    return Object.entries(variables).reduce(
      (result, [name, value]) => result.split(`{${name}}`).join(String(value)),
      template
    );
  }

  return <TranslationContext.Provider value={{ language, setLanguage, t }}>{children}</TranslationContext.Provider>;
}

export function useTranslation() { return useContext(TranslationContext); }
