import { useState, useEffect, useCallback, useRef, type ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

export interface BannerSlide {
  id: string;
  imageUrl: string;
  ctaLink: string;
  /** Optional component-based banner. When provided, renders the component instead of imageUrl. */
  component?: ComponentType<{ onClick?: () => void }>;
}

interface BannerCarouselProps {
  slides: BannerSlide[];
  autoPlayInterval?: number;
  className?: string;
}

export default function BannerCarousel({
  slides,
  autoPlayInterval = 5000,
  className = "",
}: BannerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [, setLocation] = useLocation();
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const slideCount = slides.length;

  const goToSlide = useCallback(
    (index: number) => {
      setDirection(index > currentIndex ? 1 : -1);
      setCurrentIndex(index);
    },
    [currentIndex]
  );

  const goNext = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % slideCount);
  }, [slideCount]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + slideCount) % slideCount);
  }, [slideCount]);

  // Auto-play
  useEffect(() => {
    if (isPaused || slideCount <= 1) return;
    const timer = setInterval(goNext, autoPlayInterval);
    return () => clearInterval(timer);
  }, [isPaused, goNext, autoPlayInterval, slideCount]);

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    if (diff > threshold) goNext();
    else if (diff < -threshold) goPrev();
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (slides.length === 0) return null;

  const currentSlide = slides[currentIndex];
  const BannerComponent = currentSlide.component;

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? "-100%" : "100%",
      opacity: 0,
    }),
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl group ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slide container */}
      <div className="relative w-full aspect-[2.5/1] sm:aspect-[3/1] md:aspect-[3.5/1]">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentSlide.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="absolute inset-0 cursor-pointer"
            onClick={!BannerComponent ? () => setLocation(currentSlide.ctaLink) : undefined}
          >
            {BannerComponent ? (
              <BannerComponent onClick={() => setLocation(currentSlide.ctaLink)} />
            ) : (
              <img
                src={currentSlide.imageUrl}
                alt=""
                className="w-full h-full object-cover rounded-xl"
                loading="eager"
                draggable={false}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation arrows - visible on hover */}
      {slideCount > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
            aria-label="Önceki"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
            aria-label="Sonraki"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {slideCount > 1 && (
        <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                goToSlide(idx);
              }}
              className={`transition-all duration-300 rounded-full ${
                idx === currentIndex
                  ? "w-6 h-2 bg-primary"
                  : "w-2 h-2 bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Progress bar */}
      {slideCount > 1 && !isPaused && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 rounded-b-xl overflow-hidden">
          <motion.div
            key={currentIndex}
            className="h-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: autoPlayInterval / 1000, ease: "linear" }}
          />
        </div>
      )}
    </div>
  );
}
