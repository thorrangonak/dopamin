import MoleculePattern from "./MoleculePattern";
import NeuralPathway from "./NeuralPathway";
import DopaminMoleculeIcon from "../DopaminMoleculeIcon";

export default function BannerSportsRush({ onClick }: { onClick?: () => void }) {
  return (
    <div
      className="relative w-full h-full rounded-xl overflow-hidden cursor-pointer select-none"
      style={{
        background: "linear-gradient(135deg, var(--dp-purple) 0%, oklch(0.5 0.2 260) 60%, var(--dp-blue) 100%)",
      }}
      onClick={onClick}
    >
      <MoleculePattern opacity={0.05} />

      <div className="relative z-10 flex flex-col justify-center h-full px-6 sm:px-10 py-6">
        <div className="flex items-center gap-2 mb-2">
          <DopaminMoleculeIcon size={28} animated />
          <span className="text-white/60 text-xs font-semibold tracking-widest uppercase">
            Spor Bahisleri
          </span>
        </div>

        <h2 className="text-white text-xl sm:text-3xl font-extrabold leading-tight mb-1">
          Dopamin Rush
        </h2>
        <p className="text-white/70 text-xs sm:text-sm max-w-md mb-4">
          70+ spor dalinda en iyi oranlarla bahis yap, adrenalini hisset.
        </p>

        <div>
          <span className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Bahis Yap
            <span aria-hidden="true">&rarr;</span>
          </span>
        </div>
      </div>

      <NeuralPathway color="white" />
    </div>
  );
}
