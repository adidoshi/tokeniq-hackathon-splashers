"""Technical indicators in plain pandas, so every number can be explained to judges.

All functions are causal (only use past data) -> safe to precompute for backtests.
Wilder smoothing (used by ATR/ADX/RSI) == EMA with alpha = 1/period.
"""
import pandas as pd


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def sma(series: pd.Series, period: int) -> pd.Series:
    """Simple Moving Average (rolling arithmetic mean)."""
    return series.rolling(window=period).mean()


def _wilder(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(alpha=1 / period, adjust=False).mean()


def true_range(df: pd.DataFrame) -> pd.Series:
    prev_close = df["close"].shift(1)
    return pd.concat([df["high"] - df["low"],
                      (df["high"] - prev_close).abs(),
                      (df["low"] - prev_close).abs()], axis=1).max(axis=1)


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Average True Range: typical candle size in price units -> used for stops & sizing."""
    return _wilder(true_range(df), period)


def adx(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Average Directional Index: trend *strength* 0-100 (not direction). >20-25 = trending."""
    up = df["high"].diff()
    down = -df["low"].diff()
    plus_dm = up.where((up > down) & (up > 0), 0.0)
    minus_dm = down.where((down > up) & (down > 0), 0.0)
    tr = _wilder(true_range(df), period)
    plus_di = 100 * _wilder(plus_dm, period) / tr
    minus_di = 100 * _wilder(minus_dm, period) / tr
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, float("nan"))
    return _wilder(dx.fillna(0), period)


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = _wilder(delta.clip(lower=0), period)
    loss = _wilder(-delta.clip(upper=0), period)
    rs = gain / loss.replace(0, float("nan"))
    return (100 - 100 / (1 + rs)).fillna(100)


def stochastic(df: pd.DataFrame, k_period: int = 14, d_period: int = 3, smooth_k: int = 3) -> tuple[pd.Series, pd.Series]:
    """Stochastic Oscillator (%K, %D).

    %K = (Close - Lowest Low(k)) / (Highest High(k) - Lowest Low(k)) * 100
    %D = d_period SMA of %K
    """
    low_min = df["low"].rolling(window=k_period).min()
    high_max = df["high"].rolling(window=k_period).max()
    denom = (high_max - low_min).replace(0, float("nan"))
    raw_k = 100 * (df["close"] - low_min) / denom
    fast_k = raw_k.fillna(50.0)
    k = fast_k.rolling(window=smooth_k).mean().fillna(fast_k) if smooth_k > 1 else fast_k
    d = k.rolling(window=d_period).mean().fillna(k)
    return k.round(2), d.round(2)


def candles_to_df(rows: list[dict]) -> pd.DataFrame:
    """Delta candle dicts -> DataFrame indexed by UTC time, oldest first."""
    if not rows:
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
    df = pd.DataFrame(rows)
    if "time" not in df.columns:
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
    df["time"] = pd.to_datetime(df["time"], unit="s", utc=True)
    df = df.set_index("time").sort_index()
    return df[["open", "high", "low", "close", "volume"]].astype(float)
