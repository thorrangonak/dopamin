import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface BetSelection {
  eventId: string;
  sportKey: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  marketKey: string;
  outcomeName: string;
  outcomePrice: number;
  point?: number;
}

interface BetSlipContextType {
  selections: BetSelection[];
  addSelection: (sel: BetSelection) => void;
  removeSelection: (eventId: string, marketKey: string, outcomeName: string) => void;
  clearSelections: () => void;
  isSelected: (eventId: string, marketKey: string, outcomeName: string) => boolean;
  totalOdds: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const BetSlipContext = createContext<BetSlipContextType | null>(null);

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<BetSelection[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const addSelection = useCallback((sel: BetSelection) => {
    setSelections(prev => {
      // Remove existing selection for same event+market
      const filtered = prev.filter(
        s => !(s.eventId === sel.eventId && s.marketKey === sel.marketKey)
      );
      return [...filtered, sel];
    });
    setIsOpen(true);
  }, []);

  const removeSelection = useCallback((eventId: string, marketKey: string, outcomeName: string) => {
    setSelections(prev =>
      prev.filter(s => !(s.eventId === eventId && s.marketKey === marketKey && s.outcomeName === outcomeName))
    );
  }, []);

  const clearSelections = useCallback(() => {
    setSelections([]);
  }, []);

  const isSelected = useCallback((eventId: string, marketKey: string, outcomeName: string) => {
    return selections.some(s => s.eventId === eventId && s.marketKey === marketKey && s.outcomeName === outcomeName);
  }, [selections]);

  const totalOdds = selections.reduce((acc, s) => acc * s.outcomePrice, 1);

  return (
    <BetSlipContext.Provider value={{ selections, addSelection, removeSelection, clearSelections, isSelected, totalOdds, isOpen, setIsOpen }}>
      {children}
    </BetSlipContext.Provider>
  );
}

export function useBetSlip() {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error("useBetSlip must be used within BetSlipProvider");
  return ctx;
}
