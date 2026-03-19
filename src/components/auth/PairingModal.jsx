import { useState } from "react";
import { FF } from "../../lib/utils.js";
import PairCodeSection from "./PairCodeSection.jsx";

function PairingModal({ myRole, pairCode, pairedMembers, familyId: _familyId, onUnpair, onRename, onClose }) {
    const isParent = myRole === "parent";
    const children = pairedMembers?.filter(m => m.role === "child") || [];
    const parent = pairedMembers?.find(m => m.role === "parent") || null;
    const MAX_CHILDREN = 2;
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, fontFamily: FF }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: "white", borderRadius: "28px 28px 0 0", padding: "28px 24px 40px", width: "100%", maxWidth: 460, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#374151" }}>🔗 {isParent ? "아이 연동 관리" : "부모님 연동"}</div>
                    <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>닫기</button>
                </div>

                {/* Pair code display (parent) */}
                {isParent && (
                    pairCode ? (
                        <PairCodeSection pairCode={pairCode} childrenCount={children.length} maxChildren={MAX_CHILDREN} />
                    ) : children.length === 0 ? (
                        <div style={{ background: "#FEF3C7", border: "1.5px solid #FCD34D", borderRadius: 16, padding: "16px", marginBottom: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>🔐</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>카카오 로그인이 필요해요</div>
                            <div style={{ fontSize: 12, color: "#A16207", lineHeight: 1.6 }}>로그인하면 연동 코드가 생성되고<br/>아이 기기와 연결할 수 있어요</div>
                        </div>
                    ) : null
                )}

                {/* Connected children (parent view) */}
                {isParent && children.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 10 }}>연동된 아이 ({children.length}/{MAX_CHILDREN})</div>
                        {children.map((child, i) => (
                            <div key={child.user_id || i} style={{ background: "#F0FDF4", borderRadius: 16, padding: "14px 16px", marginBottom: 8, border: "1.5px solid #BBF7D0" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ fontSize: 28 }}>{child.emoji || "🐰"}</div>
                                    <div style={{ flex: 1 }}>
                                        {editingId === child.user_id ? (
                                            <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0, maxWidth: "100%" }}>
                                                <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                                                    style={{ width: 80, minWidth: 0, padding: "6px 8px", border: "2px solid #6EE7B7", borderRadius: 10, fontSize: 14, fontWeight: 800, fontFamily: FF, outline: "none", boxSizing: "border-box" }}
                                                    maxLength={10} />
                                                <button onClick={() => { if (editName.trim() && onRename) { onRename(child.user_id, editName.trim()); } setEditingId(null); }}
                                                    style={{ padding: "6px 10px", borderRadius: 10, background: "#059669", color: "white", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}>저장</button>
                                            </div>
                                        ) : (
                                            <div onClick={() => { setEditingId(child.user_id); setEditName(child.name); }} style={{ cursor: "pointer" }}>
                                                <div style={{ fontWeight: 800, fontSize: 15, color: "#065F46" }}>{child.name} <span style={{ fontSize: 11, color: "#9CA3AF" }}>✏️</span></div>
                                            </div>
                                        )}
                                        <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>📱 기기 {i + 1}</div>
                                    </div>
                                    <button onClick={() => { if (window.confirm(`${child.name} 연동을 해제할까요?`)) onUnpair(child.user_id); }}
                                        style={{ fontSize: 11, padding: "6px 12px", borderRadius: 10, background: "#FEE2E2", color: "#DC2626", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>
                                        해제
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Child view: show parent */}
                {!isParent && parent && (
                    <div style={{ background: "#D1FAE5", border: "2px solid #6EE7B7", borderRadius: 20, padding: "20px", marginBottom: 20, textAlign: "center" }}>
                        <div style={{ fontSize: 40, marginBottom: 8 }}>👨‍👩‍👧</div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: "#065F46" }}>연동 완료</div>
                        <div style={{ fontSize: 14, color: "#047857", marginTop: 4 }}>{parent.name} (부모님)</div>
                    </div>
                )}

                {/* Empty state */}
                {isParent && children.length === 0 && (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "#9CA3AF", fontSize: 14 }}>
                        아직 연결된 아이가 없어요
                    </div>
                )}
                {!isParent && !parent && (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "#9CA3AF", fontSize: 14 }}>
                        부모님과 아직 연동되지 않았어요
                    </div>
                )}
            </div>
        </div>
    );
}

export default PairingModal;
