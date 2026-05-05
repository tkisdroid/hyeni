// src/components/childMode/ChildPairInput.jsx
// 자녀 첫 페어링 화면 — KID-XXXXXXXX 코드 직접 입력 + QR 스캐너 fallback.
// Bundles QrPairScanner (BarcodeDetector based camera scanner) for self-containment.
// Extracted from App.jsx (Phase 5 #4 / B18).

import { useEffect, useRef, useState } from "react";
import { joinFamily } from "../../lib/auth.js";
import { normalizePairCodeInput } from "../../lib/pairCode.js";
import { DESIGN, FF, makePrimaryButtonStyle, makeSecondaryButtonStyle } from "../../lib/styleHelpers.js";
import { AppBrandLogo } from "../auth/AppBrandLogo.jsx";

function QrPairScanner({ onDetected, onClose }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const frameRef = useRef(0);
    const detectorRef = useRef(null);
    const handledRef = useRef(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const stopScanner = () => {
            handledRef.current = true;
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = 0;
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
        };

        const scanFrame = async () => {
            if (!active || handledRef.current || !videoRef.current || !detectorRef.current) return;
            try {
                const codes = await detectorRef.current.detect(videoRef.current);
                const rawValue = codes.find((code) => typeof code.rawValue === "string")?.rawValue;
                if (rawValue) {
                    handledRef.current = true;
                    await onDetected(rawValue);
                    stopScanner();
                    return;
                }
            } catch {
                // ignore intermittent detector failures
            }
            frameRef.current = requestAnimationFrame(scanFrame);
        };

        const startScanner = async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                setError("이 기기에서는 카메라를 사용할 수 없어요. 코드를 직접 입력해 주세요.");
                setLoading(false);
                return;
            }

            if (typeof window.BarcodeDetector !== "function") {
                setError("이 기기에서는 QR 스캔을 지원하지 않아요. 코드를 직접 입력해 주세요.");
                setLoading(false);
                return;
            }

            try {
                detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: "environment" },
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                });
                if (!active) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => {});
                }
                setLoading(false);
                frameRef.current = requestAnimationFrame(scanFrame);
            } catch (scannerError) {
                console.error("[qr-scan] start failed:", scannerError);
                setError("카메라를 열 수 없어요. 권한을 확인한 뒤 다시 시도해 주세요.");
                setLoading(false);
            }
        };

        startScanner();

        return () => {
            active = false;
            stopScanner();
        };
    }, [onDetected]);

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 650, background: "rgba(15,23,42,0.92)", display: "flex", flexDirection: "column", fontFamily: FF }}>
            <div style={{ padding: "16px 20px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)", display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 12, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 14, color: "white", fontFamily: FF }}>← 닫기</button>
                <div style={{ fontWeight: 800, fontSize: 16, color: "white" }}>📷 QR 코드 스캔</div>
            </div>
            <div style={{ flex: 1, padding: "20px 20px 28px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 18 }}>
                <div style={{ width: "100%", maxWidth: 360, aspectRatio: "3 / 4", borderRadius: 28, overflow: "hidden", background: "#0F172A", position: "relative", boxShadow: "0 24px 60px rgba(0,0,0,0.32)" }}>
                    <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", inset: 0, border: "2px solid rgba(255,255,255,0.08)" }} />
                    <div style={{ position: "absolute", inset: "18% 12%", borderRadius: 24, border: "3px solid rgba(255,255,255,0.92)", boxShadow: "0 0 0 999px rgba(15,23,42,0.35)" }} />
                    {loading && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.72)", color: "white", fontWeight: 700 }}>
                            카메라 준비 중...
                        </div>
                    )}
                </div>
                <div style={{ maxWidth: 340, textAlign: "center", color: "white" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>부모님 화면의 QR 코드를 비춰 주세요</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.8)" }}>
                        QR을 인식하면 코드 입력 없이 바로 연동을 시작해요
                    </div>
                    {error && <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: "var(--status-cautionary-strong)" }}>{error}</div>}
                </div>
            </div>
        </div>
    );
}

