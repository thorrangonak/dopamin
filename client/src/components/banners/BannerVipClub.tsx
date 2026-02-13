import MoleculePattern from "./MoleculePattern";
import NeuralPathway from "./NeuralPathway";
import DopaminMoleculeIcon from "../DopaminMoleculeIcon";

export default function BannerVipClub({ onClick }: { onClick?: () => void }) {
  return (
    <div
      className="relative w-full h-full rounded-xl overflow-hidden cursor-pointer select-none"
      style={{
        background: "linear-gradient(135deg, oklch(0.2 0.12 280) 0%, oklch(0.25 0.15 260) 50%, oklch(0.18 0.1 240) 100%)",
      }}
      onClick={onClick}
    >
      <MoleculePattern opacity={0.04} />

      <div className="relative z-10 flex flex-col justify-center h-full px-6 sm:px-10 py-6">
        <div className="flex items-center gap-2 mb-2">
          <DopaminMoleculeIcon size={28} animated />
          <span className="text-white/40 text-xs font-semibold tracking-widest uppercase">
            VIP
          </span>
        </div>

        <h2 className="text-white text-xl sm:text-3xl font-extrabold leading-tight mb-1">
          Endorphin Elite
        </h2>
        <p className="text-white/50 text-xs sm:text-sm max-w-md mb-4">
          Ozel oduller, kisisel hesap yoneticisi ve sinir tanimayan ayricaliklar.
        </p>

        <div>
          <span className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-lg transition-colors border border-white/10">
            Kulube Katil
            <span aria-hidden="true">&rarr;</span>
          </span>
        </div>
      </div>

      <NeuralPathway color="rgba(255,255,255,0.6)" />
    </div>
  );
}
