import { useState, useEffect, useCallback } from "react";
import { setupFamily, joinFamilyAsParent, getMyFamily } from "../lib/auth.js";

export default function useFamily({ authUser, familyInfo, setFamilyInfo, setMyRole, setShowParentSetup }) {
    const [showPairing, setShowPairing] = useState(false);
    const [parentPhones, setParentPhones] = useState({ mom: "", dad: "" });
    const [showPhoneSettings, setShowPhoneSettings] = useState(false);

    // ── Sync parent phones from familyInfo ─────────────────────────────────────
    useEffect(() => {
        if (familyInfo?.phones) {
            setParentPhones(familyInfo.phones);
        }
    }, [familyInfo]);

    useEffect(() => {
        // Show pairing modal if parent is logged in but no other family members exist
        if (familyInfo?.myRole === "parent" && familyInfo?.members?.length === 1) {
            setShowPairing(true);
        }
    }, [familyInfo]);

    // ── Handle parent setup: create new family or join existing ────────────────
    const handleCreateFamily = useCallback(async (showNotif) => {
        if (!authUser) return;
        try {
            await setupFamily(authUser.id, authUser.user_metadata?.name || "부모");
            const fam = await getMyFamily(authUser.id);
            if (fam) {
                setFamilyInfo(fam);
                setMyRole(fam.myRole);
                setShowParentSetup(false);
                setShowPairing(true);
                showNotif("가족이 생성되었어요! 아래 연동코드를 공유해 주세요 🎉");
            }
        } catch (err) {
            console.error("[createFamily]", err);
            showNotif("가족 생성 실패: " + (err.message || ""), "error");
        }
    }, [authUser, setFamilyInfo, setMyRole, setShowParentSetup]);

    const handleJoinAsParent = useCallback(async (code, showNotif) => {
        if (!authUser || !code.trim()) return;
        try {
            await joinFamilyAsParent(code.trim(), authUser.id, authUser.user_metadata?.name || "부모");
            const fam = await getMyFamily(authUser.id);
            if (fam) {
                setFamilyInfo(fam);
                setMyRole(fam.myRole);
                setShowParentSetup(false);
                showNotif("가족에 합류했어요! 🎉");
            }
        } catch (err) {
            console.error("[joinAsParent]", err);
            showNotif("합류 실패: 코드를 확인해주세요", "error");
        }
    }, [authUser, setFamilyInfo, setMyRole, setShowParentSetup]);

    return {
        showPairing, setShowPairing,
        parentPhones, setParentPhones,
        showPhoneSettings, setShowPhoneSettings,
        handleCreateFamily,
        handleJoinAsParent,
    };
}
