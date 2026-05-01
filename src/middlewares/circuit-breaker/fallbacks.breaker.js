const fallbackEmptyArray = () => [];

const fallbackCount = () => [{ total: 0 }];

const fallBackZero = () => 0;

const fallbackCritical = (context = "") => {
  const err = new Error("CIRCUIT_OPEN");
  err.context = context;
  throw err;
};

const fallbackNull = () => null;  // ← NUEVO


export const fallBacksBreaker = {
  fallbackEmptyArray,
  fallBackZero,
  fallbackCount,
  fallbackCritical,
  fallbackNull
};