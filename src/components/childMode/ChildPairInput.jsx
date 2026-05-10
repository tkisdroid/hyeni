// src/components/childMode/ChildPairInput.jsx
// 자녀 첫 페어링 화면 — KID-XXXXXXXX 코드 직접 입력 + QR 스캐너 fallback.
// Bundles QrPairScanner (BarcodeDetector based camera scanner) for self-containment.
// Cartoon-warm 적용 (2026-05-08): main UI 만 cartoon 화. QR 스캐너 overlay 는
// 카메라 표시를 위해 dark 톤 유지 (의도적). 핸들러/state 모두 보존.

import { useEffect, useRef, useState } from "react";
import { joinFamily } from "../../lib/auth.js";
import { normalizePairCodeInput } from "../../lib/pairCode.js";
import { FF } from "../../lib/styleHelpers.js";
import { AppBrandLogo } from "../auth/AppBrandLogo.jsx";
import { HyeniMascot } from "../auth/HyeniMascot.jsx";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

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
                            {loadingLabel}
                        </div>
                    )}
                </div>
                <div style={{ maxWidth: 340, textAlign: "center", color: "white" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>부모님 화면의 QR 코드를 비춰 주세요</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.8)" }}>
                        QR을 인식하면 코드 입력 없이 바로 연동을 시작해요
                    </div>
                    {error && <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: "var(--status-cautionary-strong)" }}>{error}</div>}
                    {permissionDenied && (
                        <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                            <button
                                type="button"
                                onClick={() => setRetryKey((value) => value + 1)}
                                style={{ border: "none", borderRadius: 14, padding: "10px 14px", fontSize: 13, fontWeight: 800, color: "white", background: "rgba(255,255,255,0.18)", cursor: "pointer", fontFamily: FF }}
                            >
                                권한 다시 확인
                            </button>
                            <button
                                type="button"
                                onClick={() => { void openQrCameraPermissionSettings(); }}
                                style={{ border: "1px solid rgba(255,255,255,0.32)", borderRadius: 14, padding: "10px 14px", fontSize: 13, fontWeight: 800, color: "white", background: "rgba(255,255,255,0.08)", cursor: "pointer", fontFamily: FF }}
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
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 500,
                    fontFamily: "var(--font-sans)",
                    background: "linear-gradient(180deg, #FFE7EE 0%, #FFF6F2 50%, #F4E4FB 100%)",
                }}
            >
                <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
                    <HyeniMascot variant="wave" size={180} aria-label="혜니" />
                    <h1 style={{ marginTop: 24, fontSize: 26, fontWeight: 800, color: "#2A1A20", letterSpacing: "-0.03em" }}>
                        연결됐어요!
                        <span aria-hidden="true" style={{ marginLeft: 4, fontSize: 16, color: "#F779A8" }}>♥</span>
                    </h1>
                    <p style={{ marginTop: 12, fontSize: 14, fontWeight: 500, color: "#7A6770", lineHeight: 1.6 }}>
                        가족 정보를 불러오는 중이에요<br />위치 권한을 묻는 창이 뜨면 허용해 주세요
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 500,
                fontFamily: "var(--font-sans)",
                background: "linear-gradient(180deg, #FFE7EE 0%, #FFF6F2 50%, #F4E4FB 100%)",
                overflowY: "auto",
            }}
        >
            <div
                style={{
                    minHeight: "100dvh",
                    display: "flex",
                    flexDirection: "column",
                    padding: "calc(env(safe-area-inset-top, 0px) + 24px) 20px calc(env(safe-area-inset-bottom, 0px) + 16px)",
                }}
            >
                <div style={{ width: "100%", maxWidth: 400, margin: "0 auto", display: "flex", flexDirection: "column", flex: 1 }}>
                    <div role="banner" aria-label="혜니캘린더" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <AppBrandLogo size={64} radius={18} shadow={false} />
                        <div
                            aria-hidden="true"
                            style={{
                                marginTop: 12,
                                fontSize: 18,
                                fontWeight: 800,
                                color: "var(--theme-accent-text, #C3325B)",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            혜니캘린더
                            <span style={{ marginLeft: 4, fontSize: 12 }}>♥</span>
                        </div>
                    </div>

                    <div style={{ textAlign: "center", marginTop: 16 }}>
                        <h1
                            style={{
                                margin: 0,
                                fontSize: 30,
                                fontWeight: 800,
                                lineHeight: 1.2,
                                color: "#2A1A20",
                                letterSpacing: "-0.03em",
                            }}
                        >
                            부모님과 <span style={{ color: "var(--theme-accent, #F779A8)" }}>연결하기</span>
                            <span aria-hidden="true" style={{ fontSize: 16, color: "var(--theme-accent, #F779A8)", marginLeft: 4 }}>♥</span>
                        </h1>
                        <p style={{ marginTop: 12, fontSize: 14, fontWeight: 500, color: "#7A6770" }}>
                            부모님 앱에 있는 연동 코드를 입력해 주세요
                        </p>
                    </div>

                    {/* Code input card */}
                    <div
                        style={{
                            marginTop: 20,
                            padding: "20px 16px",
                            background: "linear-gradient(180deg, rgba(255,247,250,0.9) 0%, rgba(255,235,242,0.9) 100%)",
                            border: "1px solid #FFD6DD",
                            borderRadius: 24,
                            boxShadow: "0 4px 14px rgba(247, 121, 168, 0.10)",
                        }}
                    >
                        <CodeInput code={code} onChange={setCode} onSubmit={() => { void handleJoin(); }} />

                        <div style={{ height: 1, background: "#FFD6DD", margin: "16px 4px 12px", opacity: 0.7 }} />

                        <button
                            type="button"
                            onClick={() => { if (!busy) setShowScanner(true); }}
                            disabled={busy}
                            className="btn btn-secondary"
                            style={{ width: "100%" }}
                        >
                            <span aria-hidden="true" style={{
                                display: "inline-flex",
                                width: 22,
                                height: 22,
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--brand-rose-text)",
                                fontSize: 18,
                            }}>⌗</span>
                            QR로 연결하기
                        </button>
                    </div>

                    {error && (
                        <div style={{
                            marginTop: 12,
                            padding: "10px 14px",
                            borderRadius: 12,
                            border: "1px solid #F8D58C",
                            background: "#FFF7E6",
                            color: "#B87A00",
                            fontSize: 13,
                            fontWeight: 600,
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Lavender info card */}
                    <div
                        style={{
                            marginTop: 16,
                            padding: 16,
                            background: "linear-gradient(135deg, var(--brand-lavender-soft, #EFE8FF) 0%, rgba(255,247,250,0.85) 100%)",
                            border: "1px solid var(--brand-lavender-line, #DDD1FF)",
                            borderRadius: 20,
                            display: "flex",
                            gap: 12,
                            alignItems: "flex-start",
                        }}
                    >
                        <ThreeDIcon name="shield-heart" size={42} aria-label="" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#2A1A20", lineHeight: 1.4 }}>
                                코드는 <span style={{ color: "var(--theme-accent-text, #C3325B)" }}>24시간</span> 동안만 사용할 수 있어요.
                            </div>
                            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 500, color: "#7A6770", lineHeight: 1.5 }}>
                                새 코드는 부모님 앱에서<br />언제든 다시 발급받을 수 있어요.
                            </div>
                        </div>
                    </div>

                    {/* Mascot hero */}
                    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220, marginTop: 12 }}>
                        <span aria-hidden="true" style={{ position: "absolute", left: "16%", top: "8%", fontSize: 16, opacity: 0.7 }}>✨</span>
                        <span aria-hidden="true" style={{ position: "absolute", right: "20%", top: "6%", fontSize: 14, opacity: 0.7 }}>✨</span>
                        <div aria-hidden="true" style={{ position: "absolute", left: "2%", top: "38%" }}>
                            <ThreeDIcon name="calendar-check" size={56} />
                        </div>
                        <div aria-hidden="true" style={{ position: "absolute", left: "12%", bottom: "8%" }}>
                            <ThreeDIcon name="heart" size={26} />
                        </div>
                        <div aria-hidden="true" style={{ position: "absolute", right: "2%", top: "26%" }}>
                            <span style={{
                                display: "inline-flex",
                                width: 64,
                                height: 56,
                                background: "#FFFFFF",
                                borderRadius: "26px 26px 26px 8px",
                                border: "1px solid #FFD6DD",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 6px 16px rgba(247, 121, 168, 0.16)",
                                position: "relative",
                            }}>
                                <ThreeDIcon name="bell" size={32} />
                            </span>
                        </div>
                        <div aria-hidden="true" style={{ position: "absolute", right: "14%", bottom: "10%" }}>
                            <ThreeDIcon name="heart" size={22} />
                        </div>
                        <HyeniMascot variant="wave" size={216} aria-label="혜니" />
                    </div>

                    <p style={{ textAlign: "center", marginTop: 4, fontSize: 13, fontWeight: 600, color: "#7A6770" }}>
                        연결되면 <span style={{ color: "var(--theme-accent-text, #C3325B)" }}>내 일정과 알림</span>을 바로 볼 수 있어!
                    </p>

                    <button
                        type="button"
                        onClick={() => { void handleJoin(); }}
                        disabled={busy}
                        className="btn btn-primary"
                        style={{ marginTop: 16, width: "100%" }}
                        aria-label="연결하기"
                    >
                        {busy ? "연결 중..." : "연결하기"}
                        {!busy && <span aria-hidden="true" style={{ fontWeight: 600, fontSize: 18 }}>›</span>}
                    </button>

                    <p style={{ marginTop: 12, textAlign: "center", fontSize: 12, fontWeight: 500, color: "#A892A0" }}>
                        <span aria-hidden="true" style={{ color: "#F779A8", marginRight: 6 }}>♥</span>
                        소중한 우리 가족을 위한 캘린더
                        <span aria-hidden="true" style={{ color: "#F779A8", marginLeft: 6 }}>♥</span>
                    </p>
                </div>
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

