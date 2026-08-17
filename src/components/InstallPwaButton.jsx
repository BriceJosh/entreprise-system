import { useState, useEffect } from "react";

export default function InstallPwaButton({
  role = "user",
  mobileOnly = false,
  className = "",
}) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  });
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isIOS] = useState(() => {
    if (typeof window === "undefined") return false;
    return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowGuideModal(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowGuideModal(true);
    }
  };

  if (isInstalled) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 ${className}`}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span>Application installée</span>
      </div>
    );
  }

  const isDirector = role === "directeur";

  return (
    <>
      <button
        onClick={handleInstallClick}
        type="button"
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer ${
          isDirector
            ? "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white border border-emerald-500/20"
            : "bg-emerald-600 hover:bg-emerald-700 text-white"
        } ${className}`}
        title={
          mobileOnly
            ? "Installer la version Mobile sur votre téléphone"
            : "Installer l'application sur le bureau"
        }
      >
        {mobileOnly ? (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 18h.01M8 21h8a2 2 0 002-2V3a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 002 2z"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        )}
        <span>
          {mobileOnly
            ? "Télécharger Version Mobile"
            : isDirector
              ? "Installer l'Application (Bureau & Mobile)"
              : "Télécharger sur le Bureau"}
        </span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left border border-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-800 flex items-center gap-2">
                <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  📱
                </span>
                Guide d'installation de l'App
              </h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-gray-600 space-y-3 leading-relaxed">
              <p className="font-semibold text-gray-800">
                Vous pouvez installer l'application directement sur votre Bureau
                (PC/Mac) ou Téléphone (Android/iPhone) :
              </p>

              {isIOS ? (
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-emerald-900 space-y-1">
                  <p className="font-bold">Sur iPhone / iPad (Safari) :</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      Appuyez sur le bouton <strong>Partager</strong> (
                      <span className="text-base">⎋</span> ou <span>⤓</span>) en
                      bas.
                    </li>
                    <li>
                      Faites défiler vers le bas et sélectionnez{" "}
                      <strong>Sur l'écran d'accueil</strong>.
                    </li>
                    <li>
                      Cliquez sur <strong>Ajouter</strong> en haut à droite.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-800 space-y-1">
                  <p className="font-bold">
                    Sur Ordinateur (Chrome, Edge, Brave) :
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      Cliquez sur l'icône d'installation{" "}
                      <strong>(🖥️ ou ⊕)</strong> située à droite dans la barre
                      d'adresse de votre navigateur.
                    </li>
                    <li>
                      Ou ouvrez le menu <strong>(⋮)</strong> &gt;{" "}
                      <strong>Enregistrer et partager</strong> &gt;{" "}
                      <strong>Installer Entreprise System</strong>.
                    </li>
                  </ul>

                  <p className="font-bold mt-2">Sur Android (Chrome) :</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      Ouvrez le menu <strong>(⋮)</strong> en haut à droite.
                    </li>
                    <li>
                      Appuyez sur <strong>Installer l'application</strong> ou{" "}
                      <strong>Ajouter à l'écran d'accueil</strong>.
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowGuideModal(false)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase"
              >
                J'ai compris
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
