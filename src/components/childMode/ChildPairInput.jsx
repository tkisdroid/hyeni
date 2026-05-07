// src/components/childMode/ChildPairInput.jsx
// 자녀 첫 페어링 화면 — KID-XXXXXXXX 코드 직접 입력 + QR 스캐너 fallback.
// Bundles QrPairScanner (BarcodeDetector based camera scanner) for self-containment.
// 2026-05-07 cartoon DS migration: 외곽/입력/버튼만 hy-* 클래스로 교체. QR scanner UI 는 dark 그대로 보존.

import { useEffect, useRef, useState } from "react";
import { joinFamily } from "../../lib/auth.js";
import { normalizePairCodeInput } from "../../lib/pairCode.js";
import { AppBrandLogo } from "../auth/AppBrandLogo.jsx";

const QR_CAMERA_PERMISSION_MESSAGE = "카메라 권한이 필요해요. 권한을 허용한 뒤 다시 시도해 주세요.";

async function getNativeCameraPermissionPlugin() {
    if (typeof window === "undefined") return null;
    try {
        const { Capacitor, registerPlugin } = await import("@capacitor/core");
        const isNative = typeof Capacitor?.isNativePlatform === "function"
            ? Capacitor.isNativePlatform()
            : !!window.Capacitor?.isNativePlatform?.();
        if (!isNative || typeof registerPlugin !== "function") return null;
        return registerPlugin("CameraPermission");
    } catch (err) {
        console.warn("[qr-scan] native camera permission plugin unavailable:", err);
        return null;
    }
}

export async function ensureQrCameraPermission() {
    const nativeCameraPermission = await getNativeCameraPermissionPlugin();
    if (nativeCameraPermission?.checkPermission && nativeCameraPermission?.requestPermission) {
        try {
            const checked = await nativeCameraPermission.checkPermission();
            if (checked?.granted) return { granted: true, source: "native" };

            const requested = await nativeCameraPermission.requestPermission();
            return {
                granted: !!requested?.granted,
                denied: !requested?.granted,
                source: "native",
            };
        } catch (err) {
            console.warn("[qr-scan] native camera permission request failed:", err);
            return { granted: false, denied: true, source: "native" };
        }
    }

    try {
        const permissionApi = navigator.permissions;
        if (permissionApi?.query) {
            const cameraStatus = await permissionApi.query({ name: "camera" });
            if (cameraStatus?.state === "denied") {
                return { granted: false, denied: true, source: "browser" };
            }
        }
    } catch {
        // Browser permission probing is best-effort; getUserMedia will still
        // surface the real runtime prompt/error.
    }

    return { granted: true, source: "browser" };
}

export async function openQrCameraPermissionSettings() {
    const nativeCameraPermission = await getNativeCameraPermissionPlugin();
    if (nativeCameraPermission?.openAppSettings) {
        await nativeCameraPermission.openAppSettings();
    }
}

function isCameraPermissionDeniedError(err) {
    const name = String(err?.name || "");
    const message = String(err?.message || "");
    return name === "NotAllowedError"
        || name === "PermissionDeniedError"
        || name === "SecurityError"
        || /permission|denied|not allowed/i.test(message);
}

