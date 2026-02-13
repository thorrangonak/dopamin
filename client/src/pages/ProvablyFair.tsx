import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, RotateCcw, Copy, CheckCircle2 } from "lucide-react";

type GameType = "coinflip" | "dice" | "roulette" | "plinko" | "crash" | "mines";

export default function ProvablyFair() {
  const { isAuthenticated } = useAuth();

  // Active seed info
  const seedQ = trpc.casino.getActiveSeed.useQuery(undefined, { enabled: isAuthenticated });

  // Client seed change
  const [newClientSeed, setNewClientSeed] = useState("");
  const setClientSeedMut = trpc.casino.setClientSeed.useMutation({
    onSuccess: () => {
      toast.success("Client seed güncellendi");
      seedQ.refetch();
      setNewClientSeed("");
    },
    onError: (err) => toast.error(err.message),
  });

  // Seed rotation
  const [revealedSeed, setRevealedSeed] = useState<any>(null);
  const rotateMut = trpc.casino.rotateSeed.useMutation({
    onSuccess: (data) => {
      setRevealedSeed(data.revealed);
      seedQ.refetch();
      toast.success("Seed rotate edildi — eski seed açıklandı");
    },
    onError: (err) => toast.error(err.message),
  });

  // Verification form
  const [verifyServerSeed, setVerifyServerSeed] = useState("");
  const [verifyClientSeed, setVerifyClientSeed] = useState("");
  const [verifyNonce, setVerifyNonce] = useState("0");
  const [verifyGameType, setVerifyGameType] = useState<GameType>("coinflip");
  const [verifyParams, setVerifyParams] = useState("{}");
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const verifyMut = trpc.casino.verifySeed.useMutation({
    onSuccess: (data) => {
      setVerifyResult(data);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleVerify = () => {
    let params: Record<string, any> = {};
    try {
      params = JSON.parse(verifyParams);
    } catch {
      toast.error("Geçersiz JSON parametreler");
      return;
    }
    verifyMut.mutate({
      serverSeed: verifyServerSeed,
      clientSeed: verifyClientSeed,
      nonce: parseInt(verifyNonce) || 0,
      gameType: verifyGameType,
      params,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Kopyalandı");
  };

  const gameParamHints: Record<GameType, string> = {
    coinflip: '{"choice": "heads"}',
    dice: '{"target": 50}',
    roulette: '{"betType": "red"}',
    plinko: '{"risk": "medium", "rows": 10}',
    crash: '{"cashOutAt": 2}',
    mines: '{"mineCount": 5}',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Provably Fair</h1>
          <p className="text-sm text-zinc-400">Tüm oyun sonuçları bağımsız olarak doğrulanabilir</p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 md:p-6">
        <h2 className="text-sm font-semibold text-white mb-3">Nasıl Çalışır?</h2>
        <div className="space-y-2 text-xs text-zinc-400">
          <p>Her oyun sonucu aşağıdaki formülle hesaplanır:</p>
          <div className="bg-zinc-900 rounded-lg p-3 font-mono text-green-400 text-[11px]">
            HMAC = HMAC-SHA256(serverSeed, clientSeed + ":" + nonce)
          </div>
          <ul className="space-y-1 mt-2">
            <li>• <span className="text-white">Server Seed:</span> Sunucu tarafından oluşturulur, hash'i önceden gösterilir</li>
            <li>• <span className="text-white">Client Seed:</span> Siz belirleyebilirsiniz, istediğiniz zaman değiştirin</li>
            <li>• <span className="text-white">Nonce:</span> Her oyunda +1 artar</li>
            <li>• Seed'i rotate ettiğinizde eski server seed açıklanır — geçmiş sonuçları doğrulayabilirsiniz</li>
          </ul>
        </div>
      </div>

      {isAuthenticated && (
        <>
          {/* Active Seed */}
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 md:p-6">
            <h2 className="text-sm font-semibold text-white mb-3">Aktif Seed Bilgileri</h2>
            {seedQ.data ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-500">Server Seed Hash (SHA-256)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 text-[11px] text-green-400 bg-zinc-900 rounded px-3 py-2 break-all">
                      {seedQ.data.serverSeedHash}
                    </code>
                    <button onClick={() => copyToClipboard(seedQ.data!.serverSeedHash)} className="text-zinc-500 hover:text-white">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-500">Client Seed</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 text-[11px] text-yellow-400 bg-zinc-900 rounded px-3 py-2 break-all">
                      {seedQ.data.clientSeed}
                    </code>
                    <button onClick={() => copyToClipboard(seedQ.data!.clientSeed)} className="text-zinc-500 hover:text-white">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-500">Nonce (toplam oyun sayısı)</label>
                  <p className="text-sm text-white font-mono mt-1">{seedQ.data.nonce}</p>
                </div>

                {/* Change Client Seed */}
                <div className="border-t border-zinc-700 pt-3">
                  <label className="text-xs text-zinc-500 mb-1 block">Client Seed Değiştir</label>
                  <div className="flex gap-2">
                    <Input
                      value={newClientSeed}
                      onChange={(e) => setNewClientSeed(e.target.value)}
                      placeholder="Yeni client seed..."
                      className="bg-zinc-900 border-zinc-700 text-white text-sm"
                    />
                    <Button
                      onClick={() => setClientSeedMut.mutate({ clientSeed: newClientSeed })}
                      disabled={!newClientSeed || setClientSeedMut.isPending}
                      size="sm"
                      className="bg-yellow-500 hover:bg-yellow-600 text-black"
                    >
                      Kaydet
                    </Button>
                  </div>
                </div>

                {/* Rotate Seed */}
                <div className="border-t border-zinc-700 pt-3">
                  <Button
                    onClick={() => rotateMut.mutate()}
                    disabled={rotateMut.isPending}
                    variant="outline"
                    className="border-zinc-600 text-zinc-300"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {rotateMut.isPending ? "Rotate Ediliyor..." : "Seed'i Rotate Et (Eski seed'i aç)"}
                  </Button>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Bu işlem eski server seed'inizi açıklar. Geçmiş oyunları doğrulamak için kullanın.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Yükleniyor...</p>
            )}
          </div>

          {/* Revealed Seed */}
          {revealedSeed && (
            <div className="bg-green-500/5 border border-green-500/30 rounded-xl p-4 md:p-6">
              <h2 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Açıklanan Seed
              </h2>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-zinc-500">Server Seed</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 text-[11px] text-green-400 bg-zinc-900 rounded px-3 py-2 break-all">
                      {revealedSeed.serverSeed}
                    </code>
                    <button onClick={() => copyToClipboard(revealedSeed.serverSeed)} className="text-zinc-500 hover:text-white">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-500">Server Seed Hash</label>
                  <code className="block text-[11px] text-zinc-400 bg-zinc-900 rounded px-3 py-2 break-all mt-1">
                    {revealedSeed.serverSeedHash}
                  </code>
                </div>
                <div>
                  <label className="text-xs text-zinc-500">Client Seed</label>
                  <code className="block text-[11px] text-yellow-400 bg-zinc-900 rounded px-3 py-2 break-all mt-1">
                    {revealedSeed.clientSeed}
                  </code>
                </div>
                <div>
                  <label className="text-xs text-zinc-500">Toplam Oyun (Nonce)</label>
                  <p className="text-sm text-white font-mono mt-1">{revealedSeed.nonce}</p>
                </div>
                <p className="text-[10px] text-zinc-500">
                  Bu seed ile oynanan tüm oyunları aşağıdaki doğrulama formu ile kontrol edebilirsiniz.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Verification Form */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 md:p-6">
        <h2 className="text-sm font-semibold text-white mb-3">Sonuç Doğrulama</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Server Seed</label>
            <Input
              value={verifyServerSeed}
              onChange={(e) => setVerifyServerSeed(e.target.value)}
              placeholder="Rotate edilmiş server seed..."
              className="bg-zinc-900 border-zinc-700 text-white text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Client Seed</label>
            <Input
              value={verifyClientSeed}
              onChange={(e) => setVerifyClientSeed(e.target.value)}
              placeholder="Client seed..."
              className="bg-zinc-900 border-zinc-700 text-white text-sm font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Nonce</label>
              <Input
                type="number"
                value={verifyNonce}
                onChange={(e) => setVerifyNonce(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-white text-sm"
                min={0}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Oyun Türü</label>
              <select
                value={verifyGameType}
                onChange={(e) => {
                  const gt = e.target.value as GameType;
                  setVerifyGameType(gt);
                  setVerifyParams(gameParamHints[gt]);
                }}
                className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-md px-3 py-2"
              >
                <option value="coinflip">Coin Flip</option>
                <option value="dice">Dice</option>
                <option value="roulette">Roulette</option>
                <option value="plinko">Plinko</option>
                <option value="crash">Crash</option>
                <option value="mines">Mines</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Oyun Parametreleri (JSON)</label>
            <Input
              value={verifyParams}
              onChange={(e) => setVerifyParams(e.target.value)}
              placeholder={gameParamHints[verifyGameType]}
              className="bg-zinc-900 border-zinc-700 text-white text-sm font-mono"
            />
          </div>

          <Button
            onClick={handleVerify}
            disabled={!verifyServerSeed || !verifyClientSeed || verifyMut.isPending}
            className="w-full bg-green-500 hover:bg-green-600 text-black font-bold"
          >
            <Shield className="w-4 h-4 mr-2" />
            {verifyMut.isPending ? "Hesaplanıyor..." : "Doğrula"}
          </Button>
        </div>

        {/* Verification Result */}
        {verifyResult && (
          <div className="mt-4 p-4 bg-zinc-900 rounded-lg space-y-2">
            <h3 className="text-sm font-semibold text-green-400">Sonuç</h3>
            <div>
              <label className="text-xs text-zinc-500">HMAC</label>
              <code className="block text-[11px] text-cyan-400 bg-zinc-800 rounded px-3 py-2 break-all mt-1">
                {verifyResult.hmac}
              </code>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Server Seed Hash</label>
              <code className="block text-[11px] text-zinc-400 bg-zinc-800 rounded px-3 py-2 break-all mt-1">
                {verifyResult.serverSeedHash}
              </code>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Oyun Sonucu</label>
              <div className="bg-zinc-800 rounded p-3 mt-1">
                <p className="text-sm text-white">Çarpan: <span className="text-green-400 font-bold">{verifyResult.result.multiplier}x</span></p>
                <pre className="text-[11px] text-zinc-400 mt-2 whitespace-pre-wrap">
                  {JSON.stringify(verifyResult.result.details, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
