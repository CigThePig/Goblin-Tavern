export {
  stockModule,
  stockRegistry,
  ensureRequiredStockRegistered,
  effectiveQuality,
  isPerishable,
  addCoin,
  spendCoin,
  getDailyProfitLoss,
  sellStockItem,
  consumeStockItem,
  restockItem,
  wasteStockItem,
  getStockModuleState,
  createInitialStockModuleState,
} from './stockModule'

export type {
  StockDefinition,
  StockDefaultState,
  CoinLedgerEntry,
  CoinLedgerCategory,
  ShortageRecord,
  StockModuleState,
} from './types'

export type {
  SellResult,
  SellOptions,
  ConsumeResult,
  WasteResult,
} from './sales'