function CodeInput({ code, onChange, onSubmit }) {
    const inputRef = useRef(null);
    const [focused, setFocused] = useState(false);
    const handleClick = () => inputRef.current?.focus();
    const handleKey = (event) => {
        if (event.key === "Enter" && code.length === 8) onSubmit();
    };

    return (
        <div
            onClick={handleClick}
            style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "text",
                minHeight: 48,
            }}
        >
            <span
                aria-hidden="true"
                style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "var(--theme-accent-text, #C3325B)",
                    fontFamily: FF,
                    letterSpacing: "-0.02em",
                }}
            >
                KID-
            </span>
            <div
                style={{
                    flex: 1,
                    display: "grid",
                    gridTemplateColumns: "repeat(8, 1fr)",
                    gap: 4,
                }}
            >
                {Array.from({ length: 8 }).map((_, i) => {
                    const isActive = focused && code.length === i;
                    const filled = !!code[i];
                    return (
                        <span
                            key={i}
                            style={{
                                aspectRatio: "3 / 4",
                                background: "#FFFFFF",
                                border: isActive
                                    ? "2px solid #F779A8"
                                    : filled
                                        ? "1px solid #FFC1CF"
                                        : "1px solid #FFE0E6",
                                borderRadius: 10,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontFamily: "ui-monospace, 'SF Mono', monospace",
                                fontSize: 20,
                                fontWeight: 800,
                                color: "#2A1A20",
                                textTransform: "uppercase",
                            }}
                        >
                            {code[i] || ""}
                        </span>
                    );
                })}
            </div>
            <input
                ref={inputRef}
                value={code}
                onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={handleKey}
                maxLength={8}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                aria-label="페어링 코드 8자리"
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    border: "none",
                    background: "transparent",
                    color: "transparent",
                    caretColor: "transparent",
                    outline: "none",
                    fontFamily: FF,
                    fontSize: 16,
                    cursor: "text",
                }}
            />
        </div>
    );
}