function QrPairScanner({ onDetected, onClose }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const frameRef = useRef(0);
    const detectorRef = useRef(null);
    const handledRef = useRef(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadingLabel, setLoadingLabel] = useState("카메라 권한 확인 중...");
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

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

        const handleNativeCameraDenied = () => {
            stopScanner();
            if (!active) return;
            setPermissionDenied(true);
            setError(QR_CAMERA_PERMISSION_MESSAGE);
            setLoading(false);
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
            handledRef.current = false;
            setError("");
            setPermissionDenied(false);
            setLoading(true);
            setLoadingLabel("카메라 권한 확인 중...");

            const permission = await ensureQrCameraPermission();
            if (!active) return;
            if (!permission.granted) {
                setPermissionDenied(true);
                setError(QR_CAMERA_PERMISSION_MESSAGE);
                setLoading(false);
                return;
            }

            setLoadingLabel("카메라 기능 확인 중...");
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
                setLoadingLabel("QR 스캔 준비 중...");
                detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
                setLoadingLabel("카메라 여는 중...");
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
                const denied = isCameraPermissionDeniedError(scannerError);
                setPermissionDenied(denied);
                setError(denied ? QR_CAMERA_PERMISSION_MESSAGE : "카메라를 열 수 없어요. 잠시 후 다시 시도해 주세요.");
                setLoading(false);
            }
        };

        window.addEventListener("camera-permission-denied", handleNativeCameraDenied);
        startScanner();

        return () => {
            active = false;
            window.removeEventListener("camera-permission-denied", handleNativeCameraDenied);
            stopScanner();
        };
    }, [onDetected, retryKey]);

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 650, background: "rgba(15,23,42,0.92)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 20px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)", display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 12, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 14, color: "white" }}>← 닫기</button>
                <div style={{ fontWeight: 800, fontSize: 16, color: "white" }}>📷 QR 코드 스캔</div>
            </div>
            <div style={{ flex: 1, padding: "20px 20px 28px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 18 }}>
                <div style={{ width: "100%", maxWidth: 360, aspectRatio: "3 / 4", borderRadius: 28, overflow: "hidden", background: "#0F172A", position: "relative", boxShadow: "0 24px 60px rgba(0,0,0,0.32)" }}>
                    <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", inset: 0, border: "2px solid rgba(255,255,255,0.08)" }} />
                    <div style={{ position: "absolute", inset: "18% 12%", borderRadius: 24, border: "3px solid rgba(255,255,255,0.92)", boxShadow: "0 0 0 999px rgba(15,23,42,0.35)" }} />
                    {loading && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.72)", color: "white", fontWeight: 700 }}>
                            {loadingLabel}
                        </div>
                    )}
                </div>
                <div style={{ maxWidth: 340, textAlign: "center", color: "white" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>부모님 화면의 QR 코드를 비춰 주세요</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.8)" }}>
                        QR을 인식하면 코드 입력 없이 바로 연동을 시작해요
                    </div>
                    {error && <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: "#ffb84a" }}>{error}</div>}
                    {permissionDenied && (
                        <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                            <button
                                type="button"
                                onClick={() => setRetryKey((value) => value + 1)}
                                style={{ border: "none", borderRadius: 14, padding: "10px 14px", fontSize: 13, fontWeight: 800, color: "white", background: "rgba(255,255,255,0.18)", cursor: "pointer" }}
                            >
                                권한 다시 확인
                            </button>
                            <button
                                type="button"
                                onClick={() => { void openQrCameraPermissionSettings(); }}
                                style={{ border: "1px solid rgba(255,255,255,0.32)", borderRadius: 14, padding: "10px 14px", fontSize: 13, fontWeight: 800, color: "white", background: "rgba(255,255,255,0.08)", cursor: "pointer" }}
                            >
                                앱 설정 열기
                            </button>
                        </div>
                    )}
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
            <div className="hy-pair">
                <div className="hy-pair__success-emoji" aria-hidden="true">🎉</div>
                <h1 className="hy-pair__success-title">연결됐어요!</h1>
                <p className="hy-pair__success-desc">
                    가족 정보를 불러오는 중이에요...<br />위치 권한을 묻는 창이 뜨면 허용해 주세요.
                </p>
            </div>
        );
    }

    return (
        <div className="hy-pair">
            <AppBrandLogo size={88} radius={24} />
            <h1 className="hy-pair__title">부모님과 연결하기</h1>
            <p className="hy-pair__subtitle">
                부모님 앱에 있는<br />연동 코드에서 KID- 뒤의 코드를 입력해 주세요
            </p>

            <div className="hy-pair__form">
                <div className="hy-pair-code-input">
                    <span className="hy-pair-code-prefix">KID-</span>
                    <input
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                        placeholder="XXXXXXXX"
                        maxLength={8}
                        inputMode="text"
                        autoCapitalize="characters"
                        autoComplete="off"
                    />
                </div>

                {error && <div className="hy-message hy-message--negative">{error}</div>}

                <button
                    type="button"
                    onClick={() => { void handleJoin(); }}
                    disabled={busy}
                    className="hy-button hy-button--primary"
                >
                    {busy ? "연결 중..." : "🔗 연결하기"}
                </button>

                <button
                    type="button"
                    onClick={() => { if (!busy) setShowScanner(true); }}
                    disabled={busy}
                    className="hy-button hy-button--outline"
                >
                    📷 QR로 연결하기
                </button>
            </div>

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
