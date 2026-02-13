import MoleculePattern from "./MoleculePattern";
import NeuralPathway from "./NeuralPathway";
import DopaminMoleculeIcon from "../DopaminMoleculeIcon";

export default function BannerWelcomeBonus({ onClick }: { onClick?: () => void }) {
  return (
    <div
      className="relative w-full h-full rounded-xl overflow-hidden cursor-pointer select-none"
      style={{
        background: "linear-gradient(135deg, oklch(0.45 0.28 300) 0%, oklch(0.5 0.26 330) 50%, oklch(0.55 0.24 350) 100%)",
      }}
      onClick={onClick}
    >
      <MoleculePattern opacity={0.06} />

      <div className="relative z-10 flex flex-col justify-center h-full px-6 sm:px-10 py-6">
        <div className="flex items-center gap-2 mb-2">
          <DopaminMoleculeIcon size={28} animated />
          <span className="text-white/60 text-xs font-semibold tracking-widest uppercase">
            Bonus
          </span>
        </div>

        <h2 className="text-white text-xl sm:text-3xl font-extrabold leading-tight mb-1">
          Hos Geldin Bonusu
        </h2>
        <p className="text-white/70 text-xs sm:text-sm max-w-md mb-4">
          Ilk yatirimina %100 bonus — 1000 TL'ye kadar ekstra kazanc!
        </p>

        <div>
          <span className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Hemen Yatir
            <span aria-hidden="true">&rarr;</span>
          </span>
        </div>
      </div>

      <NeuralPathway color="white" />
    </div>
  );
}