export function ChildPairInput({ userId, onPaired }) {
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    // "" → idle, "connecting" → joinFamily RPC in flight, "loading" → RPC succeeded,
    // onPaired (getMyFamily + setFamilyInfo + permission prompt) still resolving.
    const [phase, setPhase] = useState("");
    const [error, setError] = useState("");
    const [showScanner, setShowScanner] = useState(false);

    const handleJoin = async (rawCode = code, source = "manual") => {
        const raw = String(rawCode || "").trim();
        const fullCode = normalizePairCodeInput(raw) || normalizePairCodeInput(`KID-${raw}`);
        if (!fullCode) {
            setError(source === "scan" ? "유효한 QR 코드를 찾지 못했어요" : "코드를 정확히 입력해 주세요");
            return false;
        }

        setCode(fullCode.replace("KID-", ""));
        setBusy(true); setError(""); setPhase("connecting");
        try {
            const result = await joinFamily(fullCode, userId, "아이");
            console.log("[ChildPairInput] joinFamily result:", result);
            // Show success screen IMMEDIATELY so the user knows the code worked,
            // even if onPaired (getMyFamily + permission prompt) takes a few seconds.
            setPhase("loading");
            await onPaired();
            return true;
        } catch (err) {
            console.error("[ChildPairInput] error:", err);
            setPhase("");
            if (err?.message?.includes("프리미엄")) {
                setError(err.message);
            } else if (err?.message?.includes("만료된 연동 코드")) {
                setError("만료된 연동 코드예요. 부모님께 새 코드를 받아 주세요");
            } else {
                setError(err.message?.includes("Too many") ? "시도 횟수 초과. 1시간 후 다시 시도해 주세요" : "잘못된 코드예요. 부모님께 확인해 주세요");
            }
            return false;
        } finally { setBusy(false); }
    };

    if (phase === "loading") {
        return (
            <div className="hyeni-app-shell" style={{ position: "fixed", inset: 0, zIndex: 500, background: DESIGN.gradients.shell, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FF, textAlign: "center" }}>
                <div style={{ fontSize: 64, marginBottom: 18 }}>🎉</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "var(--theme-accent-text)", marginBottom: 10 }}>연결됐어요!</div>
                <div style={{ fontSize: 14, color: "var(--fg-secondary)", lineHeight: 1.55 }}>
                    가족 정보를 불러오는 중이에요...<br />위치 권한을 묻는 창이 뜨면 허용해 주세요.
                </div>
            </div>
        );
    }

    return (
        <div className="hyeni-app-shell" style={{ position: "fixed", inset: 0, zIndex: 500, background: DESIGN.gradients.shell, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FF }}>
            <AppBrandLogo size={78} radius={24} />
            <div style={{ fontSize: 24, fontWeight: 900, color: "var(--theme-accent-text)", marginTop: 16, marginBottom: 8 }}>부모님과 연결하기</div>
            <div style={{ fontSize: 14, color: "var(--fg-secondary)", marginBottom: 28, textAlign: "center", lineHeight: 1.6 }}>부모님 앱에 있는<br />연동 코드에서 KID- 뒤의 코드를 입력해 주세요</div>
            <div style={{ position: "relative", width: "100%", maxWidth: 320, marginBottom: 8 }}>
                <div style={{ position: "absolute", left: 16, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 20, fontFamily: "monospace", fontWeight: 700, color: "var(--theme-accent-text)", pointerEvents: "none", zIndex: 1 }}>KID-</div>
                <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                    placeholder="XXXXXXXX" maxLength={8}
                    style={{ width: "100%", padding: "16px 16px 16px 76px", border: "2px solid var(--theme-accent-line)", borderRadius: 20, fontSize: 20, fontFamily: "monospace", outline: "none", boxSizing: "border-box", letterSpacing: 3, fontWeight: 700, color: "var(--fg-primary)", background: "white", boxShadow: "var(--hyeni-theme-shadow-soft)" }} />
            </div>
            {error && <div style={{ fontSize: 13, color: "var(--status-cautionary-strong)", fontWeight: 700, marginBottom: 8 }}>{error}</div>}
            <button onClick={() => { void handleJoin(); }} disabled={busy}
                style={{ ...makePrimaryButtonStyle({ maxWidth: 320, padding: "16px", fontSize: 16, marginTop: 8, opacity: busy ? 0.7 : 1 }), cursor: busy ? "wait" : "pointer" }}>
                {busy ? "연결 중..." : "🔗 연결하기"}
            </button>
            <button
                type="button"
                onClick={() => { if (!busy) setShowScanner(true); }}
                disabled={busy}
                style={{ ...makeSecondaryButtonStyle({ maxWidth: 320, padding: "14px", color: "var(--theme-accent-text)", border: "1.5px solid var(--theme-accent-line)", background: "var(--theme-accent-soft)", fontSize: 15, marginTop: 10 }), cursor: busy ? "wait" : "pointer" }}
            >
                📷 QR로 연결하기
            </button>
            {showScanner && (
                <QrPairScanner
                    onClose={() => setShowScanner(false)}
                    onDetected={async (rawValue) => {
                        const joined = await handleJoin(rawValue, "scan");
                        if (joined) setShowScanner(false);
                    }}
                />
            )}
        </div>
    );
}
