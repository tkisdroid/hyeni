import { useState, useEffect, useRef, useCallback } from "react";
import { getSession, onAuthChange, getMyFamily, anonymousLogin, logout } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { SUPABASE_URL, SUPABASE_KEY } from "../lib/utils.js";
import { stopNativeLocationService } from "../lib/locationService.js";
import { unsubscribeFromPush } from "../lib/pushNotifications.js";

export default function useAuth() {
    // ── Auth & family state (Supabase) ──────────────────────────────────────────
    const [authUser, setAuthUser] = useState(null);       // supabase auth user
    const [familyInfo, setFamilyInfo] = useState(null);   // { familyId, pairCode, myRole, myName, members }
    const [authLoading, setAuthLoading] = useState(true);
    const [myRole, setMyRole] = useState(() => {
        try { return localStorage.getItem("hyeni-my-role") || null; } catch { return null; }
    });           // "parent" | "child" | null (role selection)
    const [showParentSetup, setShowParentSetup] = useState(false);

    const isParent = familyInfo?.myRole === "parent" || myRole === "parent";
    const isNativeApp = typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
    const familyId = familyInfo?.familyId;
    const pairCode = familyInfo?.pairCode || "";
    const pairedChildren = familyInfo?.members?.filter(m => m.role === "child") || [];

    // Persist myRole to localStorage for session continuity
    useEffect(() => {
        try {
            if (myRole) localStorage.setItem("hyeni-my-role", myRole);
            else localStorage.removeItem("hyeni-my-role");
        } catch { /* ignored */ }
    }, [myRole]);

    const handleNativeAuthCallback = useCallback(async (url) => {
        if (!url || !url.startsWith("hyenicalendar://auth-callback")) {
            return false;
        }

        const fragment = url.includes("#")
            ? url.split("#")[1]
            : (url.split("?")[1] || "");
        const params = new URLSearchParams(fragment);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const code = params.get("code");

        try {
            if (accessToken && refreshToken) {
                await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
                return true;
            }

            if (code) {
                await supabase.auth.exchangeCodeForSession(code);
                return true;
            }
        } catch (err) {
            console.error("[Auth] Native OAuth callback handling failed:", err);
        }

        return false;
    }, []);

    // ── Deep link handler (카카오 OAuth 콜백 → 앱 복귀) ──────────────────────
    useEffect(() => {
        if (!isNativeApp) return;
        let handle;
        (async () => {
            try {
                const { App: CapApp } = await import("@capacitor/app");
                const launch = await CapApp.getLaunchUrl();
                if (launch?.url) {
                    await handleNativeAuthCallback(launch.url);
                }

                handle = await CapApp.addListener("appUrlOpen", async (event) => {
                    await handleNativeAuthCallback(event.url);
                });
            } catch (_error) {
                // native deep-link listener unavailable in web mode
            }
        })();
        return () => { if (handle) handle.remove(); };
    }, [handleNativeAuthCallback, isNativeApp]);

    // ── Shared auth handler (used by both init and onAuthChange) ────────────────
    const handleAuthUser = useCallback(async (user) => {
        setAuthUser(user);

        let fam = null;
        try {
            fam = await getMyFamily(user.id);
        } catch (err) {
            console.error("[getMyFamily]", err);
        }

        if (fam) {
            setFamilyInfo(fam);
            setMyRole(fam.myRole);
            return;
        }

        // Kakao user with no family → show parent setup choice (don't auto-create)
        const isKakao = user.app_metadata?.provider === "kakao"
            || user.identities?.some(i => i.provider === "kakao")
            || user.user_metadata?.provider === "kakao";
        if (isKakao) {
            setMyRole("parent");
            setShowParentSetup(true); // Show "새 가족 만들기 / 기존 가족 합류" choice
        }
    }, []);

    // ── Auth: check session on mount ────────────────────────────────────────────
    const authInitDone = useRef(false);
    const authUserRef = useRef(null);
    const myRoleRef = useRef(myRole);
    const familyInfoRef = useRef(familyInfo);
    // Keep refs in sync with state (avoids stale closure in visibility handler)
    useEffect(() => { authUserRef.current = authUser; }, [authUser]);
    useEffect(() => { myRoleRef.current = myRole; }, [myRole]);
    useEffect(() => { familyInfoRef.current = familyInfo; }, [familyInfo]);

    useEffect(() => {
        const init = async () => {
            try {
                const session = await getSession();
                if (session?.user) {
                    await handleAuthUser(session.user);
                }
            } catch (err) {
                console.error("[auth init] error:", err);
            }
            authInitDone.current = true;
            setAuthLoading(false);
        };

        // Safety timeout: never hang on loading screen
        const safetyTimer = setTimeout(() => {
            if (!authInitDone.current) {
                authInitDone.current = true;
                setAuthLoading(false);
            }
        }, 5000);

        init();

        const sub = onAuthChange(async (session, event) => {
            // Skip if init() hasn't finished yet (avoid double-run on mount)
            if (!authInitDone.current) return;
            if (session?.user) {
                await handleAuthUser(session.user);
            } else if (event === "SIGNED_OUT") {
                // Only reset role on explicit sign-out, not on token refresh failures
                setAuthUser(null);
                setFamilyInfo(null);
                setMyRole(null);
            }
        });

        // Re-check session when app comes back from background
        const handleVisibility = async () => {
            if (document.visibilityState === "visible" && authInitDone.current) {
                try {
                    const session = await getSession();
                    if (session?.user) {
                        if (!authUserRef.current || !myRoleRef.current) {
                            await handleAuthUser(session.user);
                        }
                        // Update native service token + ensure service is running
                        if (session.access_token) {
                            try {
                                const { Capacitor, registerPlugin } = await import("@capacitor/core");
                                if (Capacitor.isNativePlatform()) {
                                    const BackgroundLocation = registerPlugin("BackgroundLocation");
                                    // Check if service is still running, restart if dead
                                    const { running } = await BackgroundLocation.isRunning();
                                    const curRole = myRoleRef.current;
                                    const curFamilyId = familyInfoRef.current?.familyId;
                                    if (!running && curRole === "child" && curFamilyId) {
                                        console.log("[Resume] LocationService was dead, restarting...");
                                        await BackgroundLocation.startService({
                                            userId: session.user.id, familyId: curFamilyId,
                                            supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY,
                                            accessToken: session.access_token
                                        });
                                    } else {
                                        await BackgroundLocation.updateToken({ accessToken: session.access_token });
                                    }
                                }
                            } catch { /* ignored */ }
                        }
                    }
                } catch { /* ignored */ }
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            sub?.unsubscribe();
            clearTimeout(safetyTimer);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [handleAuthUser]);

    // ── Handle child role selection (anonymous login + pair code input) ────────
    const handleChildSelect = useCallback(async () => {
        try {
            const user = await anonymousLogin();
            setAuthUser(user);
            setMyRole("child");
            // ChildPairInput overlay will show automatically (myRole=child + !familyId)
        } catch (err) {
            console.error("[child login]", err);
        }
    }, []);

    // ── Logout handler ────────────────────────────────────────────────────────
    const handleLogout = useCallback(async (showNotif) => {
        if (!window.confirm("로그아웃 하시겠어요?")) return;
        try {
            await stopNativeLocationService();
            await unsubscribeFromPush();
            await logout();
            setMyRole(null);
            setFamilyInfo(null);
            setAuthUser(null);
            showNotif("로그아웃 되었어요");
        } catch (err) {
            console.error("[logout]", err);
            showNotif("로그아웃 실패");
        }
    }, []);

    return {
        authUser, setAuthUser,
        authLoading,
        myRole, setMyRole,
        familyInfo, setFamilyInfo,
        showParentSetup, setShowParentSetup,
        isParent,
        isNativeApp,
        familyId,
        pairCode,
        pairedChildren,
        handleChildSelect,
        handleLogout,
        handleAuthUser,
    };
}
