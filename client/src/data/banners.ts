import type { BannerSlide } from "@/components/BannerCarousel";
import BannerSportsRush from "@/components/banners/BannerSportsRush";
import BannerCasinoBoost from "@/components/banners/BannerCasinoBoost";
import BannerWelcomeBonus from "@/components/banners/BannerWelcomeBonus";
import BannerVipClub from "@/components/banners/BannerVipClub";

export const SPORTS_BANNERS: BannerSlide[] = [
  {
    id: "sports-rush",
    imageUrl: "",
    ctaLink: "/sports",
    component: BannerSportsRush,
  },
  {
    id: "welcome-bonus",
    imageUrl: "",
    ctaLink: "/wallet",
    component: BannerWelcomeBonus,
  },
  {
    id: "vip-club",
    imageUrl: "",
    ctaLink: "/vip",
    component: BannerVipClub,
  },
];

export const CASINO_BANNERS: BannerSlide[] = [
  {
    id: "casino-boost",
    imageUrl: "",
    ctaLink: "/casino",
    component: BannerCasinoBoost,
  },
  {
    id: "welcome-bonus-casino",
    imageUrl: "",
    ctaLink: "/wallet",
    component: BannerWelcomeBonus,
  },
  {
    id: "vip-club-casino",
    imageUrl: "",
    ctaLink: "/vip",
    component: BannerVipClub,
  },
];
