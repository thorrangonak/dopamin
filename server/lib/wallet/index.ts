// ─── Network Configuration & Types ───

export type NetworkId = "tron" | "ethereum" | "bsc" | "polygon" | "solana" | "bitcoin";

export interface NetworkConfig {
  id: NetworkId;
  name: string;
  symbol: string;
  token: string;
  coinType: number;
  confirmations: number;
  rpcUrl: string;
  explorerUrl: string;
  minDeposit: number;
  withdrawalFee: number;
  usdtContract?: string;
  icon: string;
  color: string;
  bg: string;
  recommended?: boolean;
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  tron: {
    id: "tron",
    name: "TRON",
    symbol: "TRX",
    token: "USDT TRC-20",
    coinType: 195,
    confirmations: 20,
    rpcUrl: process.env.TRON_FULL_NODE || "https://nile.trongrid.io",
    explorerUrl: "https://nile.tronscan.org",
    minDeposit: 1,
    withdrawalFee: 1,
    usdtContract: process.env.TRON_USDT_CONTRACT || "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj",
    icon: "₮",
    color: "text-red-500",
    bg: "bg-red-500/10",
    recommended: true,
  },
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    token: "USDT ERC-20",
    coinType: 60,
    confirmations: 12,
    rpcUrl: process.env.ETH_RPC_URL || "https://sepolia.infura.io/v3/demo",
    explorerUrl: "https://sepolia.etherscan.io",
    minDeposit: 10,
    withdrawalFee: 5,
    usdtContract: process.env.ETH_USDT_CONTRACT || "",
    icon: "Ξ",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  bsc: {
    id: "bsc",
    name: "BSC",
    symbol: "BNB",
    token: "USDT BEP-20",
    coinType: 60,
    confirmations: 15,
    rpcUrl: process.env.BSC_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    explorerUrl: "https://testnet.bscscan.com",
    minDeposit: 1,
    withdrawalFee: 0.5,
    usdtContract: process.env.BSC_USDT_CONTRACT || "",
    icon: "◆",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  polygon: {
    id: "polygon",
    name: "Polygon",
    symbol: "MATIC",
    token: "USDT",
    coinType: 60,
    confirmations: 128,
    rpcUrl: process.env.POLYGON_RPC_URL || "https://rpc-amoy.polygon.technology",
    explorerUrl: "https://amoy.polygonscan.com",
    minDeposit: 1,
    withdrawalFee: 0.5,
    usdtContract: process.env.POLYGON_USDT_CONTRACT || "",
    icon: "⬡",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  solana: {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    token: "USDT SPL",
    coinType: 501,
    confirmations: 32,
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    explorerUrl: "https://explorer.solana.com/?cluster=devnet",
    minDeposit: 1,
    withdrawalFee: 0.5,
    usdtContract: process.env.SOLANA_USDT_MINT || "",
    icon: "◎",
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  bitcoin: {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    token: "BTC",
    coinType: 0,
    confirmations: 6,
    rpcUrl: "",
    explorerUrl: "https://blockstream.info/testnet",
    minDeposit: 0.0001,
    withdrawalFee: 0.0001,
    icon: "₿",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
};

export const NETWORK_IDS = Object.keys(NETWORKS) as NetworkId[];

export function getAutoApproveLimit(): number {
  return parseFloat(process.env.AUTO_APPROVE_LIMIT || "100");
}

export const WITHDRAWAL_LIMITS = {
  perTransaction: 5000,  // Max single withdrawal (USDT)
  dailyTotal: 10000,     // Max daily total (USDT)
};
